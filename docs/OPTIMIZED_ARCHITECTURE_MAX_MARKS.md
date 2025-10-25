# VideoForge: Optimized Architecture for Maximum Marks

**Date**: 2025-10-23
**Goal**: Maximize A3 marks (target 22-24/24) with purpose-driven design

---

## 🎯 The Problem with Current Design

### Current Architecture:
```
ALB → EC2 API Gateway → Lambda (Gallery + Streaming)
    → ECS Client (not running)
    → ASG Video Processor (not configured)
```

### Issues:
1. **EC2 API Gateway is redundant** - Just proxies to Lambda (weak justification)
2. **Not using ECS services** - You have 3 ECS services created but 0 running (wasted setup)
3. **Missing marks** - Not getting Container Orchestration or Additional Microservices marks

---

## ✨ OPTIMAL ARCHITECTURE (22-24/24 Marks)

### Option A: **ECS-First Architecture** (Recommended - 23-24/24)

```
Internet
    ↓
ALB (HTTPS) → Path-based routing:
    ├─ /* → ECS Client (Fargate) - React frontend
    ├─ /api/gallery/* → ECS Gallery Service (Fargate) - Video metadata, uploads
    ├─ /api/stream/* → ECS Streaming Service (Fargate) - HLS streaming
    └─ (internal) ASG Video Processor (EC2) ← SQS Queue
```

**Why this is better:**

| Component | Purpose | Marks Justification |
|-----------|---------|---------------------|
| **ECS Client** | Serve React frontend | ✅ Container orchestration, stateless web |
| **ECS Gallery** | Handle uploads, metadata | ✅ Microservice #1, auto-scaling, health checks |
| **ECS Streaming** | Serve HLS streams | ✅ Microservice #2, read-heavy traffic |
| **ASG Video Processor** | FFmpeg transcoding | ✅ Microservice #3, CPU-intensive, auto-scaling |
| **ALB** | Load balancing | ✅ Distributes to 3 ECS services |
| **SQS + DLQ** | Job queue | ✅ Communication, dead letter queue |

**Marks Breakdown:**

### Core Criteria (10/10)
- **Microservices (3/3)**: Gallery ECS + Streaming ECS + Video Processor ASG
- **Load Distribution (2/2)**: ALB distributes to ECS services + SQS for processor
- **Auto Scaling (3/3)**: ECS auto-scaling + ASG auto-scaling
- **HTTPS (2/2)**: ALB with ACM certificate

### Additional Criteria (13-14/14)
- **Additional Microservices (2/2)**: 4 total (Client + Gallery + Streaming + Processor)
- **Serverless (0/2)**: ❌ Not using Lambda (trade-off worth it)
- **Container Orchestration (2/2)**: ✅ 3 ECS services with Fargate
- **Advanced Container Orchestration (2/2)**: ✅ Service discovery, health checks, rolling updates
- **Communication (2/2)**: ✅ ALB path routing, SQS, service discovery
- **Custom Scaling (2/2)**: ✅ ECS CPU + Memory, ASG CPU + SQS depth
- **Dead Letter Queue (2/2)**: ✅ Already have it!
- **Edge Caching (0/2)**: ❌ Skipping due to time

**Total: 23-24/24 marks**

---

### Option B: **Hybrid Lambda + ECS** (Current Plan - 20-22/24)

Keep Lambda + add ECS client = fewer marks but faster to implement.

**Not recommended** because you've already done the hard work of:
- Creating ECS services
- Building Docker images
- Pushing to ECR

Why not use them?

---

## 🏗️ Detailed Architecture: Option A (ECS-First)

### 1. ECS Client Service (Fargate)

**Purpose**: Serve React frontend (static files)

**Configuration**:
```yaml
Service: video-forge-client-service
Task Definition: video-forge-client:latest
Desired Count: 1-3 (auto-scaling)
Launch Type: FARGATE
CPU: 256 (0.25 vCPU)
Memory: 512 MB
Port: 80 (nginx)
Health Check: GET / → 200 OK
```

**Auto-scaling**:
- Target CPU: 70%
- Target Memory: 70%
- Min: 1, Max: 3

**Justification**:
- ✅ Container orchestration with Fargate (no server management)
- ✅ Auto-scales with user traffic
- ✅ Health checks + automatic restarts
- ✅ Rolling deployments (zero downtime updates)

---

### 2. ECS Gallery Service (Fargate)

**Purpose**: Handle video uploads, metadata management, user galleries

**Configuration**:
```yaml
Service: video-forge-gallery-service
Task Definition: video-forge-gallery-service:latest
Desired Count: 1-3 (auto-scaling)
Launch Type: FARGATE
CPU: 512 (0.5 vCPU)
Memory: 1024 MB (1 GB)
Port: 3000 (Express)
Health Check: GET /health → 200 OK
```

**Key Features**:
- Generates S3 presigned URLs for uploads
- Creates gallery video records in RDS
- **Sends SQS messages** to trigger video processing
- Cognito authentication middleware

**Auto-scaling**:
- Target CPU: 70%
- Target Request Count: 1000/target
- Min: 1, Max: 3

**Environment Variables**:
```bash
NODE_ENV=production
DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
DB_NAME=videoforge
S3_BUCKET=video-forge-storage
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/.../video-forge-video-processing-queue
COGNITO_USER_POOL_ID=ap-southeast-2_jft50FBre
AWS_REGION=ap-southeast-2
```

**Justification**:
- ✅ Write-heavy service needs separate scaling from read-heavy streaming
- ✅ Can scale independently during upload spikes
- ✅ Stateless design (no sticky sessions needed)

---

### 3. ECS Streaming Service (Fargate)

**Purpose**: Serve transcoded videos via HLS streaming

**Configuration**:
```yaml
Service: video-forge-streaming-service
Task Definition: video-forge-streaming-service:latest
Desired Count: 1-4 (higher for streaming traffic)
Launch Type: FARGATE
CPU: 256 (0.25 vCPU)
Memory: 512 MB
Port: 4000 (Express)
Health Check: GET /health → 200 OK
```

**Key Features**:
- Fetches video metadata from RDS
- Generates S3 presigned URLs for HLS segments
- Returns .m3u8 playlists
- Read-heavy, cacheable responses

**Auto-scaling**:
- Target CPU: 60% (lower for read-heavy)
- Target Request Count: 2000/target (higher capacity)
- Min: 1, Max: 4

**Justification**:
- ✅ Separate from gallery = independent scaling
- ✅ Read-heavy traffic patterns different from writes
- ✅ Can scale to 4 during streaming spikes while gallery stays at 1

---

### 4. ASG Video Processor (EC2)

**Purpose**: CPU-intensive FFmpeg video transcoding

**Configuration**:
```yaml
Auto Scaling Group: video-forge-video-processor-asg
Launch Template: video-forge-video-processor-lt
Instance Type: t3.medium (2 vCPU, 4 GB RAM)
Min: 0, Max: 3, Desired: 1
AMI: Amazon Linux 2023
User Data: Install FFmpeg, Node.js, start processor
```

**Key Features**:
- Polls SQS for transcoding jobs (long polling 20s)
- Downloads raw video from S3
- Transcodes with FFmpeg (1080p → 720p, 480p, 360p)
- Generates HLS segments (.m3u8 + .ts files)
- Uploads to S3, updates RDS
- Deletes SQS message on success

**Auto-scaling Policies**:
1. **CPU-based**: Target 70% CPU utilization
2. **SQS-based**: Scale up if queue depth > 5 messages

**Justification**:
- ✅ FFmpeg needs dedicated CPU (not shared like Fargate)
- ✅ Jobs take 5-15 minutes (too long for Lambda)
- ✅ Scales to 0 when no uploads (cost savings)
- ✅ EC2 cheaper than Fargate for sustained CPU

---

### 5. Application Load Balancer (ALB)

**Purpose**: HTTPS termination, path-based routing, health checks

**Listeners**:

**HTTP Listener (Port 80)**:
```yaml
Action: Redirect to HTTPS (301)
```

**HTTPS Listener (Port 443)**:
```yaml
Certificate: ACM certificate for video-forge.cab432.com
Rules:
  - Path: /api/gallery/* → video-forge-gallery-tg
  - Path: /api/stream/* → video-forge-streaming-tg
  - Path: /* (default) → video-forge-client-tg
```

**Target Groups**:

1. **video-forge-client-tg**
   - Target Type: IP (Fargate)
   - Port: 80
   - Health Check: GET / → 200 OK
   - Healthy Threshold: 2
   - Unhealthy Threshold: 3

2. **video-forge-gallery-tg**
   - Target Type: IP (Fargate)
   - Port: 3000
   - Health Check: GET /health → 200 OK

3. **video-forge-streaming-tg**
   - Target Type: IP (Fargate)
   - Port: 4000
   - Health Check: GET /health → 200 OK

**Justification**:
- ✅ Single HTTPS endpoint for all services
- ✅ Path-based routing keeps URLs clean
- ✅ Health checks remove unhealthy targets automatically
- ✅ SSL/TLS termination (ACM certificate)

---

### 6. SQS Queue + Dead Letter Queue

**Main Queue**: `video-forge-video-processing-queue`
```yaml
Message Retention: 4 days
Visibility Timeout: 300 seconds (5 minutes)
Receive Wait Time: 20 seconds (long polling)
Max Receives: 3 (before moving to DLQ)
Dead Letter Queue: video-forge-video-processing-queue-dlq
```

**Dead Letter Queue**: `video-forge-video-processing-queue-dlq`
```yaml
Message Retention: 14 days (for investigation)
```

**Message Format**:
```json
{
  "jobId": "uuid",
  "videoId": "123",
  "s3Key": "uploads/user123/raw-video.mp4",
  "userId": "user123",
  "qualities": ["1080p", "720p", "480p", "360p"],
  "timestamp": "2025-10-23T05:00:00Z"
}
```

**Justification**:
- ✅ Decouples gallery service from video processor
- ✅ Buffers jobs during upload spikes
- ✅ DLQ captures failed jobs (corrupt videos, FFmpeg errors)
- ✅ Enables retry logic (3 attempts before DLQ)

---

## 🔄 Request Flow Examples

### Upload Flow:
```
1. User uploads video via React frontend
   → POST https://video-forge.cab432.com/upload

2. ALB routes to ECS Client
   → Client calls POST /api/gallery/generate-upload-url

3. ALB routes /api/gallery/* to ECS Gallery Service
   → Gallery generates S3 presigned URL
   → Returns to client

4. Client uploads directly to S3

5. Client confirms: POST /api/gallery/confirm-upload
   → ECS Gallery Service:
      a. Verifies file in S3
      b. Creates gallery_videos record in RDS
      c. Sends message to SQS queue
      d. Returns success to client

6. ASG Video Processor polls SQS
   → Receives job message
   → Downloads from S3
   → Transcodes with FFmpeg (5-15 min)
   → Uploads HLS files to S3
   → Updates RDS (media_assets table)
   → Deletes SQS message
```

### Streaming Flow:
```
1. User opens video in React frontend
   → GET https://video-forge.cab432.com/watch/123

2. Client requests: GET /api/stream/video/123/playlist

3. ALB routes /api/stream/* to ECS Streaming Service
   → Streaming fetches video + assets from RDS
   → Generates S3 presigned URLs for .m3u8 and .ts files
   → Returns playlist to client

4. Client's video player fetches HLS segments directly from S3
   (using presigned URLs)
```

---

## 📊 Marks Justification Table

| Criterion | Implementation | Strong Justification | Marks |
|-----------|---------------|----------------------|-------|
| **Microservices** | Gallery (ECS) + Streaming (ECS) + Video Processor (ASG) | ✅ Three services, separate compute, distinct purposes | **3/3** |
| **Load Distribution** | ALB (web) + SQS (jobs) | ✅ ALB distributes HTTP to 3 ECS services, SQS distributes async jobs | **2/2** |
| **Auto Scaling** | ECS auto-scaling + ASG auto-scaling | ✅ All services scale independently based on load | **3/3** |
| **HTTPS** | ALB + ACM cert | ✅ SSL termination, HTTP→HTTPS redirect | **2/2** |
| **Additional Microservices** | Client (ECS) = 4 total | ✅ Four microservices, appropriate separation | **2/2** |
| **Container Orchestration** | 3 ECS Fargate services | ✅ Fargate manages containers, no server management | **2/2** |
| **Advanced Container Orchestration** | Service discovery, rolling updates | ✅ ECS service discovery, health-based replacement | **2/2** |
| **Communication** | ALB routing + SQS + Service discovery | ✅ Multiple patterns: sync (ALB), async (SQS), internal (discovery) | **2/2** |
| **Custom Scaling** | SQS depth for ASG | ✅ Queue depth better than CPU-only for job-based scaling | **2/2** |
| **Dead Letter Queue** | SQS DLQ | ✅ Captures failed jobs, enables troubleshooting | **2/2** |
| **Total** | | | **22/24** |

**Missing 2 marks**: Edge Caching (CloudFront) - skipping due to time constraints

---

## 🚀 Implementation Plan (3-4 hours)

### Phase 1: Fix ECS Services (1 hour)

**Step 1.1: Update Task Definitions** (via Console - IAM restriction)
For each service (gallery, streaming, client):
1. Go to ECS Console → Task Definitions
2. Create new revision with:
   - Correct ECR image URI
   - Environment variables (DB, S3, SQS, Cognito)
   - Port mappings
   - Health check command

**Step 1.2: Create ALB Target Groups**
```bash
# Gallery Service Target Group
aws elbv2 create-target-group \
  --name video-forge-gallery-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-007bab53289655834 \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region ap-southeast-2

# Streaming Service Target Group
aws elbv2 create-target-group \
  --name video-forge-streaming-tg \
  --protocol HTTP \
  --port 4000 \
  --vpc-id vpc-007bab53289655834 \
  --target-type ip \
  --health-check-path /health \
  --region ap-southeast-2

# Client Target Group
aws elbv2 create-target-group \
  --name video-forge-client-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id vpc-007bab53289655834 \
  --target-type ip \
  --health-check-path / \
  --region ap-southeast-2
```

**Step 1.3: Update ECS Services** (via Console)
For each service:
1. Update service → Load balancing
2. Add target group (created above)
3. Set desired count: 1
4. Enable auto-scaling (optional for now)

---

### Phase 2: Configure ALB Routing (30 min)

**Step 2.1: Get ALB Listener ARN**
```bash
ALB_ARN=$(aws elbv2 describe-load-balancers --names video-forge-alb --region ap-southeast-2 --query 'LoadBalancers[0].LoadBalancerArn' --output text)

LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region ap-southeast-2 --query 'Listeners[?Port==`80`].ListenerArn' --output text)
```

**Step 2.2: Create Routing Rules**
```bash
# Get target group ARNs
GALLERY_TG_ARN=$(aws elbv2 describe-target-groups --names video-forge-gallery-tg --region ap-southeast-2 --query 'TargetGroups[0].TargetGroupArn' --output text)

STREAMING_TG_ARN=$(aws elbv2 describe-target-groups --names video-forge-streaming-tg --region ap-southeast-2 --query 'TargetGroups[0].TargetGroupArn' --output text)

CLIENT_TG_ARN=$(aws elbv2 describe-target-groups --names video-forge-client-tg --region ap-southeast-2 --query 'TargetGroups[0].TargetGroupArn' --output text)

# Rule 1: /api/gallery/* → Gallery Service
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 10 \
  --conditions Field=path-pattern,Values='/api/gallery/*' \
  --actions Type=forward,TargetGroupArn=$GALLERY_TG_ARN \
  --region ap-southeast-2

# Rule 2: /api/stream/* → Streaming Service
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 20 \
  --conditions Field=path-pattern,Values='/api/stream/*' \
  --actions Type=forward,TargetGroupArn=$STREAMING_TG_ARN \
  --region ap-southeast-2

# Default: /* → Client Service
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions Type=forward,TargetGroupArn=$CLIENT_TG_ARN \
  --region ap-southeast-2
```

---

### Phase 3: Configure ASG (1 hour)

**Step 3.1: Update ASG Capacity**
```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --region ap-southeast-2
```

**Step 3.2: Create CPU Scaling Policy**
```bash
cat > cpu-scaling-policy.json <<EOF
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ASGAverageCPUUtilization"
  }
}
EOF

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration file://cpu-scaling-policy.json \
  --region ap-southeast-2
```

**Step 3.3: Create SQS Depth Scaling Policy**
```bash
# Create CloudWatch metric for SQS
QUEUE_NAME=video-forge-video-processing-queue

# Scale up alarm
aws cloudwatch put-metric-alarm \
  --alarm-name video-forge-sqs-scale-up \
  --alarm-description "Scale up when queue depth > 5" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=QueueName,Value=$QUEUE_NAME \
  --alarm-actions <SCALE_UP_POLICY_ARN> \
  --region ap-southeast-2
```

---

### Phase 4: HTTPS Setup (30 min)

**Step 4.1: Request ACM Certificate** (via Console)
1. Go to ACM Console
2. Request certificate for `video-forge.cab432.com`
3. Choose DNS validation
4. Add CNAME record to Route 53
5. Wait for validation (~5 min)

**Step 4.2: Add HTTPS Listener to ALB**
```bash
CERT_ARN=<from ACM console>

aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$CLIENT_TG_ARN \
  --region ap-southeast-2

# Copy rules from HTTP listener to HTTPS
# (Repeat create-rule commands with new HTTPS listener ARN)
```

**Step 4.3: Update HTTP Listener to Redirect**
```bash
aws elbv2 modify-listener \
  --listener-arn $LISTENER_ARN \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region ap-southeast-2
```

---

### Phase 5: Testing (1 hour)

**Test 5.1: Health Checks**
```bash
# Check all targets healthy
aws elbv2 describe-target-health --target-group-arn $GALLERY_TG_ARN
aws elbv2 describe-target-health --target-group-arn $STREAMING_TG_ARN
aws elbv2 describe-target-health --target-group-arn $CLIENT_TG_ARN
```

**Test 5.2: HTTP Routing**
```bash
ALB_DNS=$(aws elbv2 describe-load-balancers --names video-forge-alb --query 'LoadBalancers[0].DNSName' --output text)

curl http://$ALB_DNS/  # Should return React app
curl http://$ALB_DNS/api/gallery/health  # Should return Gallery service health
curl http://$ALB_DNS/api/stream/health  # Should return Streaming service health
```

**Test 5.3: Upload + Transcoding Flow**
1. Upload video via frontend
2. Check SQS queue for message
3. Watch ASG launch instance (if at 0)
4. Monitor processor logs
5. Verify transcoded files in S3

---

## 🎓 What to Say in Your Report

### Architecture Justification:

"I chose an **ECS-first architecture** to maximize container orchestration benefits while maintaining appropriate separation of concerns:

1. **Gallery and Streaming separated**: Different traffic patterns (write-heavy vs read-heavy) benefit from independent scaling.

2. **ECS Fargate for web services**: Stateless APIs benefit from automatic container orchestration, health checks, and rolling updates without server management.

3. **EC2 ASG for video processing**: CPU-intensive FFmpeg transcoding requires dedicated compute and longer execution time (5-15 min) than serverless limits allow.

4. **SQS decoupling**: Async job queue prevents upload failures during processing spikes and provides retry logic via DLQ.

This design achieves 22/24 marks while remaining cost-effective (~$40-60/month) and scalable to 10,000+ users."

---

## 💰 Cost Comparison

### Lambda + EC2 API Gateway (Current Plan):
```
Lambda Gallery:  $1-2/month
Lambda Streaming: $1-2/month
EC2 API Gateway:  $8/month (t3.small 24/7)
ECS Client:       $5/month (Fargate 512MB 24/7)
ASG Video Proc:   $10-30/month (variable)
Total:            $25-47/month
Marks:            20-22/24
```

### ECS-First (Recommended):
```
ECS Gallery:     $10/month (Fargate 1GB 24/7)
ECS Streaming:   $5/month (Fargate 512MB 24/7)
ECS Client:      $5/month (Fargate 512MB 24/7)
ASG Video Proc:  $10-30/month (variable)
Total:           $30-50/month
Marks:           22-24/24
```

**+$5/month for +2-4 marks = worth it!**

---

## ✅ Summary: Why ECS-First Wins

### Pros:
1. ✅ **+2-4 marks**: Container orchestration + additional microservices
2. ✅ **Uses existing work**: ECS services already created, ECR images ready
3. ✅ **Better justification**: No "redundant API Gateway" question
4. ✅ **Production-ready**: Service discovery, rolling updates, health checks
5. ✅ **Same cost**: ~$30-50/month either way

### Cons:
1. ❌ **No serverless marks** (-2 marks): But we gain +4 elsewhere
2. ❌ **Slightly more setup**: Need to fix task definitions (1 hour)

### Decision:
**Go with ECS-First.** You've already done 80% of the work (created services, built images). Finishing it gets you 22-24/24 marks vs 20-22/24 with Lambda.

---

## 🚦 Ready to Implement?

Next step: **Phase 1** - Fix ECS task definitions and get services running.

Would you like me to:
1. Start implementing Phase 1 (create target groups, update ECS services)?
2. First verify which task definitions need updating?
3. Something else?
