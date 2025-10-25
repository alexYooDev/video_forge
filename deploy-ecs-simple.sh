#!/bin/bash

# VideoForge ECS Simple Deployment (No Service Discovery Required)
# Deploys all services to ECS with ALB routing

set -e

REGION="ap-southeast-2"
CLUSTER_NAME="video-forge-cluster"
SECURITY_GROUP="sg-032bd1ff8cf77dbb9"
ACCOUNT_ID="901444280953"

SUBNET_1="subnet-04cc288ea3b2e1e53"
SUBNET_2="subnet-08e89ff0d9b49c9ae"
SUBNET_3="subnet-05d0352bb15852524"

DB_HOST="database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com"
DB_NAME="cohort_2025"
DB_USER="s458"
S3_BUCKET="video-forge-storage"
COGNITO_USER_POOL_ID="ap-southeast-2_jft50FBre"
COGNITO_CLIENT_ID="59ff9f0j33qp7al3vje4j4isc0"

echo "=========================================="
echo "VideoForge ECS Deployment (Simple Mode)"
echo "=========================================="
echo ""
echo "Note: Services will communicate via ALB paths"
echo "  - Gallery: /api/gallery/*"
echo "  - Streaming: /api/stream/*"
echo "  - API Gateway: /*"
echo ""

# Step 1: Build and Push Docker Images
echo "Step 1/3: Building and Pushing Docker Images..."

cd /Users/alexyoodev/2025/cab432/video_forge_v2/services

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

for SERVICE in api-gateway gallery-service streaming-service; do
  echo "Building $SERVICE..."
  cd $SERVICE
  docker build --platform linux/amd64 -t video-forge-${SERVICE} .
  docker tag video-forge-${SERVICE}:latest ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-${SERVICE}:latest
  docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-${SERVICE}:latest
  echo "✓ Pushed $SERVICE"
  cd ..
done

echo ""

# Step 2: Register Task Definitions
echo "Step 2/3: Registering ECS Task Definitions..."

# Gallery Service
aws ecs register-task-definition \
  --family video-forge-gallery-service \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --task-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --container-definitions "[{\"name\":\"gallery-service\",\"image\":\"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-gallery-service:latest\",\"cpu\":512,\"memory\":1024,\"essential\":true,\"portMappings\":[{\"containerPort\":5000,\"protocol\":\"tcp\"}],\"environment\":[{\"name\":\"NODE_ENV\",\"value\":\"production\"},{\"name\":\"PORT\",\"value\":\"5000\"},{\"name\":\"DB_HOST\",\"value\":\"${DB_HOST}\"},{\"name\":\"DB_NAME\",\"value\":\"${DB_NAME}\"},{\"name\":\"DB_USER\",\"value\":\"${DB_USER}\"},{\"name\":\"DB_PASSWORD\",\"value\":\"4T5gnYmROThF\"},{\"name\":\"S3_BUCKET_NAME\",\"value\":\"${S3_BUCKET}\"},{\"name\":\"COGNITO_USER_POOL_ID\",\"value\":\"${COGNITO_USER_POOL_ID}\"},{\"name\":\"COGNITO_CLIENT_ID\",\"value\":\"${COGNITO_CLIENT_ID}\"},{\"name\":\"AWS_REGION\",\"value\":\"${REGION}\"}],\"logConfiguration\":{\"logDriver\":\"awslogs\",\"options\":{\"awslogs-group\":\"/ecs/video-forge-gallery-service\",\"awslogs-region\":\"${REGION}\",\"awslogs-stream-prefix\":\"ecs\",\"awslogs-create-group\":\"true\"}}}]" \
  --region $REGION > /dev/null

echo "✓ gallery-service"

# Streaming Service
aws ecs register-task-definition \
  --family video-forge-streaming-service \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --task-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --container-definitions "[{\"name\":\"streaming-service\",\"image\":\"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-streaming-service:latest\",\"cpu\":512,\"memory\":1024,\"essential\":true,\"portMappings\":[{\"containerPort\":5001,\"protocol\":\"tcp\"}],\"environment\":[{\"name\":\"NODE_ENV\",\"value\":\"production\"},{\"name\":\"PORT\",\"value\":\"5001\"},{\"name\":\"DB_HOST\",\"value\":\"${DB_HOST}\"},{\"name\":\"DB_NAME\",\"value\":\"${DB_NAME}\"},{\"name\":\"DB_USER\",\"value\":\"${DB_USER}\"},{\"name\":\"DB_PASSWORD\",\"value\":\"4T5gnYmROThF\"},{\"name\":\"S3_BUCKET_NAME\",\"value\":\"${S3_BUCKET}\"},{\"name\":\"AWS_REGION\",\"value\":\"${REGION}\"}],\"logConfiguration\":{\"logDriver\":\"awslogs\",\"options\":{\"awslogs-group\":\"/ecs/video-forge-streaming-service\",\"awslogs-region\":\"${REGION}\",\"awslogs-stream-prefix\":\"ecs\",\"awslogs-create-group\":\"true\"}}}]" \
  --region $REGION > /dev/null

echo "✓ streaming-service"

# API Gateway
aws ecs register-task-definition \
  --family video-forge-api-gateway \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --task-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --container-definitions "[{\"name\":\"api-gateway\",\"image\":\"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-api-gateway:latest\",\"cpu\":512,\"memory\":1024,\"essential\":true,\"portMappings\":[{\"containerPort\":8000,\"protocol\":\"tcp\"}],\"environment\":[{\"name\":\"NODE_ENV\",\"value\":\"production\"},{\"name\":\"SERVER_PORT\",\"value\":\"8000\"},{\"name\":\"PG_HOST\",\"value\":\"${DB_HOST}\"},{\"name\":\"PG_DATABASE\",\"value\":\"${DB_NAME}\"},{\"name\":\"PG_USERNAME\",\"value\":\"${DB_USER}\"},{\"name\":\"PG_PASSWORD\",\"value\":\"4T5gnYmROThF\"},{\"name\":\"DB_HOST\",\"value\":\"${DB_HOST}\"},{\"name\":\"DB_NAME\",\"value\":\"${DB_NAME}\"},{\"name\":\"DB_USER\",\"value\":\"${DB_USER}\"},{\"name\":\"DB_PASSWORD\",\"value\":\"4T5gnYmROThF\"},{\"name\":\"S3_BUCKET_NAME\",\"value\":\"${S3_BUCKET}\"},{\"name\":\"COGNITO_USER_POOL_ID\",\"value\":\"${COGNITO_USER_POOL_ID}\"},{\"name\":\"COGNITO_CLIENT_ID\",\"value\":\"${COGNITO_CLIENT_ID}\"},{\"name\":\"JWT_SECRET\",\"value\":\"v8CH5wbdp9iPJHyBXQA2a8ALW58QJ9Ek\"},{\"name\":\"AWS_REGION\",\"value\":\"${REGION}\"},{\"name\":\"CACHE_ENABLED\",\"value\":\"false\"}],\"logConfiguration\":{\"logDriver\":\"awslogs\",\"options\":{\"awslogs-group\":\"/ecs/video-forge-api-gateway\",\"awslogs-region\":\"${REGION}\",\"awslogs-stream-prefix\":\"ecs\",\"awslogs-create-group\":\"true\"}}}]" \
  --region $REGION > /dev/null

echo "✓ api-gateway"
echo ""

# Step 3: Create ECS Services (without service discovery)
echo "Step 3/3: Creating ECS Services..."

# Gallery Service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name gallery-service \
  --task-definition video-forge-gallery-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2,$SUBNET_3],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --region $REGION \
  --enable-execute-command \
  --output json > /dev/null 2>&1 || echo "gallery-service already exists"

echo "✓ gallery-service (1 task)"

# Streaming Service
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name streaming-service \
  --task-definition video-forge-streaming-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2,$SUBNET_3],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --region $REGION \
  --enable-execute-command \
  --output json > /dev/null 2>&1 || echo "streaming-service already exists"

echo "✓ streaming-service (1 task)"

# API Gateway
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name api-gateway \
  --task-definition video-forge-api-gateway \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2,$SUBNET_3],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --region $REGION \
  --enable-execute-command \
  --output json > /dev/null 2>&1 || echo "api-gateway already exists"

echo "✓ api-gateway (2 tasks)"
echo ""

echo "=========================================="
echo "✓ ECS Services Created!"
echo "=========================================="
echo ""
echo "Services:"
echo "  - gallery-service  (1 task on port 5000)"
echo "  - streaming-service (1 task on port 5001)"
echo "  - api-gateway (2 tasks on port 8000)"
echo ""
echo "Next: Create ALB with path-based routing"
echo ""
