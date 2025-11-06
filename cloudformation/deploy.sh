#!/bin/bash
# VideoForge CloudFormation Deployment Script - Individual Stacks
# Deploys each component as a separate stack (not nested)

set -e

# Configuration
REGION="ap-southeast-2"
TEMPLATES_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VideoForge CloudFormation Deployment${NC}"
echo -e "${BLUE}(Individual Stacks)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" --region ${REGION} &>/dev/null
}

# Function to wait for stack
wait_for_stack() {
    local stack_name=$1
    local operation=$2

    echo -e "${YELLOW}Waiting for ${stack_name} to complete...${NC}"
    aws cloudformation wait ${operation} \
        --stack-name ${stack_name} \
        --region ${REGION}
    echo -e "${GREEN}✓ ${stack_name} completed${NC}"
}

# Step 1: Deploy SQS Stack
echo -e "${BLUE}[1/4] Deploying SQS Queues Stack...${NC}"
SQS_STACK_NAME="video-forge-sqs"

if stack_exists ${SQS_STACK_NAME}; then
    echo -e "${YELLOW}Stack ${SQS_STACK_NAME} already exists, skipping...${NC}"
else
    aws cloudformation create-stack \
        --stack-name ${SQS_STACK_NAME} \
        --template-body file://${TEMPLATES_DIR}/1-sqs-queues.yaml \
        --parameters \
            ParameterKey=EnvironmentName,ParameterValue=video-forge \
            ParameterKey=MaxReceiveCount,ParameterValue=3 \
            ParameterKey=MessageRetentionPeriod,ParameterValue=345600 \
        --region ${REGION} \
        --tags Key=Environment,Value=production Key=ManagedBy,Value=CloudFormation

    wait_for_stack ${SQS_STACK_NAME} "stack-create-complete"
fi

# Get SQS outputs
echo -e "${BLUE}Retrieving SQS outputs...${NC}"
QUEUE_URL=$(aws cloudformation describe-stacks \
    --stack-name ${SQS_STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`VideoProcessingQueueURL`].OutputValue' \
    --output text)

QUEUE_NAME=$(aws cloudformation describe-stacks \
    --stack-name ${SQS_STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[?OutputKey==`VideoProcessingQueueName`].OutputValue' \
    --output text)

echo -e "${GREEN}Queue URL: ${QUEUE_URL}${NC}"
echo -e "${GREEN}Queue Name: ${QUEUE_NAME}${NC}"
echo ""

# Step 2: Deploy Lambda Stack
echo -e "${BLUE}[2/4] Deploying Lambda Functions Stack...${NC}"
LAMBDA_STACK_NAME="video-forge-lambda"

# Read parameters from parameters.json
VPC_ID=$(jq -r '.[] | select(.ParameterKey=="VpcId") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
PRIVATE_SUBNETS=$(jq -r '.[] | select(.ParameterKey=="PrivateSubnetIds") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
LAMBDA_SG=$(jq -r '.[] | select(.ParameterKey=="LambdaSecurityGroupId") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
DB_HOST=$(jq -r '.[] | select(.ParameterKey=="DBHost") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
DB_SECRET=$(jq -r '.[] | select(.ParameterKey=="DBSecretArn") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
S3_BUCKET=$(jq -r '.[] | select(.ParameterKey=="S3BucketName") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
COGNITO_POOL=$(jq -r '.[] | select(.ParameterKey=="CognitoUserPoolId") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
COGNITO_CLIENT=$(jq -r '.[] | select(.ParameterKey=="CognitoClientId") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
JWT_SECRET=$(jq -r '.[] | select(.ParameterKey=="JWTSecretArn") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
LAMBDA_ROLE=$(jq -r '.[] | select(.ParameterKey=="LambdaRoleArn") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)

if stack_exists ${LAMBDA_STACK_NAME}; then
    echo -e "${YELLOW}Stack ${LAMBDA_STACK_NAME} already exists, skipping...${NC}"
else
    aws cloudformation create-stack \
        --stack-name ${LAMBDA_STACK_NAME} \
        --template-body file://${TEMPLATES_DIR}/2-lambda-functions.yaml \
        --parameters \
            ParameterKey=EnvironmentName,ParameterValue=video-forge \
            ParameterKey=VpcId,ParameterValue=${VPC_ID} \
            ParameterKey=PrivateSubnetIds,ParameterValue=\"${PRIVATE_SUBNETS}\" \
            ParameterKey=LambdaSecurityGroupId,ParameterValue=${LAMBDA_SG} \
            ParameterKey=DBHost,ParameterValue=${DB_HOST} \
            ParameterKey=DBSecretArn,ParameterValue=${DB_SECRET} \
            ParameterKey=S3BucketName,ParameterValue=${S3_BUCKET} \
            ParameterKey=CognitoUserPoolId,ParameterValue=${COGNITO_POOL} \
            ParameterKey=CognitoClientId,ParameterValue=${COGNITO_CLIENT} \
            ParameterKey=JWTSecretArn,ParameterValue=${JWT_SECRET} \
            ParameterKey=LambdaRoleArn,ParameterValue=${LAMBDA_ROLE} \
        --capabilities CAPABILITY_IAM \
        --region ${REGION} \
        --tags Key=Environment,Value=production Key=ManagedBy,Value=CloudFormation

    wait_for_stack ${LAMBDA_STACK_NAME} "stack-create-complete"
fi
echo ""

# Step 3: Deploy Auto Scaling Group Stack
echo -e "${BLUE}[3/4] Deploying Auto Scaling Group Stack...${NC}"
ASG_STACK_NAME="video-forge-asg"

PUBLIC_SUBNETS=$(jq -r '.[] | select(.ParameterKey=="PublicSubnetIds") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
EC2_SG=$(jq -r '.[] | select(.ParameterKey=="EC2SecurityGroupId") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
EC2_PROFILE=$(jq -r '.[] | select(.ParameterKey=="EC2InstanceProfile") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
KEY_PAIR=$(jq -r '.[] | select(.ParameterKey=="KeyPairName") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)
DB_SECRET=$(jq -r '.[] | select(.ParameterKey=="DBSecretArn") | .ParameterValue' ${TEMPLATES_DIR}/parameters.json)

if stack_exists ${ASG_STACK_NAME}; then
    echo -e "${YELLOW}Stack ${ASG_STACK_NAME} already exists, skipping...${NC}"
else
    aws cloudformation create-stack \
        --stack-name ${ASG_STACK_NAME} \
        --template-body file://${TEMPLATES_DIR}/3-video-processor-asg.yaml \
        --parameters \
            ParameterKey=EnvironmentName,ParameterValue=video-forge \
            ParameterKey=InstanceType,ParameterValue=t2.micro \
            ParameterKey=KeyPairName,ParameterValue=${KEY_PAIR} \
            ParameterKey=VpcId,ParameterValue=${VPC_ID} \
            ParameterKey=SubnetIds,ParameterValue=\"${PUBLIC_SUBNETS}\" \
            ParameterKey=SecurityGroupId,ParameterValue=${EC2_SG} \
            ParameterKey=IAMInstanceProfile,ParameterValue=${EC2_PROFILE} \
            ParameterKey=MinSize,ParameterValue=1 \
            ParameterKey=MaxSize,ParameterValue=3 \
            ParameterKey=DesiredCapacity,ParameterValue=1 \
            ParameterKey=SQSQueueName,ParameterValue=${QUEUE_NAME} \
            ParameterKey=TargetMessagesPerInstance,ParameterValue=5 \
            ParameterKey=DBHost,ParameterValue=${DB_HOST} \
            ParameterKey=DBSecretArn,ParameterValue=${DB_SECRET} \
            ParameterKey=S3BucketName,ParameterValue=${S3_BUCKET} \
            ParameterKey=SQSQueueURL,ParameterValue=${QUEUE_URL} \
        --capabilities CAPABILITY_IAM \
        --region ${REGION} \
        --tags Key=Environment,Value=production Key=ManagedBy,Value=CloudFormation

    wait_for_stack ${ASG_STACK_NAME} "stack-create-complete"
fi
echo ""

# Step 4: Deploy CloudFront Stack
echo -e "${BLUE}[4/4] Deploying CloudFront CDN Stack...${NC}"
CDN_STACK_NAME="video-forge-cloudfront"

S3_DOMAIN="${S3_BUCKET}.s3.${REGION}.amazonaws.com"

if stack_exists ${CDN_STACK_NAME}; then
    echo -e "${YELLOW}Stack ${CDN_STACK_NAME} already exists, skipping...${NC}"
else
    aws cloudformation create-stack \
        --stack-name ${CDN_STACK_NAME} \
        --template-body file://${TEMPLATES_DIR}/4-cloudfront-cdn.yaml \
        --parameters \
            ParameterKey=EnvironmentName,ParameterValue=video-forge \
            ParameterKey=S3BucketName,ParameterValue=${S3_BUCKET} \
            ParameterKey=S3BucketDomainName,ParameterValue=${S3_DOMAIN} \
            ParameterKey=PriceClass,ParameterValue=PriceClass_All \
        --region ${REGION} \
        --tags Key=Environment,Value=production Key=ManagedBy,Value=CloudFormation

    wait_for_stack ${CDN_STACK_NAME} "stack-create-complete"
fi
echo ""

# Display all stack outputs
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All Stacks Deployed Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${BLUE}Stack Outputs:${NC}"
echo ""

echo -e "${YELLOW}SQS Queue:${NC}"
aws cloudformation describe-stacks \
    --stack-name ${SQS_STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo -e "${YELLOW}Lambda Functions:${NC}"
aws cloudformation describe-stacks \
    --stack-name ${LAMBDA_STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo -e "${YELLOW}Auto Scaling Group:${NC}"
aws cloudformation describe-stacks \
    --stack-name ${ASG_STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo -e "${YELLOW}CloudFront CDN:${NC}"
aws cloudformation describe-stacks \
    --stack-name ${CDN_STACK_NAME} \
    --region ${REGION} \
    --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
    --output table

echo ""
echo -e "${GREEN}Next steps:${NC}"
echo -e "1. Verify all resources in AWS Console"
echo -e "2. Test SQS queue → ASG scaling"
echo -e "3. Test Lambda function URLs"
echo -e "4. Test CloudFront CDN"
echo ""
