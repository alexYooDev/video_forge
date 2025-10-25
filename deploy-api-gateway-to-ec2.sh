#!/bin/bash
# Deploy API Gateway service to EC2 instance
# Instance: i-0d054318bd6b72a10 (3.24.181.225)

set -e

INSTANCE_IP="3.24.181.225"
KEY_FILE="$HOME/.ssh/n12159069-CAB432.pem"

echo "========================================="
echo "Deploying API Gateway to EC2"
echo "Instance: ${INSTANCE_IP}"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Copying docker-compose file to EC2...${NC}"
scp -i ${KEY_FILE} docker-compose.api-gateway.yml ec2-user@${INSTANCE_IP}:~/docker-compose.yml

echo -e "${YELLOW}Step 2: Deploying services on EC2...${NC}"
ssh -i ${KEY_FILE} ec2-user@${INSTANCE_IP} << 'EOF'
  set -e

  echo "Logging into ECR..."
  aws ecr get-login-password --region ap-southeast-2 | \
    docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

  echo "Pulling latest images..."
  docker-compose pull

  echo "Stopping old containers..."
  docker-compose down || true

  echo "Starting services..."
  docker-compose up -d

  echo "Waiting for services to start..."
  sleep 10

  echo "Checking container status..."
  docker-compose ps

  echo "Checking API Gateway logs..."
  docker-compose logs --tail=50 api-gateway
EOF

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Services:"
echo "  API Gateway: http://${INSTANCE_IP}:8000"
echo "  Client:      http://${INSTANCE_IP}:3000"
echo ""
echo "Test health endpoint:"
echo "  curl http://${INSTANCE_IP}:8000/api/health"
echo ""
echo "View logs:"
echo "  ssh -i ${KEY_FILE} ec2-user@${INSTANCE_IP} 'docker-compose logs -f'"
