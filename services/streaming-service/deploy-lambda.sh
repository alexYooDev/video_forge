#!/bin/bash
# Deploy Streaming Service as AWS Lambda Function

set -e

# Configuration
AWS_REGION="ap-southeast-2"
FUNCTION_NAME="video-forge-streaming-service"
RUNTIME="nodejs20.x"
HANDLER="lambda-handler.handler"
MEMORY_SIZE=512
TIMEOUT=10  # Streaming should be fast (just generates URLs)
IAM_ROLE="CAB432-Lambda-Role"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Streaming Service Lambda Deployment${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm not installed${NC}"
    exit 1
fi

# Verify AWS credentials
echo -e "${YELLOW}[1/6] Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with AWS${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials verified${NC}"
echo ""

# Install production dependencies
echo -e "${YELLOW}[2/6] Installing production dependencies...${NC}"
npm install --production
npm install aws-serverless-express
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Create deployment package
echo -e "${YELLOW}[3/6] Creating deployment package...${NC}"
DEPLOY_DIR="lambda-deploy"
rm -rf ${DEPLOY_DIR}
mkdir -p ${DEPLOY_DIR}

# Copy necessary files
cp -r src ${DEPLOY_DIR}/
cp -r node_modules ${DEPLOY_DIR}/
cp lambda-handler.js ${DEPLOY_DIR}/
cp package.json ${DEPLOY_DIR}/

# Create .env for Lambda
cat > ${DEPLOY_DIR}/.env.example <<'EOF'
# These should be set as Lambda environment variables
NODE_ENV=production
AWS_REGION=ap-southeast-2
EOF

# Create zip file
cd ${DEPLOY_DIR}
zip -r ../streaming-service-lambda.zip . -q
cd ..
rm -rf ${DEPLOY_DIR}

echo -e "${GREEN}✓ Deployment package created: streaming-service-lambda.zip${NC}"
echo -e "  Size: $(du -h streaming-service-lambda.zip | cut -f1)"
echo ""

# Check if IAM role exists
echo -e "${YELLOW}[4/6] Checking IAM role...${NC}"
ROLE_ARN=$(aws iam get-role --role-name ${IAM_ROLE} --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
    echo -e "${RED}Error: IAM role ${IAM_ROLE} not found${NC}"
    echo -e "${YELLOW}Please create it first (see DEPLOYMENT_SUMMARY.md)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ IAM role found: ${ROLE_ARN}${NC}"
echo ""

# Get VPC configuration
echo -e "${YELLOW}[5/6] Getting VPC configuration...${NC}"

# Try to get default VPC first
VPC_ID=$(aws ec2 describe-vpcs --region ${AWS_REGION} --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text 2>/dev/null)

# If no default VPC, use the first available VPC
if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
    VPC_ID=$(aws ec2 describe-vpcs --region ${AWS_REGION} --query "Vpcs[0].VpcId" --output text)
fi

SUBNET_IDS=$(aws ec2 describe-subnets --region ${AWS_REGION} --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text | tr '\t' ',')

# Use existing security group (default to CAB432SG)
SG_NAME="${SECURITY_GROUP_NAME:-CAB432SG}"
echo "Looking for security group: ${SG_NAME}"
SG_ID=$(aws ec2 describe-security-groups \
    --region ${AWS_REGION} \
    --filters "Name=group-name,Values=${SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query "SecurityGroups[0].GroupId" \
    --output text 2>/dev/null)

if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
    echo -e "${RED}Error: Security group '${SG_NAME}' not found${NC}"
    echo -e "${YELLOW}Set SECURITY_GROUP_NAME environment variable. Example:${NC}"
    echo "export SECURITY_GROUP_NAME=CAB432SG"
    exit 1
fi

echo -e "${GREEN}✓ VPC configuration ready${NC}"
echo -e "  VPC: ${VPC_ID}"
echo -e "  Subnets: ${SUBNET_IDS}"
echo -e "  Security Group: ${SG_ID} (${SG_NAME})"
echo ""

# Deploy Lambda function
echo -e "${YELLOW}[6/6] Deploying Lambda function...${NC}"

# Check if function exists
if aws lambda get-function --function-name ${FUNCTION_NAME} --region ${AWS_REGION} &>/dev/null; then
    echo "Function exists, updating code..."
    aws lambda update-function-code \
        --function-name ${FUNCTION_NAME} \
        --zip-file fileb://streaming-service-lambda.zip \
        --region ${AWS_REGION} > /dev/null

    # Update configuration
    aws lambda update-function-configuration \
        --function-name ${FUNCTION_NAME} \
        --runtime ${RUNTIME} \
        --handler ${HANDLER} \
        --memory-size ${MEMORY_SIZE} \
        --timeout ${TIMEOUT} \
        --region ${AWS_REGION} \
        --environment "Variables={
            NODE_ENV=production,
            AWS_REGION=${AWS_REGION}
        }" > /dev/null

    echo -e "${GREEN}✓ Lambda function updated${NC}"
else
    echo "Creating new Lambda function..."
    aws lambda create-function \
        --function-name ${FUNCTION_NAME} \
        --runtime ${RUNTIME} \
        --role ${ROLE_ARN} \
        --handler ${HANDLER} \
        --zip-file fileb://streaming-service-lambda.zip \
        --memory-size ${MEMORY_SIZE} \
        --timeout ${TIMEOUT} \
        --region ${AWS_REGION} \
        --vpc-config "SubnetIds=${SUBNET_IDS},SecurityGroupIds=${SG_ID}" \
        --environment "Variables={
            NODE_ENV=production,
            AWS_REGION=${AWS_REGION}
        }" > /dev/null

    echo -e "${GREEN}✓ Lambda function created${NC}"
fi

# Get function ARN
FUNCTION_ARN=$(aws lambda get-function --function-name ${FUNCTION_NAME} --region ${AWS_REGION} --query 'Configuration.FunctionArn' --output text)

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}         Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "Function Name: ${YELLOW}${FUNCTION_NAME}${NC}"
echo -e "Function ARN: ${YELLOW}${FUNCTION_ARN}${NC}"
echo -e "Runtime: ${YELLOW}${RUNTIME}${NC}"
echo -e "Memory: ${YELLOW}${MEMORY_SIZE}MB${NC}"
echo -e "Timeout: ${YELLOW}${TIMEOUT}s${NC}"
echo ""
echo -e "${GREEN}API Endpoints:${NC}"
echo "GET /api/stream/:videoId/qualities    - Get available qualities"
echo "GET /api/stream/:videoId?quality=720p - Get stream URL"
echo "GET /api/stream/:videoId/thumbnail    - Get thumbnail URL"
echo ""
echo -e "${YELLOW}Test Lambda:${NC}"
echo "aws lambda invoke --function-name ${FUNCTION_NAME} --region ${AWS_REGION} --payload '{\"httpMethod\":\"GET\",\"path\":\"/health\"}' response.json && cat response.json"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "aws logs tail /aws/lambda/${FUNCTION_NAME} --follow --region ${AWS_REGION}"
echo ""

# Cleanup
rm -f streaming-service-lambda.zip

echo -e "${GREEN}✓ Done!${NC}"
