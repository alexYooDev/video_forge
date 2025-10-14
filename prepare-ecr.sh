#!/bin/bash

# ECR Preparation Script for Video Forge Production Deployment
# This script builds and pushes images to your ECR repositories

set -e

echo "🐳 Preparing ECR images for production deployment..."

# Configuration
AWS_REGION="ap-southeast-2"
AWS_ACCOUNT_ID="901444280953"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
SERVER_REPO="12159069-video-forge"
CLIENT_REPO="12159069-video-forge-client"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check AWS CLI
echo "🔧 Step 1: Checking AWS CLI..."
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI not found. Please install it first:"
    echo "  brew install awscli  # macOS"
    echo "  pip install awscli   # Python"
    exit 1
fi
print_status "AWS CLI found"

# Step 2: Authenticate Docker with ECR
echo "🔐 Step 2: Authenticating Docker with ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY
print_status "Docker authenticated with ECR"

# Step 3: Build server image
echo "🏗️  Step 3: Building server image..."
docker build -t $SERVER_REPO:latest ./server
docker tag $SERVER_REPO:latest $ECR_REGISTRY/$SERVER_REPO:latest
print_status "Server image built and tagged"

# Step 4: Build client image
echo "🏗️  Step 4: Building client image..."
docker build -t $CLIENT_REPO:latest ./client
docker tag $CLIENT_REPO:latest $ECR_REGISTRY/$CLIENT_REPO:latest
print_status "Client image built and tagged"

# Step 5: Push images to ECR
echo "⬆️  Step 5: Pushing images to ECR..."
echo "Pushing server image..."
docker push $ECR_REGISTRY/$SERVER_REPO:latest
print_status "Server image pushed to ECR"

echo "Pushing client image..."
docker push $ECR_REGISTRY/$CLIENT_REPO:latest
print_status "Client image pushed to ECR"

# Cleanup local images (optional)
read -p "🗑️  Do you want to remove local Docker images to save space? (y/N): " cleanup
if [[ $cleanup =~ ^[Yy]$ ]]; then
    docker rmi $SERVER_REPO:latest $CLIENT_REPO:latest 2>/dev/null || true
    print_status "Local images cleaned up"
fi

echo ""
print_status "ECR preparation complete!"
echo ""
echo "📋 Your ECR images:"
echo "  Server: $ECR_REGISTRY/$SERVER_REPO:latest"
echo "  Client: $ECR_REGISTRY/$CLIENT_REPO:latest"
echo ""
echo "🚀 You can now deploy using docker-compose or your preferred method"
echo "  (Note: deploy-to-ec2.sh script has been removed)"