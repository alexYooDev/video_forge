#!/bin/bash

# VideoForge AWS Setup Checker
# Validates AWS CLI configuration and ECR access

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 VideoForge AWS Setup Checker${NC}"
echo -e "${BLUE}===============================${NC}"
echo ""

# Check AWS CLI installation
echo -e "${BLUE}📋 Checking AWS CLI...${NC}"
if command -v aws &> /dev/null; then
    AWS_CLI_VERSION=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
    echo -e "${GREEN}✅ AWS CLI installed: ${AWS_CLI_VERSION}${NC}"
else
    echo -e "${RED}❌ AWS CLI not installed${NC}"
    echo "Install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi

# Check AWS configuration
echo -e "${BLUE}🔐 Checking AWS configuration...${NC}"
if aws configure list &> /dev/null; then
    AWS_REGION=$(aws configure get region 2>/dev/null || echo "not-set")
    AWS_ACCESS_KEY=$(aws configure get aws_access_key_id 2>/dev/null | sed 's/\(.\{4\}\).*/\1****/')
    
    if [ "$AWS_REGION" != "not-set" ] && [ ! -z "$AWS_ACCESS_KEY" ]; then
        echo -e "${GREEN}✅ AWS credentials configured${NC}"
        echo "   Region: $AWS_REGION"
        echo "   Access Key: $AWS_ACCESS_KEY"
    else
        echo -e "${RED}❌ AWS credentials not properly configured${NC}"
        echo "Run: aws configure"
        exit 1
    fi
else
    echo -e "${RED}❌ AWS not configured${NC}"
    exit 1
fi

# Get AWS Account ID
echo -e "${BLUE}🆔 Getting AWS Account ID...${NC}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ ! -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
    export AWS_ACCOUNT_ID
else
    echo -e "${RED}❌ Cannot retrieve AWS Account ID${NC}"
    echo "Check your AWS credentials and permissions"
    exit 1
fi

# Check ECR permissions
echo -e "${BLUE}🐳 Checking ECR permissions...${NC}"
if aws ecr describe-repositories --region $AWS_REGION &> /dev/null; then
    echo -e "${GREEN}✅ ECR access confirmed${NC}"
else
    echo -e "${YELLOW}⚠️  ECR access check failed (might be due to no repositories)${NC}"
    echo "This is normal if no ECR repositories exist yet"
fi

# Check Docker
echo -e "${BLUE}🐋 Checking Docker...${NC}"
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
        echo -e "${GREEN}✅ Docker running: ${DOCKER_VERSION}${NC}"
    else
        echo -e "${RED}❌ Docker not running${NC}"
        echo "Please start Docker"
        exit 1
    fi
else
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 All prerequisites met!${NC}"
echo ""
echo -e "${BLUE}🚀 Ready for ECR deployment${NC}"
echo -e "${BLUE}Run: ./deploy-to-ecr.sh${NC}"
echo ""
echo -e "${BLUE}💡 Environment Variables for deployment:${NC}"
echo "export AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID"
echo "export AWS_REGION=$AWS_REGION"