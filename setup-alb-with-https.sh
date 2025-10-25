#!/bin/bash

# Create Application Load Balancer with HTTPS for VideoForge
# Routes traffic to API Gateway EC2 instance

set -e

REGION="ap-southeast-2"
VPC_ID="vpc-007bab53289655834"
SECURITY_GROUP="sg-032bd1ff8cf77dbb9"

# Subnets for ALB (must be in different AZs)
SUBNET_1="subnet-04cc288ea3b2e1e53"  # ap-southeast-2a
SUBNET_2="subnet-08e89ff0d9b49c9ae"  # ap-southeast-2b
SUBNET_3="subnet-05d0352bb15852524"  # ap-southeast-2c

echo "=========================================="
echo "VideoForge ALB Setup with HTTPS"
echo "=========================================="
echo ""

# Check if API Gateway instance exists
echo "Checking for API Gateway instance..."
API_GATEWAY_INSTANCE=$(aws ec2 describe-instances \
  --filters "Name=tag:Service,Values=api-gateway" "Name=instance-state-name,Values=running" \
  --region $REGION \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text 2>/dev/null || echo "None")

if [ "$API_GATEWAY_INSTANCE" == "None" ] || [ -z "$API_GATEWAY_INSTANCE" ]; then
  echo "❌ No running API Gateway instance found!"
  echo "Please run ./deploy-api-gateway-ec2.sh first"
  exit 1
fi

echo "✓ Found API Gateway instance: $API_GATEWAY_INSTANCE"
echo ""

# Step 1: Create Target Group for API Gateway
echo "Step 1/6: Creating Target Group..."

TG_ARN=$(aws elbv2 create-target-group \
  --name video-forge-api-gateway-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type instance \
  --health-check-enabled \
  --health-check-protocol HTTP \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $REGION \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text 2>/dev/null || \
  aws elbv2 describe-target-groups \
    --names video-forge-api-gateway-tg \
    --region $REGION \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

echo "✓ Target Group: $TG_ARN"
echo ""

# Step 2: Register API Gateway instance with Target Group
echo "Step 2/6: Registering API Gateway instance..."

aws elbv2 register-targets \
  --target-group-arn $TG_ARN \
  --targets Id=$API_GATEWAY_INSTANCE \
  --region $REGION

echo "✓ Instance registered with target group"
echo ""

# Step 3: Create Application Load Balancer
echo "Step 3/6: Creating Application Load Balancer..."

ALB_ARN=$(aws elbv2 create-load-balancer \
  --name video-forge-alb \
  --subnets $SUBNET_1 $SUBNET_2 $SUBNET_3 \
  --security-groups $SECURITY_GROUP \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --region $REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text 2>/dev/null || \
  aws elbv2 describe-load-balancers \
    --names video-forge-alb \
    --region $REGION \
    --query 'LoadBalancers[0].LoadBalancerArn' \
    --output text)

echo "✓ ALB Created: $ALB_ARN"
echo ""

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $REGION \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "✓ ALB DNS: $ALB_DNS"
echo ""

# Step 4: Create HTTP Listener (port 80)
echo "Step 4/6: Creating HTTP Listener..."

HTTP_LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN \
  --region $REGION \
  --query 'Listeners[0].ListenerArn' \
  --output text 2>/dev/null || \
  aws elbv2 describe-listeners \
    --load-balancer-arn $ALB_ARN \
    --region $REGION \
    --query 'Listeners[?Port==`80`].ListenerArn | [0]' \
    --output text)

echo "✓ HTTP Listener: $HTTP_LISTENER_ARN"
echo ""

# Step 5: Wait for ALB to be active
echo "Step 5/6: Waiting for ALB to be active..."

aws elbv2 wait load-balancer-available \
  --load-balancer-arns $ALB_ARN \
  --region $REGION

echo "✓ ALB is active"
echo ""

# Step 6: Check if ACM certificate exists
echo "Step 6/6: Checking for HTTPS certificate..."

CERT_ARN=$(aws acm list-certificates \
  --region $REGION \
  --query 'CertificateSummaryList[0].CertificateArn' \
  --output text 2>/dev/null || echo "")

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
  echo "⚠️  No ACM certificate found"
  echo ""
  echo "To enable HTTPS:"
  echo "1. Request certificate in AWS Certificate Manager (ACM)"
  echo "2. Validate the certificate (DNS or email validation)"
  echo "3. Run this command to add HTTPS listener:"
  echo ""
  echo "aws elbv2 create-listener \\"
  echo "  --load-balancer-arn $ALB_ARN \\"
  echo "  --protocol HTTPS \\"
  echo "  --port 443 \\"
  echo "  --certificates CertificateArn=YOUR_CERT_ARN \\"
  echo "  --default-actions Type=forward,TargetGroupArn=$TG_ARN \\"
  echo "  --region $REGION"
  echo ""
else
  echo "✓ Found certificate: $CERT_ARN"
  echo ""
  echo "Creating HTTPS listener..."

  HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn $ALB_ARN \
    --protocol HTTPS \
    --port 443 \
    --certificates CertificateArn=$CERT_ARN \
    --default-actions Type=forward,TargetGroupArn=$TG_ARN \
    --region $REGION \
    --query 'Listeners[0].ListenerArn' \
    --output text 2>/dev/null || echo "Listener may already exist")

  echo "✓ HTTPS Listener created: $HTTPS_LISTENER_ARN"
  echo ""

  # Optionally redirect HTTP to HTTPS
  echo "Updating HTTP listener to redirect to HTTPS..."
  aws elbv2 modify-listener \
    --listener-arn $HTTP_LISTENER_ARN \
    --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}" \
    --region $REGION \
    --output json > /dev/null 2>&1 || echo "HTTP redirect may already be configured"

  echo "✓ HTTP → HTTPS redirect configured"
fi

echo ""
echo "=========================================="
echo "✓ Application Load Balancer Deployed!"
echo "=========================================="
echo ""
echo "Load Balancer DNS: $ALB_DNS"
echo ""
echo "Endpoints:"
echo "  HTTP:  http://$ALB_DNS"
echo "  HTTPS: https://$ALB_DNS (if certificate is configured)"
echo ""
echo "Test endpoints:"
echo "  curl http://$ALB_DNS/health"
echo "  curl http://$ALB_DNS/api/health"
echo ""
echo "Architecture:"
echo "  Internet → ALB → API Gateway (EC2) → Lambda Function URLs"
echo "  - Gallery Service: Lambda"
echo "  - Streaming Service: Lambda"
echo ""
if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
  echo "To enable HTTPS (for full marks):"
  echo "  1. Go to AWS Certificate Manager in console"
  echo "  2. Request a public certificate for your domain"
  echo "  3. Validate the certificate"
  echo "  4. Re-run this script to add HTTPS listener"
  echo ""
fi

# Save ALB info for later use
cat > alb-info.txt << EOF
ALB_ARN=$ALB_ARN
ALB_DNS=$ALB_DNS
TARGET_GROUP_ARN=$TG_ARN
HTTP_LISTENER_ARN=$HTTP_LISTENER_ARN
API_GATEWAY_INSTANCE=$API_GATEWAY_INSTANCE
EOF

echo "ALB info saved to: alb-info.txt"
echo ""
