#!/bin/bash
# VideoForge CloudFormation Cleanup Script - Individual Stacks
# Deletes all individual stacks in reverse order

set -e

# Configuration
REGION="ap-southeast-2"

# Stack names
CDN_STACK_NAME="video-forge-cloudfront"
ASG_STACK_NAME="video-forge-asg"
LAMBDA_STACK_NAME="video-forge-lambda"
SQS_STACK_NAME="video-forge-sqs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}========================================${NC}"
echo -e "${RED}VideoForge Infrastructure Cleanup${NC}"
echo -e "${RED}(Individual Stacks)${NC}"
echo -e "${RED}========================================${NC}"
echo ""

echo -e "${YELLOW}WARNING: This will delete the following CloudFormation stacks:${NC}"
echo -e "  - ${CDN_STACK_NAME} (CloudFront - takes 15-20 min)"
echo -e "  - ${ASG_STACK_NAME} (Auto Scaling Group)"
echo -e "  - ${LAMBDA_STACK_NAME} (Lambda Functions)"
echo -e "  - ${SQS_STACK_NAME} (SQS Queues + DLQ)"
echo ""

read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${GREEN}Cleanup cancelled.${NC}"
    exit 0
fi

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$1" --region ${REGION} &>/dev/null
}

# Function to delete stack and wait
delete_stack() {
    local stack_name=$1

    if stack_exists ${stack_name}; then
        echo -e "${YELLOW}Deleting ${stack_name}...${NC}"
        aws cloudformation delete-stack \
            --stack-name ${stack_name} \
            --region ${REGION}

        echo -e "${YELLOW}Waiting for ${stack_name} deletion...${NC}"
        aws cloudformation wait stack-delete-complete \
            --stack-name ${stack_name} \
            --region ${REGION}

        echo -e "${GREEN}✓ ${stack_name} deleted${NC}"
    else
        echo -e "${BLUE}${stack_name} does not exist, skipping...${NC}"
    fi
}

echo ""

# Delete in reverse order (dependencies)
echo -e "${BLUE}[1/4] Deleting CloudFront Stack...${NC}"
echo -e "${YELLOW}Note: CloudFront distributions take 15-20 minutes to delete${NC}"
delete_stack ${CDN_STACK_NAME}
echo ""

echo -e "${BLUE}[2/4] Deleting Auto Scaling Group Stack...${NC}"
delete_stack ${ASG_STACK_NAME}
echo ""

echo -e "${BLUE}[3/4] Deleting Lambda Functions Stack...${NC}"
delete_stack ${LAMBDA_STACK_NAME}
echo ""

echo -e "${BLUE}[4/4] Deleting SQS Queues Stack...${NC}"
delete_stack ${SQS_STACK_NAME}
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ All Stacks Deleted Successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${BLUE}Verifying all stacks are gone...${NC}"
for stack in ${CDN_STACK_NAME} ${ASG_STACK_NAME} ${LAMBDA_STACK_NAME} ${SQS_STACK_NAME}; do
    if stack_exists ${stack}; then
        echo -e "${RED}✗ ${stack} still exists${NC}"
    else
        echo -e "${GREEN}✓ ${stack} removed${NC}"
    fi
done

echo ""
echo -e "${BLUE}Note: The following resources were NOT deleted:${NC}"
echo -e "  - VPC and subnets"
echo -e "  - Security groups"
echo -e "  - RDS database"
echo -e "  - S3 bucket (video-forge-storage)"
echo -e "  - IAM roles"
echo -e "  - Cognito User Pool"
echo ""
