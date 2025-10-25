#!/bin/bash

# Deploy API Gateway to EC2 using Docker from ECR
# Uses existing Docker image instead of building from source

set -e

REGION="ap-southeast-2"
KEY_NAME="CAB432"
SECURITY_GROUP="sg-032bd1ff8cf77dbb9"
SUBNET="subnet-04cc288ea3b2e1e53"
INSTANCE_TYPE="t3.small"

# ECR Configuration
AWS_ACCOUNT_ID="901444280953"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_NAME="video-forge-api-gateway"
IMAGE_TAG="latest"

# Lambda Function URLs
GALLERY_LAMBDA_URL="https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws"
STREAMING_LAMBDA_URL="https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws"

# Database and AWS config
DB_HOST="database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com"
DB_NAME="cohort_2025"
DB_USER="s458"
DB_PASSWORD="4T5gnYmROThF"
S3_BUCKET="video-forge-storage"
COGNITO_USER_POOL_ID="ap-southeast-2_jft50FBre"
COGNITO_CLIENT_ID="59ff9f0j33qp7al3vje4j4isc0"
JWT_SECRET="v8CH5wbdp9iPJHyBXQA2a8ALW58QJ9Ek"

echo "=========================================="
echo "VideoForge API Gateway EC2 Deployment"
echo "Using Docker from ECR"
echo "=========================================="
echo ""

# Step 1: Create User Data Script
echo "Step 1/4: Creating user data script..."

cat > /tmp/api-gateway-docker-userdata.sh << 'USERDATA_EOF'
#!/bin/bash
set -x
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "Starting API Gateway Docker deployment..."

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install AWS CLI v2 (if not already installed)
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# Get ECR login token and login to Docker
aws ecr get-login-password --region __REGION__ | docker login --username AWS --password-stdin __ECR_REGISTRY__

# Pull the API Gateway image
docker pull __ECR_REGISTRY__/__IMAGE_NAME__:__IMAGE_TAG__

# Create environment file
cat > /opt/api-gateway.env << EOF
NODE_ENV=production
PORT=8080
SERVER_PORT=8080
GALLERY_SERVICE_URL=__GALLERY_URL__
STREAMING_SERVICE_URL=__STREAMING_URL__
DB_HOST=__DB_HOST__
DB_NAME=__DB_NAME__
DB_USER=__DB_USER__
DB_PASSWORD=__DB_PASSWORD__
S3_BUCKET_NAME=__S3_BUCKET__
COGNITO_USER_POOL_ID=__COGNITO_POOL__
COGNITO_CLIENT_ID=__COGNITO_CLIENT__
JWT_SECRET=__JWT_SECRET__
AWS_REGION=__REGION__
EOF

# Run the container
docker run -d \
  --name api-gateway \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file /opt/api-gateway.env \
  __ECR_REGISTRY__/__IMAGE_NAME__:__IMAGE_TAG__

# Verify container is running
sleep 5
docker ps

echo "API Gateway Docker container deployed successfully!"
USERDATA_EOF

# Replace placeholders in user data
sed -i '' "s|__REGION__|$REGION|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__ECR_REGISTRY__|$ECR_REGISTRY|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__IMAGE_NAME__|$IMAGE_NAME|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__IMAGE_TAG__|$IMAGE_TAG|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__GALLERY_URL__|$GALLERY_LAMBDA_URL|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__STREAMING_URL__|$STREAMING_LAMBDA_URL|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__DB_HOST__|$DB_HOST|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__DB_NAME__|$DB_NAME|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__DB_USER__|$DB_USER|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__DB_PASSWORD__|$DB_PASSWORD|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__S3_BUCKET__|$S3_BUCKET|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__COGNITO_POOL__|$COGNITO_USER_POOL_ID|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__COGNITO_CLIENT__|$COGNITO_CLIENT_ID|g" /tmp/api-gateway-docker-userdata.sh
sed -i '' "s|__JWT_SECRET__|$JWT_SECRET|g" /tmp/api-gateway-docker-userdata.sh

echo "✓ User data script created"
echo ""

# Step 2: Launch EC2 Instance
echo "Step 2/4: Launching EC2 instance..."

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0146fc9ad419e2cfd \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SECURITY_GROUP \
  --subnet-id $SUBNET \
  --iam-instance-profile Name=CAB432-Instance-Role \
  --user-data file:///tmp/api-gateway-docker-userdata.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=video-forge-api-gateway-docker},{Key=Service,Value=api-gateway},{Key=Deployment,Value=docker}]" \
  --region $REGION \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✓ Instance launched: $INSTANCE_ID"
echo ""

# Step 3: Wait for instance to be running
echo "Step 3/4: Waiting for instance to be running..."

aws ec2 wait instance-running \
  --instance-ids $INSTANCE_ID \
  --region $REGION

echo "✓ Instance is running"
echo ""

# Step 4: Get instance details
echo "Step 4/4: Getting instance details..."

INSTANCE_INFO=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].[PublicIpAddress,PrivateIpAddress]' \
  --output text)

PUBLIC_IP=$(echo $INSTANCE_INFO | awk '{print $1}')
PRIVATE_IP=$(echo $INSTANCE_INFO | awk '{print $2}')

echo "✓ Instance details retrieved"
echo ""

echo "=========================================="
echo "✓ API Gateway Deployed Successfully!"
echo "=========================================="
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Public IP:   $PUBLIC_IP"
echo "Private IP:  $PRIVATE_IP"
echo ""
echo "Docker Image: $ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
echo ""
echo "Endpoints:"
echo "  Health: http://$PUBLIC_IP:8080/health"
echo "  API:    http://$PUBLIC_IP:8080/api/health"
echo ""
echo "The instance is initializing. Wait 2-3 minutes for Docker to pull and start, then test:"
echo "  curl http://$PUBLIC_IP:8080/health"
echo ""
echo "To check Docker logs:"
echo "  ssh ec2-user@$PUBLIC_IP 'docker logs -f api-gateway'"
echo ""
echo "To check container status:"
echo "  ssh ec2-user@$PUBLIC_IP 'docker ps'"
echo ""
