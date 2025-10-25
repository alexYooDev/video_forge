#!/bin/bash

# Deploy Job Service with Lambda proxy routes to ECR
set -e

AWS_REGION="ap-southeast-2"
AWS_ACCOUNT_ID="901444280953"
ECR_REPO="video-forge-job-service"
IMAGE_TAG="latest"

echo "🚀 Deploying Job Service with Lambda integration..."

# Login to ECR
echo "📦 Logging in to ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Build Docker image
echo "🔨 Building Docker image..."
docker build --platform linux/amd64 -t ${ECR_REPO}:${IMAGE_TAG} .

# Tag image for ECR
echo "🏷️  Tagging image..."
docker tag ${ECR_REPO}:${IMAGE_TAG} ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}

# Push to ECR
echo "⬆️  Pushing to ECR..."
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}

echo "✅ Job Service image pushed to ECR!"
echo "📝 Image: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"
echo ""
echo "Next steps:"
echo "1. SSH to your EC2 instance"
echo "2. Pull the new image: docker pull ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"
echo "3. Restart the container: docker-compose -f docker-compose.job-service.yml down && docker-compose -f docker-compose.job-service.yml up -d"
echo "4. Check logs: docker logs -f job-service"
