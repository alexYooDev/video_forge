#!/bin/bash

# Deploy Streaming Service to ECR
set -e

AWS_REGION="ap-southeast-2"
AWS_ACCOUNT_ID="901444280953"
ECR_REPO="video-forge-streaming-service"
IMAGE_TAG="latest"

echo "🚀 Deploying Streaming Service to ECR..."

# Create ECR repository if it doesn't exist
echo "📦 Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names ${ECR_REPO} --region ${AWS_REGION} 2>/dev/null || \
  aws ecr create-repository --repository-name ${ECR_REPO} --region ${AWS_REGION}

# Login to ECR
echo "🔐 Logging in to ECR..."
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

echo "✅ Streaming Service image pushed to ECR!"
echo "📝 Image URI: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"
