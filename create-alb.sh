#!/bin/bash

# Create Application Load Balancer for VideoForge ECS Services
# Sets up path-based routing for all three microservices

set -e

REGION="ap-southeast-2"
VPC_ID="vpc-007bab53289655834"
SECURITY_GROUP="sg-032bd1ff8cf77dbb9"
CLUSTER_NAME="video-forge-cluster"

# Subnets for ALB (must be in different AZs)
SUBNET_1="subnet-04cc288ea3b2e1e53"  # ap-southeast-2a
SUBNET_2="subnet-08e89ff0d9b49c9ae"  # ap-southeast-2b
SUBNET_3="subnet-05d0352bb15852524"  # ap-southeast-2c

echo "=========================================="
echo "Creating Application Load Balancer"
echo "=========================================="
echo ""

# Step 1: Create Target Groups
echo "Step 1/5: Creating Target Groups..."

# API Gateway Target Group
API_TG_ARN=$(aws elbv2 create-target-group \
  --name video-forge-api-gateway-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || \
  aws elbv2 describe-target-groups --names video-forge-api-gateway-tg --region $REGION --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "✓ API Gateway TG: $API_TG_ARN"

# Gallery Service Target Group
GALLERY_TG_ARN=$(aws elbv2 create-target-group \
  --name video-forge-gallery-tg \
  --protocol HTTP \
  --port 5000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || \
  aws elbv2 describe-target-groups --names video-forge-gallery-tg --region $REGION --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "✓ Gallery TG: $GALLERY_TG_ARN"

# Streaming Service Target Group
STREAMING_TG_ARN=$(aws elbv2 create-target-group \
  --name video-forge-streaming-tg \
  --protocol HTTP \
  --port 5001 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || \
  aws elbv2 describe-target-groups --names video-forge-streaming-tg --region $REGION --query 'TargetGroups[0].TargetGroupArn' --output text)

echo "✓ Streaming TG: $STREAMING_TG_ARN"
echo ""

# Step 2: Create Application Load Balancer
echo "Step 2/5: Creating Application Load Balancer..."

ALB_ARN=$(aws elbv2 create-load-balancer \
  --name video-forge-alb \
  --subnets $SUBNET_1 $SUBNET_2 $SUBNET_3 \
  --security-groups $SECURITY_GROUP \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --region $REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || \
  aws elbv2 describe-load-balancers --names video-forge-alb --region $REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text)

echo "✓ ALB ARN: $ALB_ARN"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $REGION \
  --query 'LoadBalancers[0].DNSName' --output text)

echo "✓ ALB DNS: $ALB_DNS"
echo ""

# Step 3: Create HTTP Listener (for now)
echo "Step 3/5: Creating HTTP Listener..."

LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$API_TG_ARN \
  --region $REGION \
  --query 'Listeners[0].ListenerArn' --output text 2>/dev/null || \
  aws elbv2 describe-listeners --load-balancer-arn $ALB_ARN --region $REGION --query 'Listeners[0].ListenerArn' --output text)

echo "✓ HTTP Listener: $LISTENER_ARN"
echo ""

# Step 4: Create Listener Rules for Path-Based Routing
echo "Step 4/5: Creating Listener Rules..."

# Rule for /api/gallery/* → gallery-service
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 10 \
  --conditions Field=path-pattern,Values='/api/gallery*' \
  --actions Type=forward,TargetGroupArn=$GALLERY_TG_ARN \
  --region $REGION \
  --output json > /dev/null 2>&1 || echo "Gallery rule already exists"

echo "✓ Rule: /api/gallery* → gallery-service"

# Rule for /api/stream/* → streaming-service
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 20 \
  --conditions Field=path-pattern,Values='/api/stream*' \
  --actions Type=forward,TargetGroupArn=$STREAMING_TG_ARN \
  --region $REGION \
  --output json > /dev/null 2>&1 || echo "Streaming rule already exists"

echo "✓ Rule: /api/stream* → streaming-service"
echo "✓ Default: /* → api-gateway"
echo ""

# Step 5: Update ECS Services to use Target Groups
echo "Step 5/5: Updating ECS Services with Load Balancer..."

# Update api-gateway service
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service api-gateway \
  --load-balancers "targetGroupArn=$API_TG_ARN,containerName=api-gateway,containerPort=8000" \
  --health-check-grace-period-seconds 60 \
  --region $REGION \
  --output json > /dev/null 2>&1 || echo "API Gateway service already has load balancer"

echo "✓ api-gateway attached to ALB"

# Update gallery-service
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service gallery-service \
  --load-balancers "targetGroupArn=$GALLERY_TG_ARN,containerName=gallery-service,containerPort=5000" \
  --health-check-grace-period-seconds 60 \
  --region $REGION \
  --output json > /dev/null 2>&1 || echo "Gallery service already has load balancer"

echo "✓ gallery-service attached to ALB"

# Update streaming-service
aws ecs update-service \
  --cluster $CLUSTER_NAME \
  --service streaming-service \
  --load-balancers "targetGroupArn=$STREAMING_TG_ARN,containerName=streaming-service,containerPort=5001" \
  --health-check-grace-period-seconds 60 \
  --region $REGION \
  --output json > /dev/null 2>&1 || echo "Streaming service already has load balancer"

echo "✓ streaming-service attached to ALB"
echo ""

echo "=========================================="
echo "✓ Application Load Balancer Created!"
echo "=========================================="
echo ""
echo "Load Balancer DNS: $ALB_DNS"
echo ""
echo "Routing:"
echo "  http://$ALB_DNS/api/gallery/* → gallery-service"
echo "  http://$ALB_DNS/api/stream/*  → streaming-service"
echo "  http://$ALB_DNS/*              → api-gateway"
echo ""
echo "Test endpoints:"
echo "  curl http://$ALB_DNS/api/health"
echo "  curl http://$ALB_DNS/api/gallery/videos"
echo "  curl http://$ALB_DNS/api/stream/123/qualities"
echo ""
echo "Next: Configure HTTPS with ACM certificate"
echo ""
