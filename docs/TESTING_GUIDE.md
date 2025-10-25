# 🧪 VideoForge Testing Guide

## Current Infrastructure Status

Based on deployment verification, here's what's available to test:

### ✅ Lambda Functions (Active)
- **Gallery Service:** video-forge-gallery-service
- **Streaming Service:** video-forge-streaming-service
- **Runtime:** Node.js 22.x
- **Status:** Deployed and ready

### ✅ CloudFront CDN (Active)
- **Distribution:** E2RUBI217JZAKW
- **Domain:** d3vlpici5fmp7i.cloudfront.net
- **Status:** Deployed

### ⚠️ Video Processor ASG (Scaled to 0)
- **ASG:** video-forge-video-processor-asg
- **Current:** 0 instances (Min: 0, Max: 0, Desired: 0)
- **Note:** Scaled down - this is normal when not processing videos

### ✅ Supporting Services
- **HTTPS:** video-forge-v2.cab432.com
- **SQS Queue:** video-forge-video-processing-queue
- **S3:** video-forge-storage
- **RDS:** PostgreSQL database

---

## 🧪 Test Plan

### Test 1: Lambda Functions (Direct Invoke)

**Gallery Service Health Check:**
```bash
aws lambda invoke \
  --function-name video-forge-gallery-service \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region ap-southeast-2 \
  gallery-response.json

cat gallery-response.json
```

**Expected:** `{"statusCode":200,"body":"{\"status\":\"ok\"}"}`

**Streaming Service Health Check:**
```bash
aws lambda invoke \
  --function-name video-forge-streaming-service \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region ap-southeast-2 \
  streaming-response.json

cat streaming-response.json
```

**Expected:** `{"statusCode":200,"body":"{\"status\":\"ok\"}"}`

---

### Test 2: HTTPS Endpoint

```bash
curl -I https://video-forge-v2.cab432.com
```

**Expected:**
- HTTP/2 200 OK
- Headers showing TLS/HTTPS

---

### Test 3: CloudFront CDN

```bash
# Test CloudFront is accessible
curl -I https://d3vlpici5fmp7i.cloudfront.net

# If you have a test file in S3, try:
curl -I https://d3vlpici5fmp7i.cloudfront.net/test-file.mp4
```

**Expected:**
- First request: `x-cache: Miss from cloudfront` (fetches from S3)
- Second request: `x-cache: Hit from cloudfront` (served from edge cache)

---

### Test 4: SQS Queue

```bash
# Check queue status
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue \
  --attribute-names All \
  --region ap-southeast-2
```

**Expected:** Queue exists with DLQ configured

---

### Test 5: API Gateway Integration (If Running)

```bash
# Test API endpoints
curl https://video-forge-v2.cab432.com/api/health
curl https://video-forge-v2.cab432.com/api/gallery/videos
```

---

### Test 6: Video Processor ASG (Scale Up)

**To test video processing, scale up the ASG:**

```bash
# Scale ASG to 1 instance
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --region ap-southeast-2

# Wait 2-3 minutes for instance to launch

# Check instance status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names video-forge-video-processor-asg \
  --region ap-southeast-2 \
  --query 'AutoScalingGroups[0].Instances[*].[InstanceId,HealthStatus,LifecycleState]'
```

**Then submit a test job to SQS:**
```bash
aws sqs send-message \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue \
  --message-body '{
    "jobId": 1,
    "inputSource": "s3://video-forge-storage/test-video.mp4",
    "outputFormats": ["720p", "480p"]
  }' \
  --region ap-southeast-2
```

**Monitor processing:**
```bash
# Watch CloudWatch logs
aws logs tail /asg/video-forge-video-processor --follow --region ap-southeast-2
```

---

### Test 7: End-to-End Video Workflow

**Full workflow test:**

1. **Upload video to S3** (via API or console)
2. **Create job** (POST to /api/jobs)
3. **Job queued in SQS**
4. **ASG instance picks up job**
5. **Video transcoded** to multiple qualities
6. **Assets stored in S3**
7. **Access via Gallery Lambda** (GET /api/gallery/videos/:id)
8. **Stream via Streaming Lambda** (GET /api/stream/:id)
9. **Deliver via CloudFront** (edge-cached URLs)

---

## 📊 Expected Test Results

### ✅ Passing Tests
- Lambda health checks: 200 OK
- HTTPS endpoint: Accessible
- CloudFront: Deployed
- SQS Queue: Exists with DLQ
- Infrastructure: All components configured

### ⚠️ Requires Scaling
- Video Processor: Needs ASG scale-up to test processing
- End-to-end workflow: Needs active instances

---

## 🎯 Quick Verification (No Scaling Needed)

**Test what's currently active:**

```bash
# 1. Test Lambda Functions
aws lambda invoke --function-name video-forge-gallery-service \
  --payload '{"httpMethod":"GET","path":"/health"}' \
  --region ap-southeast-2 /tmp/test.json && cat /tmp/test.json

# 2. Test HTTPS
curl -I https://video-forge-v2.cab432.com

# 3. Test CloudFront
curl -I https://d3vlpici5fmp7i.cloudfront.net

# 4. List S3 bucket
aws s3 ls s3://video-forge-storage/ --region ap-southeast-2

# 5. Check CloudFront distribution
aws cloudfront get-distribution --id E2RUBI217JZAKW
```

---

## 🔧 Troubleshooting

### Lambda Test Fails
- Check VPC configuration
- Verify environment variables
- Check CloudWatch logs: `/aws/lambda/video-forge-gallery-service`

### HTTPS Not Accessible
- Check if API Gateway/ALB is running
- Verify Route53 DNS record
- Check security groups

### CloudFront 403 Error
- S3 bucket permissions (requires bucket policy update)
- Origin access control (OAC) configuration

### ASG Not Scaling
- Check if desired capacity is set
- Verify IAM role permissions
- Check CloudWatch logs

---

## 🎓 For A3 Demonstration

**You can demonstrate:**

1. ✅ Lambda Functions deployed and responsive
2. ✅ CloudFront CDN configured and deployed
3. ✅ HTTPS endpoint available
4. ✅ Auto-scaling configuration (even at 0 instances)
5. ✅ SQS with DLQ configured
6. ✅ All infrastructure components exist

**You don't need to:**
- Have instances running 24/7 (cost savings)
- Process actual videos for the demo
- Have everything scaled up simultaneously

The infrastructure **exists and is configured correctly** - that's what matters for A3!

