#!/bin/bash

# VideoForge ECR Deployment Script
# This script builds and pushes Docker images to Amazon ECR

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-ap-southeast-2}  # Default to Sydney region
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
PROJECT_NAME="videoforge"

echo -e "${BLUE}VideoForge ECR Deployment${NC}"
echo -e "${BLUE}=============================${NC}"
echo ""

# Check if AWS Account ID is provided
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}AWS_ACCOUNT_ID environment variable is required${NC}"
    echo "Please set it with: export AWS_ACCOUNT_ID=your-account-id"
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed${NC}"
    echo "Please install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED} Docker is not running${NC}"
    exit 1
fi

echo -e "${BLUE}Deployment Configuration:${NC}"
echo "AWS Region: $AWS_REGION"
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo "ECR Registry: $ECR_REGISTRY"
echo ""

# Function to create ECR repository if it doesn't exist
create_ecr_repo() {
    local repo_name=$1
    echo -e "${BLUE}Creating ECR repository: ${repo_name}${NC}"
    
    if aws ecr describe-repositories --repository-names $repo_name --region $AWS_REGION > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Repository $repo_name already exists${NC}"
    else
        aws ecr create-repository \
            --repository-name $repo_name \
            --region $AWS_REGION \
            --image-scanning-configuration scanOnPush=true
        echo -e "${GREEN}Repository $repo_name created${NC}"
    fi
}

# Function to build and push image
build_and_push() {
    local service_name=$1
    local dockerfile_path=$2
    local context_path=$3
    local repo_name="${PROJECT_NAME}-${service_name}"
    local image_tag="latest"
    local full_image_name="${ECR_REGISTRY}/${repo_name}:${image_tag}"
    
    echo -e "${BLUE} Building ${service_name} image...${NC}"
    
    # Build the Docker image
    docker build -t $repo_name:$image_tag -f $dockerfile_path $context_path
    
    # Tag for ECR
    docker tag $repo_name:$image_tag $full_image_name
    
    echo -e "${BLUE}Pushing ${service_name} to ECR...${NC}"
    
    # Push to ECR
    docker push $full_image_name
    
    echo -e "${GREEN} ${service_name} pushed successfully${NC}"
    echo "Image URI: $full_image_name"
    echo ""
}

# Authenticate Docker with ECR
echo -e "${BLUE}Authenticating with ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

if [ $? -eq 0 ]; then
    echo -e "${GREEN}ECR authentication successful${NC}"
else
    echo -e "${RED}ECR authentication failed${NC}"
    exit 1
fi

echo ""

# Create ECR repositories
create_ecr_repo "${PROJECT_NAME}-server"
create_ecr_repo "${PROJECT_NAME}-client"

echo ""

# Build and push server image
echo -e "${BLUE}Building and pushing server image...${NC}"
build_and_push "server" "./server/Dockerfile" "./server"

# Build and push client image  
echo -e "${BLUE}Building and pushing client image...${NC}"
build_and_push "client" "./client/Dockerfile" "./client"

# Generate docker-compose file for ECR deployment
echo -e "${BLUE}Generating ECR docker-compose file...${NC}"

cat > docker-compose.ecr.yml << EOF
version: '3.8'

services:
  database:
    image: mariadb:10.11
    container_name: videoforge_db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${DB_ROOT_PASSWORD:-rootpassword}
      MYSQL_DATABASE: \${DB_NAME:-video_forge}
      MYSQL_USER: \${DB_USER:-video_user}
      MYSQL_PASSWORD: \${DB_PASSWORD:-videopassword}
    volumes:
      - db_data:/var/lib/mysql
      - ./server/src/scripts/db.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - videoforge_network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10

  server:
    image: ${ECR_REGISTRY}/${PROJECT_NAME}-server:latest
    container_name: videoforge_server
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 8000
      DB_HOST: database
      DB_PORT: 3306
      DB_NAME: \${DB_NAME:-video_forge}
      DB_USER: \${DB_USER:-video_user}
      DB_PASSWORD: \${DB_PASSWORD:-videopassword}
      JWT_SECRET: \${JWT_SECRET}
      JWT_EXPIRES_IN: \${JWT_EXPIRES_IN:-24h}
      PROCESSING_INPUT_DIR: /app/data/inputs
      PROCESSING_OUTPUT_DIR: /app/data/outputs
      PROCESSING_TEMP_DIR: /app/data/temp
      MAX_CONCURRENT_JOBS: \${MAX_CONCURRENT_JOBS:-2}
      PIXABAY_API_KEY: \${PIXABAY_API_KEY}
    volumes:
      - server_data:/app/data
    networks:
      - videoforge_network
    ports:
      - "8000:8000"
    depends_on:
      database:
        condition: service_healthy

  client:
    image: ${ECR_REGISTRY}/${PROJECT_NAME}-client:latest
    container_name: videoforge_client
    restart: unless-stopped
    networks:
      - videoforge_network
    ports:
      - "80:80"
    depends_on:
      - server

networks:
  videoforge_network:
    driver: bridge

volumes:
  db_data:
    driver: local
  server_data:
    driver: local
EOF

echo -e "${GREEN}ECR docker-compose file generated: docker-compose.ecr.yml${NC}"

# Create deployment instructions
cat > ECR_DEPLOYMENT.md << EOF
# VideoForge ECR Deployment Guide

## Prerequisites
- AWS CLI configured with appropriate permissions
- Docker installed and running
- ECR repositories created (done by deploy script)

## Deployment Steps

### 1. Environment Variables
Create a \`.env.production\` file with your production environment variables:
\`\`\`bash
# Database Configuration
DB_ROOT_PASSWORD=your-secure-root-password
DB_NAME=video_forge
DB_USER=video_user
DB_PASSWORD=your-secure-db-password

# JWT Configuration
JWT_SECRET=your-very-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h

# Processing Configuration
MAX_CONCURRENT_JOBS=2
PIXABAY_API_KEY=your-pixabay-api-key

# AWS Configuration (if needed)
AWS_REGION=${AWS_REGION}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
\`\`\`

### 2. Deploy with ECR Images
\`\`\`bash
# Load environment variables
export \$(cat .env.production | xargs)

# Deploy using ECR images
docker-compose -f docker-compose.ecr.yml up -d
\`\`\`

### 3. Image URIs
- **Server**: ${ECR_REGISTRY}/${PROJECT_NAME}-server:latest
- **Client**: ${ECR_REGISTRY}/${PROJECT_NAME}-client:latest

### 4. Update Images
To update the deployment with new images:
\`\`\`bash
# Pull latest images
docker-compose -f docker-compose.ecr.yml pull

# Restart services with new images
docker-compose -f docker-compose.ecr.yml up -d
\`\`\`

### 5. Monitoring
- Check service status: \`docker-compose -f docker-compose.ecr.yml ps\`
- View logs: \`docker-compose -f docker-compose.ecr.yml logs -f [service-name]\`
- Monitor resource usage: \`docker stats\`

## AWS ECR Repository URLs
- Server: https://console.aws.amazon.com/ecr/repositories/private/${AWS_ACCOUNT_ID}/${PROJECT_NAME}-server
- Client: https://console.aws.amazon.com/ecr/repositories/private/${AWS_ACCOUNT_ID}/${PROJECT_NAME}-client
EOF

echo ""
echo -e "${GREEN}Deployment to ECR completed successfully!${NC}"
echo ""
echo -e "${BLUE}Generated Files:${NC}"
echo "- docker-compose.ecr.yml (Production deployment config)"
echo "- ECR_DEPLOYMENT.md (Deployment instructions)"
echo ""
echo -e "${BLUE}ECR Repository URLs:${NC}"
echo "- Server: https://console.aws.amazon.com/ecr/repositories/private/${AWS_ACCOUNT_ID}/${PROJECT_NAME}-server"
echo "- Client: https://console.aws.amazon.com/ecr/repositories/private/${AWS_ACCOUNT_ID}/${PROJECT_NAME}-client"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Create .env.production file with your production environment variables"
echo "2. Deploy using: docker-compose -f docker-compose.ecr.yml up -d"
echo "3. Monitor deployment: docker-compose -f docker-compose.ecr.yml ps"