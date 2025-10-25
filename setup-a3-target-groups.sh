#!/bin/bash
# Create target groups for A3 microservices
# Reuses existing ALB: video-forge-alb

set -e

ALB_ARN="arn:aws:elasticloadbalancing:ap-southeast-2:901444280953:loadbalancer/app/video-forge-alb/5a1dd136d1ec7958"
VPC_ID="vpc-007bab53289655834"
INSTANCE_ID="i-0d054318bd6b72a10"
REGION="ap-southeast-2"

echo "========================================="
echo "Creating A3 Target Groups"
echo "========================================="

# 1. Create API Gateway Target Group (port 8000)
echo "Creating API Gateway target group..."
API_TG_ARN=$(aws elbv2 create-target-group \
  --name video-forge-api-gateway \
  --protocol HTTP \
  --port 8000 \
  --vpc-id ${VPC_ID} \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region ${REGION} \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "API Gateway TG ARN: ${API_TG_ARN}"

# Register m5.large instance to API Gateway target group
echo "Registering instance to API Gateway target group..."
aws elbv2 register-targets \
  --target-group-arn ${API_TG_ARN} \
  --targets Id=${INSTANCE_ID} \
  --region ${REGION}

# 2. Create Client Target Group (port 3000)
echo "Creating Client target group..."
CLIENT_TG_ARN=$(aws elbv2 create-target-group \
  --name video-forge-client \
  --protocol HTTP \
  --port 3000 \
  --vpc-id ${VPC_ID} \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region ${REGION} \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "Client TG ARN: ${CLIENT_TG_ARN}"

# Register m5.large instance to Client target group
echo "Registering instance to Client target group..."
aws elbv2 register-targets \
  --target-group-arn ${CLIENT_TG_ARN} \
  --targets Id=${INSTANCE_ID} \
  --region ${REGION}

echo "========================================="
echo "Target Groups Created!"
echo "========================================="
echo "API Gateway TG: ${API_TG_ARN}"
echo "Client TG: ${CLIENT_TG_ARN}"
echo ""
echo "Next steps:"
echo "1. Deploy containers to m5.large"
echo "2. Configure ALB listener rules for path-based routing"
echo "3. Test endpoints"
