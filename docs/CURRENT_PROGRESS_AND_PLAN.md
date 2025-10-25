# VideoForge Deployment - Current Progress & Plan

**Last Updated**: 2025-10-22
**Status**: Lambda Functions Working, Ready for Final Integration

---

## ✅ What's Been Accomplished

### 1. Lambda Functions Deployed and Working
- **Gallery Service Lambda**: `video-forge-gallery-service`
  - Function URL: `https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws`
  - Status: ✅ Working (returns 200 OK on /health)
  - Handler: `lambda-handler.handler`
  - Package: `services/gallery-service/gallery-service-lambda.zip` (11MB)

- **Streaming Service Lambda**: `video-forge-streaming-service`
  - Function URL: `https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws`
  - Status: ✅ Working (returns 200 OK on /health)
  - Handler: `lambda-handler.handler`
  - Package: `services/streaming-service/streaming-service-lambda.zip` (29MB)

### 2. Lambda Configuration
Both Lambda functions have:
- ✅ Resource-based policies allowing public Function URL access
- ✅ Updated code using `@vendia/serverless-express` (fixes routing)
- ✅ Environment variables configured (DB, S3, Cognito, etc.)
- ✅ Proper event handling for Lambda Function URL v2.0 format

### 3. Infrastructure Ready
- ✅ ECS Cluster exists: `video-forge-cluster`
- ✅ ECR repositories with Docker images pushed
- ✅ Auto Scaling Group exists: `video-forge-video-processor-asg` (currently 0,0,0)
- ✅ VPC, Security Groups, Subnets configured
- ✅ RDS Database: `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
- ✅ S3 Bucket: `video-forge-storage`
- ✅ Cognito User Pool configured

### 4. Deployment Scripts Created
- ✅ `deploy-api-gateway-ec2.sh` - Deploys API Gateway to EC2, connects to Lambda URLs
- ✅ `setup-alb-with-https.sh` - Creates ALB with HTTP/HTTPS listeners
- ⏳ `configure-video-processor-asg.sh` - Updates ASG to 1,3,1 (needs to be created)

---

## 🎯 Current Architecture

```
Internet
    ↓
[To Be Deployed] Application Load Balancer (HTTPS)
    ↓
[To Be Deployed] API Gateway (EC2 Instance - port 8000)
    ↓ (HTTP calls to Lambda Function URLs)
    ├→ ✅ Lambda: video-forge-gallery-service
    └→ ✅ Lambda: video-forge-streaming-service

[To Be Configured] Auto Scaling Group (Video Processor)
    └→ EC2 instances (0 → will be 1-3)
```

---

## 📋 Next Steps (In Order)

### Step 1: Deploy API Gateway to EC2
**Script**: `./deploy-api-gateway-ec2.sh`

**What it does**:
- Launches t3.small EC2 instance
- Installs Node.js 20 and PM2
- Deploys API Gateway application
- Configures environment variables with Lambda Function URLs
- Sets up automatic startup with PM2

**Environment variables configured**:
```
GALLERY_SERVICE_URL=https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws
STREAMING_SERVICE_URL=https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws
```

**Expected output**:
- Instance ID
- Public IP address
- Health endpoint: `http://<PUBLIC_IP>:8000/health`

**Time**: ~3-5 minutes (2 min for instance launch, 1-3 min for app initialization)

### Step 2: Test API Gateway
**Commands**:
```bash
# Wait 3-5 minutes after deployment, then:
curl http://<PUBLIC_IP>:8000/health
curl http://<PUBLIC_IP>:8000/api/health

# Test proxying to Lambda
curl http://<PUBLIC_IP>:8000/api/gallery/videos
curl http://<PUBLIC_IP>:8000/api/stream/qualities
```

### Step 3: Create Application Load Balancer
**Script**: `./setup-alb-with-https.sh`

**What it does**:
- Creates target group for API Gateway EC2 instance
- Registers EC2 instance with target group
- Creates Application Load Balancer (3 subnets, internet-facing)
- Configures HTTP listener (port 80)
- Checks for ACM certificate and adds HTTPS listener (port 443) if available
- Sets up HTTP→HTTPS redirect (if certificate exists)

**Expected output**:
- ALB DNS name: `video-forge-alb-<random>.ap-southeast-2.elb.amazonaws.com`
- Target group ARN
- Listener ARNs
- Test endpoints with ALB DNS

**Time**: ~2-3 minutes

### Step 4: Configure Video Processor Auto Scaling
**Script**: `./configure-video-processor-asg.sh` (to be created)

**What it does**:
- Updates ASG from (0,0,0) to (1,3,1)
- Creates CPU-based scaling policy (target: 70% CPU)
- Creates SQS-based scaling policy (if queue exists)
- Launches initial EC2 instance for video processing

**Expected outcome**:
- ASG maintains 1-3 instances based on load
- Automatic scaling based on CPU and/or SQS queue depth

**Time**: ~5-10 minutes (includes instance launch)

### Step 5: Test End-to-End
**Test flow**:
1. Upload video via ALB
2. Video stored in S3
3. SQS message triggers video processor
4. Processor transcodes video
5. Transcoded files stored in S3
6. Streaming service serves video via ALB

---

## 📊 A3 Marks Breakdown (Current Status)

### Core Requirements (10 marks)
- ✅ **Microservices (3 marks)** - 3 services: API Gateway, Gallery, Streaming
- ⏳ **Load Distribution (2 marks)** - ALB to be deployed
- ⏳ **Auto Scaling (3 marks)** - ASG exists, needs configuration
- ⏳ **HTTPS (2 marks)** - To be configured with ACM certificate

**Current: 3/10 marks**

### Additional Criteria (14 marks)
- ⏳ **Container Orchestration (2 marks)** - ECS services exist but not used (using Lambda instead)
- ✅ **Serverless (2 marks)** - Lambda functions working
- ⏳ **Communication (2 marks)** - API Gateway will proxy to Lambda URLs
- ⏳ **Custom Scaling Policy (2 marks)** - CPU + SQS based (to be configured)
- ❌ **Dead Letter Queue (2 marks)** - Not implemented
- ❌ **Additional Feature (2 marks)** - CloudFront or advanced monitoring

**Current: 2/14 marks**

### **Estimated after completion: 18-22/24 marks**

With all steps complete:
- Core: 8-10/10 (depends on HTTPS certificate)
- Additional: 10-12/14 (missing DLQ and additional feature)

---

## 🔧 Technical Details

### Lambda Function URLs (v2.0 Format)
Both Lambda functions handle events like:
```json
{
  "version": "2.0",
  "routeKey": "$default",
  "rawPath": "/health",
  "headers": { ... },
  "requestContext": { ... }
}
```

Handler uses `@vendia/serverless-express` to properly route to Express app.

### API Gateway Proxy Logic
```javascript
// galleryRouter.js
const targetUrl = `${GALLERY_SERVICE_URL}/api/gallery${req.path}`;
const response = await axios({
  method: req.method,
  url: targetUrl,
  // ... forwards all headers, body, params
});
```

### Environment Configuration
All services use:
- Database: `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
- S3: `video-forge-storage`
- Cognito: `ap-southeast-2_jft50FBre`
- Region: `ap-southeast-2`

---

## 📁 Important Files

### Deployment Scripts
- `deploy-api-gateway-ec2.sh` - Deploy API Gateway to EC2
- `setup-alb-with-https.sh` - Create ALB with HTTPS
- `configure-video-processor-asg.sh` - Configure ASG (to be created)

### Lambda Packages
- `services/gallery-service/gallery-service-lambda.zip` (11MB)
- `services/streaming-service/streaming-service-lambda.zip` (29MB)

### Documentation
- `DEPLOYMENT_STATUS.md` - Overall deployment status
- `LAMBDA_DEPLOYMENT_FINAL.md` - Lambda deployment guide
- `LAMBDA_TESTING_PLAN.md` - Lambda testing instructions
- `ADD_LAMBDA_PERMISSION_GUIDE.md` - How to add Lambda permissions
- `UPDATE_LAMBDA_CODE_GUIDE.md` - How to update Lambda code

### Configuration Files
- `services/.env.local` - Local environment variables
- `.env.local.template` - Template for environment variables

---

## 🚨 Known Issues & Constraints

### IAM Permission Limitations
**Cannot do**:
- Register/update ECS task definitions
- Create Service Discovery namespaces
- Access CloudWatch Logs via CLI (can view in Console)
- Update Lambda code via CLI (can upload via Console)

**Can do**:
- Create EC2 instances
- Create ALB and target groups
- Update ASG configuration
- Upload Lambda code via Console
- Add Lambda resource-based policies via Console

### Current Blockers
1. ❌ ECS task definitions outdated (missing env vars) - can't update due to permissions
2. ✅ Lambda functions working (updated via Console)
3. ⏳ API Gateway not yet deployed
4. ⏳ ALB not yet created
5. ⏳ ASG at 0 capacity

---

## 🎓 Lessons Learned

### Lambda Function URLs
- Need resource-based policy for public access even with `AuthType: NONE`
- `@vendia/serverless-express` handles v2.0 format properly
- `aws-serverless-express` loses path information (use Vendia instead)

### Event Handling
- Lambda Function URL v2.0 uses `rawPath` not `path`
- Must wrap `serverlessExpress({ app })` and call it in handler
- DB initialization should be lazy (avoid cold start delays)

### Deployment Strategy
- Lambda Function URLs bypass IAM permission issues (just HTTP calls!)
- EC2 can call Lambda URLs without `lambda:InvokeFunction` permission
- ALB can route to EC2 target groups easily
- This architecture works within student IAM constraints

---

## 🔄 Alternative Approaches (Not Chosen)

### Option A: Pure ECS (Blocked)
- **Issue**: Can't register task definitions (permission denied)
- **Blockers**: Need `ecs:RegisterTaskDefinition` permission

### Option B: Lambda with API Gateway REST API
- **Issue**: Requires `apigateway:*` permissions
- **Complexity**: More setup than Function URLs

### Option C: EC2-only with docker-compose
- **Works**: Yes, no permission issues
- **Drawback**: Loses serverless marks (2 marks)

### ✅ **Chosen: EC2 API Gateway + Lambda Function URLs**
- Works within IAM constraints
- Gets serverless marks
- Simple HTTP proxying (no AWS SDK needed)
- Easy to test and debug

---

## 📞 Quick Reference

### Lambda Function URLs
```bash
# Gallery Service
curl https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws/health

# Streaming Service
curl https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws/health
```

### AWS Resources
```bash
# Region
ap-southeast-2

# VPC
vpc-007bab53289655834

# Security Group
sg-032bd1ff8cf77dbb9

# Subnets
subnet-04cc288ea3b2e1e53  # 2a
subnet-08e89ff0d9b49c9ae  # 2b
subnet-05d0352bb15852524  # 2c

# ECS Cluster
video-forge-cluster

# ASG
video-forge-video-processor-asg

# Key Pair
CAB432
```

### Useful Commands
```bash
# Check Lambda status
aws lambda get-function --function-name video-forge-gallery-service --region ap-southeast-2

# Check EC2 instances
aws ec2 describe-instances --filters "Name=tag:Service,Values=api-gateway" --region ap-southeast-2

# Check ASG status
aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names video-forge-video-processor-asg --region ap-southeast-2

# Check ALB status
aws elbv2 describe-load-balancers --region ap-southeast-2
```

---

## ✅ Ready to Continue

**Current state**: Lambda functions working, deployment scripts created, ready to deploy API Gateway and ALB.

**Next action**: Run `./deploy-api-gateway-ec2.sh` to deploy API Gateway to EC2.

**Expected completion time**: 15-20 minutes total
- API Gateway deployment: 5 minutes
- ALB setup: 3 minutes
- ASG configuration: 5 minutes
- Testing: 5 minutes

**Final architecture will achieve**: 18-22/24 marks on A3
