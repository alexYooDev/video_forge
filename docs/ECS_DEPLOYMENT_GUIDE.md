# ECS Deployment Guide for VideoForge Services

This guide will help you deploy the Gallery, Streaming, and API Gateway services to AWS ECS.

## Prerequisites

- ✅ Docker images pushed to ECR
- ✅ VPC with private subnets configured
- ✅ CAB432SG security group exists
- ✅ RDS database accessible from CAB432SG
- ECS cluster created
- IAM roles created (ecsTaskExecutionRole, ecsTaskRole)

## Step 1: Create CloudWatch Log Groups

Before deploying, create log groups for each service:

```bash
aws logs create-log-group --log-group-name /ecs/video-forge-gallery-service --region ap-southeast-2
aws logs create-log-group --log-group-name /ecs/video-forge-streaming-service --region ap-southeast-2
aws logs create-log-group --log-group-name /ecs/video-forge-api-gateway --region ap-southeast-2
```

## Step 2: Create ECS Cluster (if not exists)

```bash
aws ecs create-cluster --cluster-name video-forge-cluster --region ap-southeast-2
```

Or via AWS Console:
1. Go to ECS → Clusters → Create Cluster
2. Name: `video-forge-cluster`
3. Infrastructure: AWS Fargate
4. Click "Create"

## Step 3: Create Cloud Map Namespace for Service Discovery

This allows services to communicate via DNS names like `gallery-service.video-forge.local`:

```bash
# Get your VPC ID first
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=false" --query 'Vpcs[0].VpcId' --output text --region ap-southeast-2)

# Create Cloud Map namespace
aws servicediscovery create-private-dns-namespace \
  --name video-forge.local \
  --vpc $VPC_ID \
  --region ap-southeast-2
```

Save the namespace ID from the output!

## Step 4: Register Task Definitions

Register each task definition using the JSON files:

```bash
cd /Users/alexyoodev/2025/cab432/video_forge_v2/services/ecs-task-definitions

# Register gallery service
aws ecs register-task-definition \
  --cli-input-json file://gallery-service-task-def.json \
  --region ap-southeast-2

# Register streaming service
aws ecs register-task-definition \
  --cli-input-json file://streaming-service-task-def.json \
  --region ap-southeast-2

# Register API gateway
aws ecs register-task-definition \
  --cli-input-json file://api-gateway-task-def.json \
  --region ap-southeast-2
```

## Step 5: Get Your Subnet IDs

You need private subnet IDs for the ECS services:

```bash
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query 'Subnets[*].[SubnetId,CidrBlock,AvailabilityZone]' --output table --region ap-southeast-2
```

Choose 2 private subnets (ones without direct internet access).

## Step 6: Create ECS Services

### 6a. Create Gallery Service

```bash
NAMESPACE_ID="<your-namespace-id-from-step-3>"
SUBNET_1="<your-private-subnet-1>"
SUBNET_2="<your-private-subnet-2>"
SECURITY_GROUP="<CAB432SG-id>"

aws ecs create-service \
  --cluster video-forge-cluster \
  --service-name gallery-service \
  --task-definition video-forge-gallery-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SECURITY_GROUP],assignPublicIp=DISABLED}" \
  --service-registries "registryArn=arn:aws:servicediscovery:ap-southeast-2:901444280953:service/<service-id>" \
  --region ap-southeast-2
```

**Note:** You need to create a service discovery service first for the registry ARN. Or use the AWS Console which does this automatically.

### 6b. Create Streaming Service

Same as above but with:
- `--service-name streaming-service`
- `--task-definition video-forge-streaming-service`

### 6c. Create API Gateway Service with Load Balancer

The API Gateway needs to be publicly accessible, so it requires an Application Load Balancer.

## Step 7: Recommended - Use AWS Console for Easier Setup

Given the complexity of service discovery and load balancer setup via CLI, I recommend using the AWS Console:

### For Gallery and Streaming Services:

1. Go to **ECS → Clusters → video-forge-cluster → Services → Create**
2. **Compute options:** Launch type → Fargate
3. **Deployment configuration:**
   - Application type: Service
   - Task definition: Select the appropriate task definition
   - Service name: `gallery-service` or `streaming-service`
   - Desired tasks: 1
4. **Networking:**
   - VPC: Select your VPC
   - Subnets: Choose 2 **private** subnets
   - Security group: Select **CAB432SG**
   - Public IP: Turn **OFF**
5. **Service discovery:**
   - Use service discovery: **Enable**
   - Namespace: Create new → Name: `video-forge.local`
   - Service discovery name: `gallery-service` or `streaming-service`
   - DNS record type: A record
6. Click **Create**

### For API Gateway Service:

1. Follow steps 1-3 above but use `api-gateway` task definition
2. **Networking:**
   - VPC: Select your VPC
   - Subnets: Choose 2 **public** subnets (for ALB)
   - Security group: Use a public-facing security group
   - Public IP: Turn **ON**
3. **Load balancing:**
   - Load balancer type: Application Load Balancer
   - Create new load balancer: **Yes**
   - Load balancer name: `video-forge-alb`
   - Target group: Create new
   - Health check path: `/api/health`
4. **Service discovery:** Enable (same as above, name: `api-gateway`)
5. Click **Create**

## Step 8: Update API Gateway Routes

Once the services are running, you need to update the API Gateway to use HTTP requests instead of Lambda invocations.

The API Gateway environment variables `GALLERY_SERVICE_URL` and `STREAMING_SERVICE_URL` are already set to use service discovery DNS names:
- `http://gallery-service.video-forge.local:5000`
- `http://streaming-service.video-forge.local:5001`

## Step 9: Verify Services

Check that all services are running:

```bash
aws ecs list-services --cluster video-forge-cluster --region ap-southeast-2

aws ecs describe-services \
  --cluster video-forge-cluster \
  --services gallery-service streaming-service api-gateway \
  --region ap-southeast-2
```

Check service discovery:

```bash
aws servicediscovery list-services --region ap-southeast-2
```

## Step 10: Update Client to Point to ALB

Once the ALB is created, update your client application to point to the ALB DNS name instead of the EC2 instance.

## Troubleshooting

### Services not starting:
- Check CloudWatch logs: `/ecs/video-forge-<service-name>`
- Verify IAM roles have correct permissions
- Ensure security groups allow traffic between services

### Database connection issues:
- Verify CAB432SG is attached to ECS tasks
- Check RDS security group allows inbound from CAB432SG
- Verify Parameter Store / Secrets Manager values are correct

### Service discovery not working:
- Verify Cloud Map namespace was created
- Check service registration in Cloud Map console
- Ensure services are in the same VPC

## Environment Variables Checklist

Make sure these are in SSM Parameter Store or Secrets Manager:

**Parameter Store (SSM):**
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
