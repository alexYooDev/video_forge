#!/bin/bash

# VideoForge ECS Microservices Deployment Script
# Deploys API Gateway, Gallery Service, and Streaming Service to ECS
# with Service Discovery for internal communication

set -e  # Exit on error

REGION="ap-southeast-2"
CLUSTER_NAME="video-forge-cluster"
VPC_ID="vpc-007bab53289655834"
SECURITY_GROUP="sg-032bd1ff8cf77dbb9"  # CAB432SG
ACCOUNT_ID="901444280953"

# Subnets across multiple AZs
SUBNET_1="subnet-04cc288ea3b2e1e53"  # ap-southeast-2a
SUBNET_2="subnet-08e89ff0d9b49c9ae"  # ap-southeast-2b
SUBNET_3="subnet-05d0352bb15852524"  # ap-southeast-2c

# Database and AWS config (from Parameter Store/Secrets Manager)
DB_HOST="database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com"
DB_NAME="cohort_2025"
DB_USER="s458"
S3_BUCKET="video-forge-storage"
COGNITO_USER_POOL_ID="ap-southeast-2_jft50FBre"
COGNITO_CLIENT_ID="59ff9f0j33qp7al3vje4j4isc0"

echo "=========================================="
echo "VideoForge ECS Microservices Deployment"
echo "=========================================="
echo ""

# Step 1: Create Service Discovery Namespace
echo "Step 1/8: Creating Service Discovery Namespace..."
NAMESPACE_ID=$(aws servicediscovery list-namespaces --region $REGION \
  --query "Namespaces[?Name=='video-forge.local'].Id" --output text)

if [ -z "$NAMESPACE_ID" ]; then
  echo "Creating new namespace: video-forge.local"
  NAMESPACE_ID=$(aws servicediscovery create-private-dns-namespace \
    --name video-forge.local \
    --vpc $VPC_ID \
    --region $REGION \
    --query 'OperationId' --output text)

  echo "Waiting for namespace creation..."
  sleep 10

  NAMESPACE_ID=$(aws servicediscovery list-namespaces --region $REGION \
    --query "Namespaces[?Name=='video-forge.local'].Id" --output text)
fi

echo "✓ Namespace ID: $NAMESPACE_ID"
echo ""

# Step 2: Create Service Discovery Services
echo "Step 2/8: Creating Service Discovery Services..."

for SERVICE_NAME in gallery-service streaming-service; do
  SERVICE_DISC_ID=$(aws servicediscovery list-services --region $REGION \
    --filters Name=NAMESPACE_ID,Values=$NAMESPACE_ID \
    --query "Services[?Name=='$SERVICE_NAME'].Id" --output text)

  if [ -z "$SERVICE_DISC_ID" ]; then
    echo "Creating service discovery for: $SERVICE_NAME"
    aws servicediscovery create-service \
      --name $SERVICE_NAME \
      --namespace-id $NAMESPACE_ID \
      --dns-config "NamespaceId=$NAMESPACE_ID,DnsRecords=[{Type=A,TTL=60}]" \
      --health-check-custom-config FailureThreshold=1 \
      --region $REGION \
      --output json > /dev/null
    echo "✓ Created service discovery for $SERVICE_NAME"
  else
    echo "✓ Service discovery already exists for $SERVICE_NAME"
  fi
done

echo ""

# Step 3: Build and Push Docker Images
echo "Step 3/8: Building and Pushing Docker Images to ECR..."

cd /Users/alexyoodev/2025/cab432/video_forge_v2/services

# Login to ECR
echo "Logging in to ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# Build and push each service
for SERVICE in api-gateway gallery-service streaming-service; do
  echo ""
  echo "Building $SERVICE..."

  ECR_REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-${SERVICE}:latest"

  cd $SERVICE
  docker build --platform linux/amd64 -t video-forge-${SERVICE} .
  docker tag video-forge-${SERVICE}:latest $ECR_REPO
  docker push $ECR_REPO

  echo "✓ Pushed $SERVICE to ECR"
  cd ..
done

echo ""

# Step 4: Register ECS Task Definitions
echo "Step 4/8: Registering ECS Task Definitions..."

# Gallery Service Task Definition
echo "Registering gallery-service task definition..."
aws ecs register-task-definition \
  --family video-forge-gallery-service \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --task-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --container-definitions "[
    {
      \"name\": \"gallery-service\",
      \"image\": \"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-gallery-service:latest\",
      \"cpu\": 512,
      \"memory\": 1024,
      \"essential\": true,
      \"portMappings\": [{\"containerPort\": 5000, \"protocol\": \"tcp\"}],
      \"environment\": [
        {\"name\": \"NODE_ENV\", \"value\": \"production\"},
        {\"name\": \"PORT\", \"value\": \"5000\"},
        {\"name\": \"DB_HOST\", \"value\": \"${DB_HOST}\"},
        {\"name\": \"DB_NAME\", \"value\": \"${DB_NAME}\"},
        {\"name\": \"DB_USER\", \"value\": \"${DB_USER}\"},
        {\"name\": \"DB_PASSWORD\", \"value\": \"4T5gnYmROThF\"},
        {\"name\": \"S3_BUCKET_NAME\", \"value\": \"${S3_BUCKET}\"},
        {\"name\": \"COGNITO_USER_POOL_ID\", \"value\": \"${COGNITO_USER_POOL_ID}\"},
        {\"name\": \"COGNITO_CLIENT_ID\", \"value\": \"${COGNITO_CLIENT_ID}\"},
        {\"name\": \"AWS_REGION\", \"value\": \"${REGION}\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/video-forge-gallery-service\",
          \"awslogs-region\": \"${REGION}\",
          \"awslogs-stream-prefix\": \"ecs\",
          \"awslogs-create-group\": \"true\"
        }
      }
    }
  ]" \
  --region $REGION > /dev/null

echo "✓ Registered gallery-service task definition"

# Streaming Service Task Definition
echo "Registering streaming-service task definition..."
aws ecs register-task-definition \
  --family video-forge-streaming-service \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --task-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --container-definitions "[
    {
      \"name\": \"streaming-service\",
      \"image\": \"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-streaming-service:latest\",
      \"cpu\": 512,
      \"memory\": 1024,
      \"essential\": true,
      \"portMappings\": [{\"containerPort\": 5001, \"protocol\": \"tcp\"}],
      \"environment\": [
        {\"name\": \"NODE_ENV\", \"value\": \"production\"},
        {\"name\": \"PORT\", \"value\": \"5001\"},
        {\"name\": \"DB_HOST\", \"value\": \"${DB_HOST}\"},
        {\"name\": \"DB_NAME\", \"value\": \"${DB_NAME}\"},
        {\"name\": \"DB_USER\", \"value\": \"${DB_USER}\"},
        {\"name\": \"DB_PASSWORD\", \"value\": \"4T5gnYmROThF\"},
        {\"name\": \"S3_BUCKET_NAME\", \"value\": \"${S3_BUCKET}\"},
        {\"name\": \"AWS_REGION\", \"value\": \"${REGION}\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/video-forge-streaming-service\",
          \"awslogs-region\": \"${REGION}\",
          \"awslogs-stream-prefix\": \"ecs\",
          \"awslogs-create-group\": \"true\"
        }
      }
    }
  ]" \
  --region $REGION > /dev/null

echo "✓ Registered streaming-service task definition"

# API Gateway Task Definition
echo "Registering api-gateway task definition..."
aws ecs register-task-definition \
  --family video-forge-api-gateway \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 512 \
  --memory 1024 \
  --execution-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --task-role-arn arn:aws:iam::${ACCOUNT_ID}:role/CAB432-Lambda-Role \
  --container-definitions "[
    {
      \"name\": \"api-gateway\",
      \"image\": \"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/video-forge-api-gateway:latest\",
      \"cpu\": 512,
      \"memory\": 1024,
      \"essential\": true,
      \"portMappings\": [{\"containerPort\": 8000, \"protocol\": \"tcp\"}],
      \"environment\": [
        {\"name\": \"NODE_ENV\", \"value\": \"production\"},
        {\"name\": \"SERVER_PORT\", \"value\": \"8000\"},
        {\"name\": \"PG_HOST\", \"value\": \"${DB_HOST}\"},
        {\"name\": \"PG_DATABASE\", \"value\": \"${DB_NAME}\"},
        {\"name\": \"PG_USERNAME\", \"value\": \"${DB_USER}\"},
        {\"name\": \"PG_PASSWORD\", \"value\": \"4T5gnYmROThF\"},
        {\"name\": \"DB_HOST\", \"value\": \"${DB_HOST}\"},
        {\"name\": \"DB_NAME\", \"value\": \"${DB_NAME}\"},
        {\"name\": \"DB_USER\", \"value\": \"${DB_USER}\"},
        {\"name\": \"DB_PASSWORD\", \"value\": \"4T5gnYmROThF\"},
        {\"name\": \"S3_BUCKET_NAME\", \"value\": \"${S3_BUCKET}\"},
        {\"name\": \"COGNITO_USER_POOL_ID\", \"value\": \"${COGNITO_USER_POOL_ID}\"},
        {\"name\": \"COGNITO_CLIENT_ID\", \"value\": \"${COGNITO_CLIENT_ID}\"},
        {\"name\": \"JWT_SECRET\", \"value\": \"v8CH5wbdp9iPJHyBXQA2a8ALW58QJ9Ek\"},
        {\"name\": \"AWS_REGION\", \"value\": \"${REGION}\"},
        {\"name\": \"GALLERY_SERVICE_URL\", \"value\": \"http://gallery-service.video-forge.local:5000\"},
        {\"name\": \"STREAMING_SERVICE_URL\", \"value\": \"http://streaming-service.video-forge.local:5001\"},
        {\"name\": \"REDIS_HOST\", \"value\": \"redis\"},
        {\"name\": \"REDIS_PORT\", \"value\": \"6379\"},
        {\"name\": \"CACHE_ENABLED\", \"value\": \"false\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/video-forge-api-gateway\",
          \"awslogs-region\": \"${REGION}\",
          \"awslogs-stream-prefix\": \"ecs\",
          \"awslogs-create-group\": \"true\"
        }
      }
    }
  ]" \
  --region $REGION > /dev/null

echo "✓ Registered api-gateway task definition"
echo ""

# Step 5: Create ECS Services with Service Discovery
echo "Step 5/8: Creating ECS Services..."

# Gallery Service
echo "Creating gallery-service ECS service..."
GALLERY_SD_ARN=$(aws servicediscovery list-services --region $REGION \
  --filters Name=NAMESPACE_ID,Values=$NAMESPACE_ID \
  --query "Services[?Name=='gallery-service'].Arn" --output text)

aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name gallery-service \
  --task-definition video-forge-gallery-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2,$SUBNET_3],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --service-registries "registryArn=$GALLERY_SD_ARN" \
  --region $REGION \
  --enable-execute-command \
  --output json > /dev/null 2>&1 || echo "Service may already exist"

echo "✓ Created gallery-service"

# Streaming Service
echo "Creating streaming-service ECS service..."
STREAMING_SD_ARN=$(aws servicediscovery list-services --region $REGION \
  --filters Name=NAMESPACE_ID,Values=$NAMESPACE_ID \
  --query "Services[?Name=='streaming-service'].Arn" --output text)

aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name streaming-service \
  --task-definition video-forge-streaming-service \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2,$SUBNET_3],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --service-registries "registryArn=$STREAMING_SD_ARN" \
  --region $REGION \
  --enable-execute-command \
  --output json > /dev/null 2>&1 || echo "Service may already exist"

echo "✓ Created streaming-service"

# API Gateway (no service discovery - will be behind ALB)
echo "Creating api-gateway ECS service..."
aws ecs create-service \
  --cluster $CLUSTER_NAME \
  --service-name api-gateway \
  --task-definition video-forge-api-gateway \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2,$SUBNET_3],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --region $REGION \
  --enable-execute-command \
  --output json > /dev/null 2>&1 || echo "Service may already exist"

echo "✓ Created api-gateway service"
echo ""

echo "=========================================="
echo "✓ ECS Services Deployment Complete!"
echo "=========================================="
echo ""
echo "Services Created:"
echo "  - gallery-service  (discoverable at gallery-service.video-forge.local:5000)"
echo "  - streaming-service (discoverable at streaming-service.video-forge.local:5001)"
echo "  - api-gateway      (2 tasks, ready for ALB)"
echo ""
echo "Next Steps:"
echo "  1. Create Application Load Balancer"
echo "  2. Create Target Group for api-gateway"
echo "  3. Configure HTTPS with ACM certificate"
echo "  4. Test service discovery communication"
echo ""
echo "Monitor services:"
echo "  aws ecs describe-services --cluster $CLUSTER_NAME --services gallery-service streaming-service api-gateway"
echo ""
