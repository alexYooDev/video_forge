# VideoForge AWS Deployment Guide

This guide covers deploying the VideoForge microservices to AWS using ECS (API Gateway) and EC2 (Video Processor).

## Prerequisites

1. AWS CLI configured with credentials
2. Docker Desktop installed and running
3. AWS account with appropriate IAM permissions
4. ECR repositories created (already done)

## Architecture Overview

- **API Gateway**: Deployed on ECS Fargate (serverless containers)
- **Video Processor**: Deployed on EC2 (dedicated compute for FFmpeg)
- **Communication**: SQS queue `video-forge-video-processing-queue`

## Step 1: Build and Push Docker Images

```bash
cd services
./deploy-to-ecr.sh
```

This script will:
- Login to ECR
- Build Docker images for both services
- Tag images with `latest` and `v1.0.0`
- Push to ECR repositories

**Verify:**
```bash
aws ecr describe-images --repository-name video-forge-api-gateway
aws ecr describe-images --repository-name video-forge-video-processor
```

## Step 2: Create IAM Roles

### ECS Task Execution Role (if not exists)

```bash
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

### ECS Task Role for API Gateway

```bash
aws iam create-role \
  --role-name VideoForgeECSTaskRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach necessary policies
aws iam attach-role-policy \
  --role-name VideoForgeECSTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-role-policy \
  --role-name VideoForgeECSTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess

aws iam attach-role-policy \
  --role-name VideoForgeECSTaskRole \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

aws iam attach-role-policy \
  --role-name VideoForgeECSTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess
```

### EC2 Instance Role for Video Processor

```bash
aws iam create-role \
  --role-name VideoForgeEC2Role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach necessary policies
aws iam attach-role-policy \
  --role-name VideoForgeEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-role-policy \
  --role-name VideoForgeEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSQSFullAccess

aws iam attach-role-policy \
  --role-name VideoForgeEC2Role \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

aws iam attach-role-policy \
  --role-name VideoForgeEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMReadOnlyAccess

aws iam attach-role-policy \
  --role-name VideoForgeEC2Role \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchLogsFullAccess

aws iam attach-role-policy \
  --role-name VideoForgeEC2Role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly

# Create instance profile
aws iam create-instance-profile --instance-profile-name VideoForgeEC2Profile
aws iam add-role-to-instance-profile \
  --instance-profile-name VideoForgeEC2Profile \
  --role-name VideoForgeEC2Role
```

## Step 3: Create CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name /ecs/video-forge-api-gateway
aws logs create-log-group --log-group-name /ec2/video-forge-video-processor
```

## Step 4: Deploy API Gateway on ECS

### Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name video-forge-cluster
```

### Register Task Definition

```bash
cd api-gateway
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
```

### Create ECS Service

First, get your VPC and subnet information:

```bash
# Get default VPC ID
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)

# Get subnet IDs
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text | tr '\t' ',')

echo "VPC ID: $VPC_ID"
echo "Subnet IDs: $SUBNET_IDS"
```

Create a security group for the API Gateway:

```bash
SG_ID=$(aws ec2 create-security-group \
  --group-name video-forge-api-gateway-sg \
  --description "Security group for VideoForge API Gateway" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow inbound traffic on port 8000
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 8000 \
  --cidr 0.0.0.0/0

# Allow outbound traffic (default, but explicit)
aws ec2 authorize-security-group-egress \
  --group-id $SG_ID \
  --protocol -1 \
  --cidr 0.0.0.0/0

echo "Security Group ID: $SG_ID"
```

Create the ECS service:

```bash
aws ecs create-service \
  --cluster video-forge-cluster \
  --service-name api-gateway-service \
  --task-definition video-forge-api-gateway \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[$SG_ID],assignPublicIp=ENABLED}"
```

**Verify deployment:**

```bash
aws ecs describe-services \
  --cluster video-forge-cluster \
  --services api-gateway-service
```

Get the public IP:

```bash
TASK_ARN=$(aws ecs list-tasks \
  --cluster video-forge-cluster \
  --service-name api-gateway-service \
  --query 'taskArns[0]' \
  --output text)

ENI_ID=$(aws ecs describe-tasks \
  --cluster video-forge-cluster \
  --tasks $TASK_ARN \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)

PUBLIC_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids $ENI_ID \
  --query 'NetworkInterfaces[0].Association.PublicIp' \
  --output text)

echo "API Gateway URL: http://$PUBLIC_IP:8000"
```

Test the API:

```bash
curl http://$PUBLIC_IP:8000/api/health
```

## Step 5: Deploy Video Processor on EC2

### Create Security Group for EC2

```bash
EC2_SG_ID=$(aws ec2 create-security-group \
  --group-name video-forge-video-processor-sg \
  --description "Security group for VideoForge Video Processor" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow SSH (optional, for debugging)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

echo "EC2 Security Group ID: $EC2_SG_ID"
```

### Launch EC2 Instance

```bash
cd ../video-processor

# Get latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

# Launch instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.medium \
  --security-group-ids $EC2_SG_ID \
  --iam-instance-profile Name=VideoForgeEC2Profile \
  --user-data file://ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=video-forge-processor}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "EC2 Instance ID: $INSTANCE_ID"
```

**Wait for instance to be running:**

```bash
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
echo "Instance is running"
```

**Get instance details:**

```bash
aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].[PublicIpAddress,PrivateIpAddress,State.Name]' \
  --output table
```

**Monitor logs (wait ~5 minutes for setup):**

```bash
aws logs tail /ec2/video-forge-video-processor --follow
```

## Step 6: Verify End-to-End Processing

1. Get the API Gateway public IP from Step 4
2. Create a job via the client or curl:

```bash
curl -X POST http://$PUBLIC_IP:8000/api/jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputSource": "sample",
    "formats": ["720p"]
  }'
```

3. Monitor processing:

```bash
# API Gateway logs
aws logs tail /ecs/video-forge-api-gateway --follow

# Video Processor logs
aws logs tail /ec2/video-forge-video-processor --follow
```

## Monitoring and Management

### View all resources

```bash
# ECS Service
aws ecs describe-services --cluster video-forge-cluster --services api-gateway-service

# EC2 Instance
aws ec2 describe-instances --filters "Name=tag:Name,Values=video-forge-processor"

# SQS Queue
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue \
  --attribute-names All
```

### Scale ECS Service

```bash
aws ecs update-service \
  --cluster video-forge-cluster \
  --service api-gateway-service \
  --desired-count 2
```

### Update Images

After pushing new images to ECR:

```bash
# Force new deployment
aws ecs update-service \
  --cluster video-forge-cluster \
  --service api-gateway-service \
  --force-new-deployment
```

For EC2:

```bash
# SSH into instance
EC2_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

ssh ec2-user@$EC2_IP

# On instance
sudo systemctl stop video-processor
docker pull 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-video-processor:latest
sudo systemctl start video-processor
```

## Cleanup

To tear down all resources:

```bash
# Delete ECS Service
aws ecs update-service \
  --cluster video-forge-cluster \
  --service api-gateway-service \
  --desired-count 0

aws ecs delete-service \
  --cluster video-forge-cluster \
  --service api-gateway-service \
  --force

# Delete ECS Cluster
aws ecs delete-cluster --cluster video-forge-cluster

# Terminate EC2 Instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Delete Security Groups (wait for resources to be deleted first)
aws ec2 delete-security-group --group-id $SG_ID
aws ec2 delete-security-group --group-id $EC2_SG_ID

# Delete Log Groups
aws logs delete-log-group --log-group-name /ecs/video-forge-api-gateway
aws logs delete-log-group --log-group-name /ec2/video-forge-video-processor
```

## Troubleshooting

### ECS Task not starting

```bash
# Check task status
aws ecs describe-tasks \
  --cluster video-forge-cluster \
  --tasks $TASK_ARN

# Check logs
aws logs tail /ecs/video-forge-api-gateway
```

### EC2 Instance issues

```bash
# Check instance status
aws ec2 describe-instance-status --instance-ids $INSTANCE_ID

# Get system log
aws ec2 get-console-output --instance-id $INSTANCE_ID
```

### Jobs not processing

```bash
# Check SQS messages
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible

# Check video processor logs
aws logs tail /ec2/video-forge-video-processor --follow
```

## Cost Estimates

- **ECS Fargate** (API Gateway): ~$0.04/hour (512 CPU, 1GB RAM)
- **EC2 t3.medium** (Video Processor): ~$0.05/hour
- **Data Transfer**: Varies based on usage
- **Total**: ~$65/month for 24/7 operation

Consider stopping the video processor when not in use to save costs.
