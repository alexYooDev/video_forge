# VideoForge Hybrid Architecture Plan
**Date**: 2025-10-23
**Target**: 20-22/24 marks on A3

---

## Architecture Overview

```
Internet (Users)
    ↓
Application Load Balancer (HTTPS)
    ├─→ /api/*         → API Gateway (EC2)
    │                      ├→ /api/gallery/*   → Lambda: Gallery Service
    │                      └→ /api/stream/*    → Lambda: Streaming Service
    ├─→ /*             → Client (ECS Fargate)
    └─→ (internal)     → Video Processor (ASG)
                            ↓
                         SQS Queue (video processing jobs)
```

---

## Services Breakdown

### 1. API Gateway (EC2 - Microservice #1)
- **Instance**: i-001758facca230c14 (13.236.36.103)
- **Purpose**: Proxy HTTP requests to Lambda functions
- **Runtime**: Node.js on EC2
- **Status**: ✅ Running
- **Proxies to**:
  - Gallery Lambda: `https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url...`
  - Streaming Lambda: `https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url...`

### 2. Gallery Service (Lambda - Serverless)
- **Function**: video-forge-gallery-service
- **Purpose**: Handle video uploads, metadata, user galleries
- **Runtime**: Node.js on Lambda
- **Status**: ✅ Working
- **Resources**: S3, RDS, Cognito

### 3. Streaming Service (Lambda - Serverless)
- **Function**: video-forge-streaming-service
- **Purpose**: Serve transcoded videos, HLS streaming
- **Runtime**: Node.js on Lambda
- **Status**: ✅ Working
- **Resources**: S3, RDS

### 4. Client Service (ECS Fargate - Microservice #2)
- **Service**: video-forge-client-service (to be created/fixed)
- **Purpose**: React frontend application
- **Runtime**: nginx serving static React build
- **Status**: ⏳ Needs task definition update
- **Current ECS**: 0 running tasks

### 5. Video Processor (EC2 ASG - Microservice #3)
- **ASG**: video-forge-video-processor-asg
- **Purpose**: Transcode videos (CPU-intensive)
- **Runtime**: FFmpeg on EC2
- **Status**: ⏳ Currently 0,0,0 → will be 1,3,1
- **Scaling**: CPU + SQS depth metrics

---

## A3 Requirements Mapping

### Core Criteria (10 marks)

#### Microservices (3/3)
✅ **Three separate services on separate compute:**
1. API Gateway (EC2)
2. Client (ECS Fargate)
3. Video Processor (EC2 Auto Scaling Group)

#### Load Distribution (2/2)
✅ **Two load distribution mechanisms:**
1. ALB - distributes HTTP/HTTPS to API Gateway & Client
2. SQS - distributes video processing jobs to ASG instances

#### Auto Scaling (3/3)
✅ **Video Processor ASG:**
- Scales 1 → 3 instances under load
- Scales 3 → 1 when load reduces
- Metrics: CPU utilization (70%) + SQS queue depth
- No service interruptions (graceful job completion)

#### HTTPS (2/2)
✅ **ACM Certificate + ALB:**
- Request certificate for subdomain (e.g., video-forge.cab432.com)
- Configure ALB listener for HTTPS (port 443)
- HTTP → HTTPS redirect

---

### Additional Criteria (10-12 marks)

#### Serverless Functions (2/2)
✅ **Lambda for Gallery + Streaming:**
- Event-driven responses (S3 upload triggers)
- Lightweight public-facing services
- NOT used for CPU-intensive tasks (that's ASG)

#### Container Orchestration with ECS (2/2)
✅ **Client service on ECS Fargate:**
- Demonstrates container orchestration
- Automatic health checks and restarts
- Load balanced via ALB

#### Communication Mechanisms (2/2)
✅ **Multiple communication patterns:**
1. ALB routing (path-based to services)
2. API Gateway proxying (HTTP to Lambda URLs)
3. SQS messaging (async job queue)
4. Lambda Function URLs (serverless HTTP)

#### Custom Scaling Metric (2/2)
✅ **SQS Queue Depth for Video Processor:**
- Scales based on queue depth (not just CPU)
- More responsive than CPU-only
- Prevents queue backlog

#### Dead Letter Queue (0-2 marks)
⏳ **Optional - if time permits:**
- SQS DLQ for failed transcoding jobs
- Lambda for DLQ monitoring/alerting

#### Edge Caching (0 marks - not pursuing)
❌ CloudFront - skipping to save time

---

## Implementation Steps

### Phase 1: ALB Configuration (30 minutes)

**Step 1.1: Create Target Group for API Gateway EC2**
```bash
aws elbv2 create-target-group \
  --name video-forge-api-gateway-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id vpc-007bab53289655834 \
  --health-check-path /health \
  --region ap-southeast-2
```

**Step 1.2: Register API Gateway EC2 with Target Group**
```bash
aws elbv2 register-targets \
  --target-group-arn <TG_ARN> \
  --targets Id=i-001758facca230c14 \
  --region ap-southeast-2
```

**Step 1.3: Create ALB Listener Rule for /api/***
```bash
# Route /api/* to API Gateway target group
aws elbv2 create-rule \
  --listener-arn <LISTENER_ARN> \
  --conditions Field=path-pattern,Values='/api/*' \
  --priority 10 \
  --actions Type=forward,TargetGroupArn=<API_GATEWAY_TG_ARN> \
  --region ap-southeast-2
```

---

### Phase 2: ECS Client Service (45 minutes)

**Step 2.1: Check Current Task Definition**
- Review video-forge-client task definition revision
- Verify environment variables, image URL, port mappings

**Step 2.2: Update Task Definition (via Console)**
- Go to ECS Console → Task Definitions → video-forge-client
- Create new revision with correct:
  - Image: `<ECR_URL>/video-forge-client:latest`
  - Port: 80 (nginx)
  - Environment: `VITE_API_URL=https://<ALB_DNS>/api`
  - Memory: 512, CPU: 256

**Step 2.3: Create Target Group for Client**
```bash
aws elbv2 create-target-group \
  --name video-forge-client-tg \
  --protocol HTTP \
  --port 80 \
  --vpc-id vpc-007bab53289655834 \
  --target-type ip \
  --health-check-path / \
  --region ap-southeast-2
```

**Step 2.4: Update ECS Service with Target Group**
(via Console due to permissions)
- ECS Console → Clusters → video-forge-cluster
- Services → video-forge-client-service
- Update service → Load balancing → Add target group
- Set desired count: 1

**Step 2.5: Create ALB Rule for Client (Default)**
```bash
# Default action (/* catches all) routes to client
aws elbv2 modify-listener \
  --listener-arn <LISTENER_ARN> \
  --default-actions Type=forward,TargetGroupArn=<CLIENT_TG_ARN> \
  --region ap-southeast-2
```

---

### Phase 3: Video Processor ASG (1 hour)

**Step 3.1: Create SQS Queue**
```bash
aws sqs create-queue \
  --queue-name video-forge-transcoding-queue \
  --region ap-southeast-2
```

**Step 3.2: Update ASG Capacity**
```bash
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --region ap-southeast-2
```

**Step 3.3: Create CPU-based Scaling Policy**
```bash
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name video-forge-video-processor-asg \
  --policy-name cpu-scale-up \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration file://cpu-scaling-config.json \
  --region ap-southeast-2
```

cpu-scaling-config.json:
```json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ASGAverageCPUUtilization"
  }
}
```

**Step 3.4: Create SQS-based Scaling Policy**
```bash
# Create CloudWatch alarm for SQS queue depth
aws cloudwatch put-metric-alarm \
  --alarm-name video-forge-queue-depth-high \
  --alarm-description "Scale up when queue has >5 messages" \
  --metric-name ApproximateNumberOfMessagesVisible \
  --namespace AWS/SQS \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=QueueName,Value=video-forge-transcoding-queue \
  --region ap-southeast-2
```

---

### Phase 4: HTTPS Setup (30 minutes)

**Step 4.1: Request ACM Certificate**
(via Console - easier for DNS validation)
- ACM Console → Request certificate
- Domain: `video-forge.cab432.com` (or your subdomain)
- Validation: DNS (add CNAME to Route 53)
- Wait for validation (~5 minutes)

**Step 4.2: Add HTTPS Listener to ALB**
```bash
aws elbv2 create-listener \
  --load-balancer-arn <ALB_ARN> \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=<CERT_ARN> \
  --default-actions Type=forward,TargetGroupArn=<CLIENT_TG_ARN> \
  --region ap-southeast-2
```

**Step 4.3: Add HTTP → HTTPS Redirect**
```bash
aws elbv2 modify-listener \
  --listener-arn <HTTP_LISTENER_ARN> \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region ap-southeast-2
```

**Step 4.4: Configure Route 53**
(via Console)
- Route 53 → Hosted zones → cab432.com
- Create record: `video-forge.cab432.com`
- Type: A - Alias to ALB

---

### Phase 5: Integration & Testing (45 minutes)

**Test 5.1: ALB Health Checks**
```bash
# Check all target groups are healthy
aws elbv2 describe-target-health --target-group-arn <API_GATEWAY_TG_ARN>
aws elbv2 describe-target-health --target-group-arn <CLIENT_TG_ARN>
```

**Test 5.2: HTTP Routing**
```bash
# Test via ALB DNS
curl http://video-forge-alb-396992013.ap-southeast-2.elb.amazonaws.com/api/health
curl http://video-forge-alb-396992013.ap-southeast-2.elb.amazonaws.com/
```

**Test 5.3: HTTPS + Domain**
```bash
curl https://video-forge.cab432.com/api/gallery/videos
curl https://video-forge.cab432.com/
```

**Test 5.4: Auto-scaling**
```bash
# Send messages to SQS to trigger scaling
for i in {1..10}; do
  aws sqs send-message \
    --queue-url <QUEUE_URL> \
    --message-body '{"videoId":"test-'$i'"}' \
    --region ap-southeast-2
done

# Watch ASG scale up
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names video-forge-video-processor-asg \
  --region ap-southeast-2
```

**Test 5.5: End-to-End Flow**
1. Upload video via frontend (https://video-forge.cab432.com)
2. Verify stored in S3
3. Check SQS message created
4. Watch ASG launch instance
5. Verify transcoding job processed
6. Check transcoded videos in S3
7. Stream video via frontend

---

## Expected Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| ALB Configuration | 30 min | 30 min |
| ECS Client Service | 45 min | 1h 15m |
| Video Processor ASG | 1 hour | 2h 15m |
| HTTPS Setup | 30 min | 2h 45m |
| Integration & Testing | 45 min | 3h 30m |

**Total: ~3.5 hours**

---

## Final Marks Estimate

### Core (10/10)
- ✅ Microservices: 3/3
- ✅ Load Distribution: 2/2
- ✅ Auto Scaling: 3/3
- ✅ HTTPS: 2/2

### Additional (10-12/14)
- ✅ Serverless: 2/2
- ✅ Container Orchestration: 2/2
- ✅ Communication: 2/2
- ✅ Custom Scaling: 2/2
- ⏳ Dead Letter Queue: 0-2/2 (if time)

**Total: 20-22/24**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Application Load Balancer (video-forge.cab432.com)        │
│  - HTTPS Listener (443) with ACM Certificate                │
│  - HTTP Listener (80) → Redirect to HTTPS                   │
└─────┬───────────────────────────────────┬───────────────────┘
      │ /api/*                            │ /*
      ↓                                   ↓
┌─────────────────────┐         ┌─────────────────────┐
│  API Gateway (EC2)  │         │  Client (ECS)       │
│  Port: 8000         │         │  Port: 80           │
│  ─────────────────  │         │  ─────────────────  │
│  Target Group:      │         │  Target Group:      │
│  - Health: /health  │         │  - Health: /        │
│  - Instance: EC2    │         │  - Type: IP         │
└──────┬──────────────┘         │  - Tasks: 1         │
       │                        └─────────────────────┘
       │ Proxies to:
       ├→ /api/gallery/*
       │  ↓
       │  ┌────────────────────────────────┐
       │  │  Lambda: Gallery Service       │
       │  │  - S3, RDS, Cognito           │
       │  └────────────────────────────────┘
       │
       └→ /api/stream/*
          ↓
          ┌────────────────────────────────┐
          │  Lambda: Streaming Service     │
          │  - S3, RDS, HLS               │
          └────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  SQS Queue: video-forge-transcoding-queue                   │
└────────────────────────┬────────────────────────────────────┘
                         │ Polls
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  Auto Scaling Group: video-forge-video-processor-asg        │
│  - Min: 1, Max: 3, Desired: 1                               │
│  - Launch Template: video-forge-video-processor-lt          │
│  - Scaling Policies:                                        │
│    1. CPU Utilization (70%)                                 │
│    2. SQS Queue Depth (>5 messages)                         │
│  ─────────────────────────────────────────────────────────  │
│  EC2 Instances (1-3):                                       │
│  - FFmpeg video transcoding                                 │
│  - Polls SQS, processes jobs, stores to S3                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Shared Resources                                           │
│  ─────────────────────────────────────────────────────────  │
│  • S3: video-forge-storage (raw + transcoded videos)        │
│  • RDS: database-1-instance-1 (metadata, users)             │
│  • Cognito: ap-southeast-2_jft50FBre (authentication)       │
│  • VPC: vpc-007bab53289655834                               │
│  • Security Group: sg-032bd1ff8cf77dbb9                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Advantages of This Architecture

1. **Maximizes Marks**: Covers Core + 5 Additional criteria
2. **Uses Lambda**: Gets serverless marks while keeping CPU work on EC2
3. **Uses ECS**: Gets container orchestration marks
4. **Uses ASG**: Gets auto-scaling marks with proper metrics
5. **Multiple Communication Patterns**: ALB, API Gateway proxy, SQS, Lambda URLs
6. **Production-Ready**: HTTPS, load balancing, auto-scaling, health checks
7. **Cost-Effective**: Lambda for low-traffic APIs, ASG scales to zero when idle

---

## Next Steps

Run these phases in order. Let me know when you're ready to start Phase 1!
