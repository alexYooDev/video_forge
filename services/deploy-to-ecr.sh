#!/bin/bash
# Deploy Docker images to ECR
# Run this script after starting Docker Desktop

set -e

# Configuration
AWS_REGION="ap-southeast-2"
AWS_ACCOUNT_ID="901444280953"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
API_GATEWAY_REPO="video-forge-api-gateway"
VIDEO_PROCESSOR_REPO="video-forge-video-processor"

echo "=== VideoForge ECR Deployment ==="
echo "Region: ${AWS_REGION}"
echo "Account: ${AWS_ACCOUNT_ID}"
echo ""

# Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Build and push API Gateway
echo ""
echo "=== Building API Gateway ==="
cd api-gateway
docker build -t ${API_GATEWAY_REPO}:latest .
docker tag ${API_GATEWAY_REPO}:latest ${ECR_REGISTRY}/${API_GATEWAY_REPO}:latest
docker tag ${API_GATEWAY_REPO}:latest ${ECR_REGISTRY}/${API_GATEWAY_REPO}:v1.0.0

echo "Pushing API Gateway to ECR..."
docker push ${ECR_REGISTRY}/${API_GATEWAY_REPO}:latest
docker push ${ECR_REGISTRY}/${API_GATEWAY_REPO}:v1.0.0

echo "✅ API Gateway image pushed successfully"
cd ..

# Build and push Video Processor
echo ""
echo "=== Building Video Processor ==="
cd video-processor
docker build -t ${VIDEO_PROCESSOR_REPO}:latest .
docker tag ${VIDEO_PROCESSOR_REPO}:latest ${ECR_REGISTRY}/${VIDEO_PROCESSOR_REPO}:latest
docker tag ${VIDEO_PROCESSOR_REPO}:latest ${ECR_REGISTRY}/${VIDEO_PROCESSOR_REPO}:v1.0.0

echo "Pushing Video Processor to ECR..."
docker push ${ECR_REGISTRY}/${VIDEO_PROCESSOR_REPO}:latest
docker push ${ECR_REGISTRY}/${VIDEO_PROCESSOR_REPO}:v1.0.0

echo "✅ Video Processor image pushed successfully"
cd ..

echo ""
echo "=== Deployment Complete ==="
echo "API Gateway: ${ECR_REGISTRY}/${API_GATEWAY_REPO}:latest"
echo "Video Processor: ${ECR_REGISTRY}/${VIDEO_PROCESSOR_REPO}:latest"
echo ""
echo "Next steps:"
echo "1. Create ECS cluster and task definition for API Gateway"
echo "2. Launch EC2 instance for Video Processor"
echo "3. Configure security groups and IAM roles"
