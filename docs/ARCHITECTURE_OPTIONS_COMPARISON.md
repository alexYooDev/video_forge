# VideoForge Architecture Options - Comparison

**Date:** October 23, 2025
**Current Status:** Choosing between AWS API Gateway + Lambda vs ECS Deployment

---

## Option 1: AWS API Gateway + Lambda Functions

### Architecture
```
Internet/Client
    ↓
AWS API Gateway (REST API)
    ├→ Lambda: video-forge-gallery-service
    └→ Lambda: video-forge-streaming-service

Supporting:
├─ Video Processor ASG (EC2)
├─ RDS PostgreSQL
├─ S3 Storage
├─ CloudFront CDN
└─ Cognito MFA
```

### Current Status
- ✅ Lambda functions deployed (both working via Function URLs)
- ✅ API Gateway REST API created (`9aprzwxo9g`)
- ✅ Routes configured (`/api/gallery/{proxy+}`, `/api/stream/{proxy+}`)
- ✅ Lambda handlers updated to support API Gateway events
- ✅ Deployment packages built (11MB + 9.7MB)
- ⏳ Need to upload updated Lambda code via Console
- ⏳ Need to test integration

### Pros
✅ **Fully Serverless** - Gallery and Streaming services auto-scale from 0
✅ **Pay-per-request** - No costs when idle
✅ **Managed Infrastructure** - AWS handles scaling, patching, availability
✅ **Built-in API Management** - Throttling, caching, API keys available
✅ **Easy HTTPS** - API Gateway provides HTTPS by default
✅ **CloudWatch Integration** - Built-in logging and monitoring
✅ **Custom Domain Support** - Can map to `video-forge-v2.cab432.com`
✅ **Multiple Marks** - Serverless (2 marks) + API Gateway service

### Cons
❌ **Cold Start Latency** - First request can be slower (1-3 seconds)
❌ **Requires Code Upload** - No CLI permissions, must use Console
❌ **Different Event Format** - Lambda must handle API Gateway events
❌ **Timeout Limits** - Max 29 seconds for API Gateway → Lambda
❌ **Less Control** - Can't customize runtime environment as easily

### Deployment Steps Remaining
1. Upload Lambda packages via AWS Console (5 minutes)
2. Test API Gateway endpoints (2 minutes)
3. Configure custom domain mapping (optional, 5 minutes)
4. Update client to use API Gateway URL

**Estimated Time:** 15-20 minutes

### API Gateway Endpoint
```
https://9aprzwxo9g.execute-api.ap-southeast-2.amazonaws.com/prod/api/gallery/videos
https://9aprzwxo9g.execute-api.ap-southeast-2.amazonaws.com/prod/api/stream/qualities
```

---

## Option 2: ECS (Fargate/EC2) Deployment

### Architecture
```
Internet
    ↓
Application Load Balancer (HTTPS)
    ├→ ECS Service: gallery-service (Fargate tasks)
    ├→ ECS Service: streaming-service (Fargate tasks)
    └→ ECS Service: api-gateway (optional gateway layer)

Supporting:
├─ Video Processor ASG (EC2)
├─ RDS PostgreSQL
├─ S3 Storage
├─ CloudFront CDN
└─ Cognito MFA
```

### Current Status
- ✅ ECS Cluster exists: `video-forge-cluster`
- ✅ ECS Services created (but not running):
  - `video-forge-gallery-service-service-v24pef3w`
  - `video-forge-streaming-service-service-ivo8hq2q`
  - `video-forge-api-gateway-service-eqc8ujb0`
- ✅ Docker images in ECR (pushed Oct 19)
- ❌ Task definitions outdated (missing env vars)
- ❌ Can't update task definitions via CLI (permission denied)
- ⚠️ Need Service Discovery for inter-service communication

### Pros
✅ **No Cold Starts** - Containers always warm
✅ **Flexible Runtime** - Full control over container environment
✅ **Container Orchestration Marks** - ECS deployment (2 marks)
✅ **Better for Long-Running** - No timeout limits
✅ **Service Discovery** - Native AWS Cloud Map integration
✅ **Blue/Green Deployments** - Built-in deployment strategies
✅ **Predictable Performance** - Consistent response times
✅ **Docker Compose** - Can test locally easily

### Cons
❌ **Always Running** - Pay for minimum capacity even when idle
❌ **Manual Scaling** - Need to configure auto-scaling policies
❌ **Task Definition Updates Blocked** - IAM permissions issue
❌ **More Complex** - Requires managing tasks, services, load balancing
❌ **Higher Baseline Cost** - Minimum 1-2 tasks always running
❌ **Slower Deployment** - Container startup takes 1-2 minutes

### Deployment Steps Required
1. ❌ **BLOCKED:** Update task definitions via Console (workaround needed)
2. Configure environment variables in task definitions
3. Update ECS services to use new task definitions
4. Wait for tasks to start (3-5 minutes)
5. Register with ALB target groups
6. Test endpoints

**Estimated Time:** 30-45 minutes (if task definition issue resolved)

### Known Blockers
```
ERROR: User is not authorized to perform: ecs:RegisterTaskDefinition
```
**Workaround:** Use ECS Console to update task definitions manually

---

## Side-by-Side Comparison

| Criteria | API Gateway + Lambda | ECS (Fargate/EC2) |
|----------|---------------------|-------------------|
| **Setup Time** | 15-20 min | 30-45 min |
| **Cold Start** | Yes (1-3s) | No |
| **Cost (Idle)** | $0 | ~$20-40/month |
| **Cost (Active)** | Pay per request | Fixed + scaling |
| **Scalability** | Automatic (0 to 1000s) | Manual configuration |
| **Latency** | Higher (cold start) | Lower (always warm) |
| **Complexity** | Low | Medium-High |
| **Control** | Limited | Full |
| **IAM Issues** | None | Task def blocked |
| **A3 Marks** | Serverless (2) | Container Orch (2) |
| **Monitoring** | CloudWatch (easy) | CloudWatch + metrics |
| **HTTPS** | Built-in | Via ALB (configured) |
| **Custom Domain** | Easy to add | Already configured |

---

## Recommendation Based on A3 Requirements

### For Maximum Marks & Speed: **Option 1 (API Gateway + Lambda)**

**Rationale:**
1. ✅ **Already 90% complete** - Just need to upload Lambda code
2. ✅ **No IAM blockers** - Lambda upload works via Console
3. ✅ **Serverless marks** - Gets 2/14 additional marks
4. ✅ **Fast deployment** - 15 minutes vs 45 minutes
5. ✅ **CloudFront** - Already deployed (2 marks)
6. ✅ **DLQ** - Can add easily (2 marks)
7. ✅ **Custom scaling** - Lambda auto-scales (2 marks)

**Total A3 Marks with Option 1:**
- Core: 10/10 (ASG, HTTPS, RDS, SQS)
- Additional: 12-14/14
  - Serverless (2) ✅
  - Service Communication (2) ✅
  - Custom Scaling (2) ✅
  - DLQ (2) ✅
  - MFA (2) ✅
  - CDN (2) ✅
  - Additional microservices (2) ✅

**Estimated Total: 22-24/24**

### For Production/Learning: **Option 2 (ECS)**

**Rationale:**
1. ✅ **Better performance** - No cold starts
2. ✅ **More realistic** - Industry uses containers heavily
3. ✅ **Full control** - Better for customization
4. ❌ **Blocked by permissions** - Need workaround for task defs
5. ❌ **Takes longer** - More setup and testing

---

## Hybrid Option (Best of Both Worlds)

### Architecture
```
AWS API Gateway
    ├→ Lambda: gallery-service (read operations)
    ├→ Lambda: streaming-service (streaming URLs)
    └→ ECS: video-processor (heavy transcoding)
```

**Benefits:**
- Serverless for I/O-bound operations (gallery, streaming)
- ECS for CPU-intensive operations (video processing - already done!)
- Gets marks for BOTH serverless AND containers
- Optimal cost/performance balance

---

## My Recommendation

### **Go with Option 1: API Gateway + Lambda**

**Why:**
1. **Time-efficient:** 15 minutes to completion vs 45+ minutes
2. **No blockers:** Lambda upload works, ECS task defs blocked
3. **Maximum marks:** Will achieve 22-24/24 on A3
4. **Already working:** Lambda functions tested and responding
5. **Easy to demo:** Single HTTPS endpoint, no complex setup

### Next Steps (if you choose Option 1):
1. Upload `gallery-service-lambda.zip` via Lambda Console (2 min)
2. Upload `streaming-service-lambda.zip` via Lambda Console (2 min)
3. Test API Gateway endpoints (5 min)
4. Update client to use API Gateway URL (5 min)
5. Final testing and documentation (5 min)

### Next Steps (if you choose Option 2):
1. Manually update task definitions via ECS Console (15 min)
2. Update services to use new task definitions (5 min)
3. Wait for tasks to start and stabilize (10 min)
4. Configure ALB routing to ECS services (10 min)
5. Test and debug (variable)

---

## Current Resources Summary

### Working Now ✅
- Lambda functions (both responding on Function URLs)
- Video Processor ASG (1-3 instances)
- RDS PostgreSQL
- S3 + CloudFront
- Cognito MFA
- ALB with HTTPS

### Need to Decide 🤔
- API Gateway + Lambda (15 min to complete)
- OR ECS Services (45 min to complete)

---

**Decision Time:** Which option would you like to proceed with?
