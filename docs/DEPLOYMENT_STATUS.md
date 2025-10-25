# VideoForge Deployment Status Report

## Executive Summary

Attempted to deploy VideoForge microservices to AWS using ECS, Lambda, and Auto Scaling Groups. Encountered multiple IAM permission constraints that block critical operations. This document summarizes the current state and identifies blockers.

## Current Deployment State

### ✅ Successfully Completed

1. **Docker Images Built and Pushed to ECR**
   - `video-forge-api-gateway:latest` ✓
   - `video-forge-gallery-service:latest` ✓
   - `video-forge-streaming-service:latest` ✓
   - All images successfully pushed to ECR registry: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com`

2. **Lambda Functions Deployed**
   - `video-forge-gallery-service` - Function exists with Function URL
   - `video-forge-streaming-service` - Function exists with Function URL
   - Function URLs:
     - Gallery: `https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/`
     - Streaming: `https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/`

3. **Auto Scaling Group Created**
   - `video-forge-video-processor-asg` exists
   - Current state: Min=0, Max=0, Desired=0
   - Needs scaling configuration update

4. **ECS Infrastructure Exists**
   - Cluster: `video-forge-cluster` ✓
   - Services created:
     - `video-forge-gallery-service-service-v24pef3w`
     - `video-forge-streaming-service-service-ivo8hq2q`
     - `video-forge-api-gateway-service-eqc8ujb0`
   - Task Definitions exist (but are outdated)

### ❌ Current Blockers

#### 1. IAM Permission Constraints

**Unable to Register/Update ECS Task Definitions**
```
AccessDeniedException: User is not authorized to perform: ecs:RegisterTaskDefinition
with an explicit deny in an identity-based policy
```

**Impact**: Cannot update task definitions with required environment variables (database credentials, S3 bucket, Cognito config, etc.)

**Unable to Access CloudWatch Logs**
```
AccessDeniedException: User is not authorized to perform: logs:FilterLogEvents
```

**Impact**: Cannot debug why ECS tasks are failing or Lambda functions are returning 403

**Unable to Create Service Discovery Namespace**
```
AccessDeniedException: User is not authorized to perform: servicediscovery:CreatePrivateDnsNamespace
```

**Impact**: Cannot enable service-to-service discovery for microservices communication

#### 2. ECS Services Failing to Run

**Current Status:**
- Gallery Service: FAILED deployment, 0/1 running tasks
- Streaming Service: FAILED deployment, 0/1 running tasks
- API Gateway: IN_PROGRESS, 0/2 running tasks

**Root Cause**: Existing task definitions only have 3 environment variables:
- `NODE_ENV=production`
- `PORT=[5000|5001|8000]`
- `AWS_REGION=ap-southeast-2`

**Missing Required Environment Variables:**
- Database: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- AWS: `S3_BUCKET_NAME`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
- Security: `JWT_SECRET`
- Service URLs: `GALLERY_SERVICE_URL`, `STREAMING_SERVICE_URL` (for API Gateway)

**Stopped Tasks**: Container exit code 1 (application crash due to missing configuration)

#### 3. Lambda Functions Not Accessible

**Status**: Both Lambda functions return HTTP 403 Forbidden

**Root Cause**: Lambda Function URLs have `AuthType: NONE` but still return 403, indicating:
- Resource policy may be blocking public access
- Lambda functions may have internal authentication requirements
- Functions may be crashing due to missing environment variables

## What Was Attempted

1. ✅ Built all 3 microservices as Docker containers
2. ✅ Pushed images to ECR
3. ❌ Tried to deploy using ECS with Service Discovery (blocked by permissions)
4. ❌ Tried to deploy using ECS without Service Discovery (task definitions can't be updated)
5. ✅ Created Lambda Function URLs for gallery and streaming services
6. ❌ Lambda functions return 403 (likely missing environment variables or permissions)
7. ✅ Forced redeployment of existing ECS services
8. ❌ Services fail due to outdated task definitions

## Next Steps (Requires Permission Changes)

### Option 1: Request IAM Permission Updates

Request the following permissions be added to student role:

```json
{
  "Effect": "Allow",
  "Action": [
    "ecs:RegisterTaskDefinition",
    "ecs:DeregisterTaskDefinition",
    "logs:FilterLogEvents",
    "logs:GetLogEvents",
    "servicediscovery:CreatePrivateDnsNamespace",
    "servicediscovery:CreateService"
  ],
  "Resource": "*"
}
```

### Option 2: Use Existing Infrastructure

If permissions cannot be changed:

1. **Update Lambda Functions Manually via AWS Console**
   - Add all required environment variables
   - Test Lambda Function URLs
   - If working, deploy API Gateway to EC2 and configure to call Lambda URLs

2. **Update Video Processor ASG**
   - Scale ASG to Min=1, Max=3, Desired=1
   - Verify SQS integration is working

3. **Deploy API Gateway to EC2 Instead**
   - Use existing EC2 instance (if available)
   - Configure to proxy requests to Lambda Function URLs
   - Set up Application Load Balancer for HTTPS

### Option 3: Simplified EC2 Deployment

Deploy all 3 services to a single EC2 instance:
- Use docker-compose on EC2
- Put ALB in front
- Loses container orchestration benefits but would work within constraints

## A3 Requirements Analysis

### Current Score Estimate: 10-14 / 24

**Core Requirements (10 marks total):**
- ✅ Microservices (3 marks) - 3 services designed
- ⚠️ Load Distribution (2 marks) - ALB not yet configured
- ⚠️ Auto Scaling (3 marks) - ASG exists but not configured
- ⚠️ HTTPS (2 marks) - Not configured

**Additional Criteria (14 marks total):**
- ⚠️ Container Orchestration (2 marks) - ECS services exist but not running
- ✅ Serverless (2 marks) - Lambda functions deployed
- ❌ Communication (2 marks) - Services can't communicate yet
- ❌ Custom Scaling Policy (2 marks) - ASG not configured
- ❌ Dead Letter Queue (2 marks) - Not implemented
- ❌ Additional feature (2 marks) - CloudFront or HTTPS needed

**Best Case with Current Constraints**:
- If Lambda functions can be made to work: ~16/24
- If ECS services can be fixed: ~20/24
- If both + ALB + HTTPS: ~24/24

## Infrastructure Details

### ECR Repositories
```
901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-api-gateway
901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-gallery-service
901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-streaming-service
```

### ECS Cluster
- Name: `video-forge-cluster`
- Region: `ap-southeast-2`

### Lambda Functions
- `video-forge-gallery-service` (nodejs22.x)
- `video-forge-streaming-service` (nodejs22.x)

### Auto Scaling Group
- `video-forge-video-processor-asg`

### Database
- Host: `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
- Database: `cohort_2025`
- User: `s458`

### S3 Bucket
- `video-forge-storage`

### Cognito
- User Pool ID: `ap-southeast-2_jft50FBre`
- Client ID: `59ff9f0j33qp7al3vje4j4isc0`

## Recommendations

1. **Immediate**: Request IAM permissions to register ECS task definitions
2. **Alternative**: Manually update Lambda function environment variables via Console
3. **Fallback**: Deploy to EC2 with docker-compose if AWS-native deployment is blocked

---

**Generated**: 2025-10-22
**Status**: Blocked by IAM permissions
