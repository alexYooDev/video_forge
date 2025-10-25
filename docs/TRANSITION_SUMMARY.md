# VideoForge: Lambda to ECS Transition Summary

## What We've Accomplished

### 1. ✅ Identified Issues with Lambda Deployment
- Lambda functions in VPC couldn't access Secrets Manager (ETIMEDOUT after 47s)
- EC2 instance role lacked `lambda:InvokeFunction` permissions
- Double `/api/api` routing issue in frontend

### 2. ✅ Created Docker Images for All Services
Built and pushed to ECR:
- **Gallery Service:** `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-gallery-service:latest`
- **Streaming Service:** `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-streaming-service:latest`
- **API Gateway:** `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-api-gateway:latest`

### 3. ✅ Updated API Gateway Architecture
**Before:** API Gateway → Lambda SDK → Lambda Functions
**After:** API Gateway → HTTP/Axios → ECS Services

Changed from Lambda invocation to HTTP proxy pattern:
```javascript
// Old: Lambda SDK
const lambda = new LambdaClient();
const command = new InvokeCommand({ FunctionName: '...' });

// New: HTTP with axios
const response = await axios({
  method: req.method,
  url: `${SERVICE_URL}/api/gallery${req.path}`,
  ...
});
```

### 4. ✅ Fixed Frontend Double API Prefix Issue
Updated all frontend API calls to remove duplicate `/api` prefix:
- `/api/gallery/videos` → `/gallery/videos` (axios baseURL already includes `/api`)

### 5. ✅ Created ECS Infrastructure Files
Generated:
- Task definition JSONs for all 3 services
- Comprehensive deployment guide with step-by-step instructions
- Service discovery configuration (Cloud Map namespace: `video-forge.local`)

## Architecture Overview

```
┌─────────────────┐
│   Client App    │
│   (Nginx/React) │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────────────┐
│  Application Load       │
│  Balancer (ALB)         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  ECS: API Gateway       │  Port 8000
│  (video-forge-cluster)  │
└────┬────────────────────┘
     │
     ├──────────────────────┐
     │                      │
     ▼                      ▼
┌──────────────┐   ┌──────────────────┐
│ ECS: Gallery │   │ ECS: Streaming   │
│ Service      │   │ Service          │
│ Port 5000    │   │ Port 5001        │
└──────┬───────┘   └──────┬───────────┘
       │                  │
       └──────────┬───────┘
                  │
                  ▼
         ┌────────────────┐
         │  RDS PostgreSQL │
         │  (via CAB432SG) │
         └────────────────┘
```

## Service Communication

Services communicate via **AWS Cloud Map (Service Discovery)**:
- Gallery Service: `http://gallery-service.video-forge.local:5000`
- Streaming Service: `http://streaming-service.video-forge.local:5001`
- API Gateway: `http://api-gateway.video-forge.local:8000`

## Security Configuration

All ECS tasks must use:
- **VPC:** Your existing VPC
- **Subnets:** Private subnets (for gallery/streaming), Public subnets (for ALB)
- **Security Group:** **CAB432SG** (allows access to RDS)
- **Task Execution Role:** `ecsTaskExecutionRole` (for ECR pulls, CloudWatch logs)
- **Task Role:** `ecsTaskRole` (for AWS service access: S3, Secrets Manager, SSM)

## Environment Variables

All services read from:

**SSM Parameter Store:**
- `/video-forge/database/host`
- `/video-forge/database/port`
- `/video-forge/database/name`
- `/video-forge/database/user`
- `/video-forge/database/secret-arn`
- `/video-forge/s3/bucket-name`
- `/video-forge/redis/host`
- `/video-forge/redis/port`

**Secrets Manager:**
- `/video-forge/database/postgres-password`
- `/video-forge/auth/jwt-secret`

## Next Steps

### 1. Deploy to ECS (Manual via AWS Console - Recommended)

Follow the detailed instructions in `ECS_DEPLOYMENT_GUIDE.md`:

**For Gallery & Streaming Services:**
1. Create ECS service with Fargate
2. Use private subnets
3. Attach CAB432SG security group
4. Enable service discovery (video-forge.local namespace)
5. Set desired count to 1

**For API Gateway:**
1. Create ECS service with Fargate
2. Use public subnets (for ALB)
3. Create Application Load Balancer
4. Health check path: `/api/health`
5. Enable service discovery

### 2. Verify Deployment

Check services are running:
```bash
aws ecs describe-services \
  --cluster video-forge-cluster \
  --services gallery-service streaming-service api-gateway \
  --region ap-southeast-2
```

Check CloudWatch logs:
- `/ecs/video-forge-gallery-service`
- `/ecs/video-forge-streaming-service`
- `/ecs/video-forge-api-gateway`

### 3. Update Client

Point your client (Nginx/React) to the ALB DNS name instead of EC2 instance.

### 4. Test End-to-End

1. Navigate to gallery page
2. Verify videos load successfully
3. Test video playback via streaming service
4. Check CloudWatch logs for any errors

## Benefits of ECS over Lambda

✅ **No VPC networking issues** - ECS containers have persistent network connections
✅ **No IAM permission complications** - Services communicate via HTTP
✅ **Direct RDS access** - CAB432SG security group allows database connections
✅ **No cold starts** - Containers stay warm
✅ **Simpler debugging** - Standard Docker logs via CloudWatch
✅ **Cost predictable** - Pay for running containers, not invocations
✅ **No 15-minute Lambda timeout** - Long-running requests supported

## Files Created

### Docker & Deployment
- `services/gallery-service/Dockerfile`
- `services/gallery-service/deploy-to-ecr.sh`
- `services/streaming-service/Dockerfile`
- `services/streaming-service/deploy-to-ecr.sh`

### ECS Configuration
- `services/ecs-task-definitions/gallery-service-task-def.json`
- `services/ecs-task-definitions/streaming-service-task-def.json`
- `services/ecs-task-definitions/api-gateway-task-def.json`
- `services/ecs-task-definitions/ECS_DEPLOYMENT_GUIDE.md`
- `services/ecs-task-definitions/TRANSITION_SUMMARY.md` (this file)

### Updated Code
- `services/api-gateway/src/routes/galleryRouter.js` (Lambda SDK → axios)
- `services/api-gateway/src/routes/streamingRouter.js` (Lambda SDK → axios)
- `client/src/components/jobs/VideoGallery.jsx` (fixed `/api/api` issue)
- `client/src/components/jobs/VideoDetail.jsx` (fixed `/api/api` issue)
- `client/src/components/jobs/VideoPlayer.jsx` (fixed `/api/api` issue)

## Rollback Plan (if needed)

If ECS deployment has issues, you can rollback to EC2:
1. Keep existing EC2 instance with docker-compose setup
2. Update docker-compose.yml to include gallery and streaming services
3. Deploy all services on EC2 together

## Questions or Issues?

Check the deployment guide or AWS CloudWatch logs for troubleshooting steps.
