# Video Processor Not Polling SQS - Diagnosis

**Date:** October 24, 2025
**Status:** ⚠️ ISSUE IDENTIFIED

---

## Problem

Video processor ASG instance is running and healthy, but **NOT processing SQS messages**.

**Evidence:**
- ✅ ASG instance `i-0d2542c95d9612058` is `InService` and `Healthy`
- ✅ New job created successfully (SQS queue has 4 messages, increased from 3)
- ❌ **0 messages in flight** - processor is NOT polling SQS
- ✅ API Gateway CAN send to SQS (job creation works)

---

## Root Cause (Most Likely)

**IAM Permission Issue:** The `CAB432-Instance-Role` likely has permissions to **send** to SQS but NOT **receive** from it.

### Required SQS Permissions for Video Processor

The video processor needs these permissions on the SQS queue:
```json
{
  "Effect": "Allow",
  "Action": [
    "sqs:ReceiveMessage",
    "sqs:DeleteMessage",
    "sqs:GetQueueAttributes",
    "sqs:GetQueueUrl"
  ],
  "Resource": "arn:aws:sqs:ap-southeast-2:901444280953:video-forge-video-processing-queue"
}
```

### What We Know Works

**API Gateway (EC2)** can send to SQS:
- Uses `CAB432-Instance-Role`
- Successfully sends messages (4 messages in queue)
- Has permission: `sqs:SendMessage`

**Video Processor (ASG)** should receive from SQS:
- Uses `CAB432-Instance-Role`
- **NOT receiving messages** (0 in flight)
- Likely missing: `sqs:ReceiveMessage`, `sqs:DeleteMessage`

---

## How to Verify

### Option 1: Check IAM Policy via AWS Console

1. Go to **IAM Console** → **Roles** → `CAB432-Instance-Role`
2. Check attached policies for SQS permissions
3. Look for policies with `sqs:ReceiveMessage` and `sqs:DeleteMessage`

### Option 2: Check via AWS CLI (if you have access)

```bash
# List attached policies
aws iam list-attached-role-policies --role-name CAB432-Instance-Role

# Get inline policies
aws iam list-role-policies --role-name CAB432-Instance-Role

# Get specific policy document (if you know the policy name)
aws iam get-role-policy --role-name CAB432-Instance-Role --policy-name <policy-name>
```

---

## How to Fix

### If IAM permissions are missing:

**Add SQS polling permissions to `CAB432-Instance-Role`:**

```bash
# Create policy document
cat > /tmp/sqs-poll-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl"
      ],
      "Resource": "arn:aws:sqs:ap-southeast-2:901444280953:video-forge-video-processing-queue"
    }
  ]
}
EOF

# Attach policy to role (if you have permission)
aws iam put-role-policy \
  --role-name CAB432-Instance-Role \
  --policy-name SQSVideoProcessorPolicy \
  --policy-document file:///tmp/sqs-poll-policy.json
```

**Then restart the video processor:**
```bash
# Scale down to 0
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --desired-capacity 0 \
  --region ap-southeast-2

# Wait 15 seconds
sleep 15

# Scale back to 1
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --desired-capacity 1 \
  --region ap-southeast-2
```

---

## Alternative Causes (Less Likely)

### 1. Container Failing to Start
- **Check:** The Dockerfile and user data look correct
- **Evidence against:** Instance is healthy (would fail health checks if container crashed)

### 2. Database Connection Failing
- **Check:** Added env var fallback for DB credentials
- **Evidence against:** API Gateway uses same DB credentials and it works

### 3. Network Issue
- **Check:** ASG instances are in same VPC as API Gateway
- **Evidence against:** API Gateway can reach SQS, so network should be fine

### 4. Corrupted SQS Messages
- **Check:** Created new job, queue now has 4 messages
- **Evidence against:** Even new message isn't being picked up

---

## Current System State

### Working Components ✅
- Client UI loads (HTTPS)
- Login works (Cognito + MFA)
- Video upload works (S3)
- Job creation works (API Gateway → Database → SQS)
- SQS queue accessible (messages being added)

### Not Working Components ❌
- **Video Processor not polling SQS**
- Jobs stuck in PENDING state
- No video transcoding happening

---

## Next Steps

1. **IMMEDIATE:** Verify `CAB432-Instance-Role` has SQS polling permissions
2. **If missing:** Add the required SQS permissions
3. **Then:** Cycle the ASG instance to restart with new permissions
4. **Verify:** Check if messages start getting processed (MessagesInFlight > 0)

---

## Testing Command

After adding IAM permissions and restarting, run:
```bash
# Check if messages are being processed
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --region ap-southeast-2 \
  --output json | jq '{Available: .Attributes.ApproximateNumberOfMessages, InFlight: .Attributes.ApproximateNumberOfMessagesNotVisible}'
```

**Expected result when working:**
```json
{
  "Available": "3",  // Decreased from 4
  "InFlight": "1"    // Greater than 0 - being processed!
}
```

---

**Confidence Level:** 90% - IAM permissions are almost certainly the issue
**Estimated Time to Fix:** 5 minutes (if you have IAM access)
