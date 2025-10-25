# VideoForge Quick Deployment Guide

This is a simplified deployment guide using existing AWS resources (IAM roles, security groups).

## Existing Resources
- **IAM Roles:**
  - ECS Execution: `ecsTaskExecutionRole`
  - ECS Task: `Task-Role-CAB432-ECS`
  - EC2 Instance Profile: `CAB432-Instance-Role`
- **Security Groups:**
  - API/Web: `CAB432SG` (sg-032bd1ff8cf77dbb9)
  - Database: `CAB432DBSG` (sg-0dcf6e18faf2c4d41)
  - SSH: `CAB432-SelfManaged-SSHAccess` (sg-0daf3e53dde7cae15)

## Step 1: Build and Push Docker Images

Start Docker Desktop, then:

```bash
cd services
./deploy-to-ecr.sh
```

## Step 2: Create CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name /ecs/video-forge-api-gateway
aws logs create-log-group --log-group-name /ec2/video-forge-video-processor
```

## Step 3: Deploy API Gateway on ECS

### Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name video-forge-cluster
```

### Register Task Definition

```bash
cd api-gateway
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json
```

### Get VPC and Subnet Info

```bash
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text)
SUBNET_IDS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text | tr '\t' ',')

echo "VPC ID: $VPC_ID"
echo "Subnet IDs: $SUBNET_IDS"
```

### Create ECS Service

Use existing security group `CAB432SG`:

```bash
aws ecs create-service \
  --cluster video-forge-cluster \
  --service-name api-gateway-service \
  --task-definition video-forge-api-gateway \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[sg-032bd1ff8cf77dbb9],assignPublicIp=ENABLED}"
```

### Get API Gateway URL

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
echo "Health check: curl http://$PUBLIC_IP:8000/api/health"
```

## Step 4: Deploy Video Processor on EC2

### Launch EC2 Instance

Use existing instance profile `CAB432-Instance-Role`:

```bash
cd ../video-processor

# Get latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

# Launch instance with existing resources
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t3.medium \
  --security-group-ids sg-032bd1ff8cf77dbb9 \
  --iam-instance-profile Name=CAB432-Instance-Role \
  --user-data file://ec2-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=video-forge-processor}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "EC2 Instance ID: $INSTANCE_ID"
```

### Wait and Get Instance Details

```bash
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
echo "Instance is running"

aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].[PublicIpAddress,PrivateIpAddress,State.Name]' \
  --output table
```

### Monitor Logs

Wait ~5 minutes for Docker and application setup:

```bash
aws logs tail /ec2/video-forge-video-processor --follow
```

## Step 5: Test End-to-End

1. Update client to use new API Gateway URL
2. Create a test job:

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

## Quick Commands

### View ECS Service Status

```bash
aws ecs describe-services \
  --cluster video-forge-cluster \
  --services api-gateway-service \
  --query 'services[0].[serviceName,status,runningCount,desiredCount]' \
  --output table
```

### View EC2 Instance Status

```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=video-forge-processor" \
  --query 'Reservations[0].Instances[0].[InstanceId,State.Name,PublicIpAddress]' \
  --output table
```

### Check SQS Queue

```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue \
  --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible \
  --query 'Attributes' \
  --output table
```

## Cleanup

```bash
# Stop ECS Service
aws ecs update-service \
  --cluster video-forge-cluster \
  --service api-gateway-service \
  --desired-count 0

aws ecs delete-service \
  --cluster video-forge-cluster \
  --service api-gateway-service \
  --force

# Delete Cluster
aws ecs delete-cluster --cluster video-forge-cluster

# Terminate EC2
aws ec2 terminate-instances --instance-ids $INSTANCE_ID
```

## Troubleshooting

### ECS Task Fails to Start

Check logs and task definition:

```bash
aws logs tail /ecs/video-forge-api-gateway
aws ecs describe-task-definition --task-definition video-forge-api-gateway
```

### EC2 Instance Not Processing Jobs

SSH into instance:

```bash
EC2_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

ssh -i YOUR_KEY.pem ec2-user@$EC2_IP

# Check Docker status
sudo docker ps
sudo systemctl status video-processor
sudo journalctl -u video-processor -f
```

### SQS Messages Not Being Consumed

Check that both services can access SQS:

```bash
# Test from local machine
aws sqs receive-message \
  --queue-url https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue
```

Check IAM role has SQS permissions attached.
