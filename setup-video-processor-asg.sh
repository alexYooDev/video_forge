#!/bin/bash
# Complete setup script for Video Processor Auto Scaling Group
# This creates: Launch Template + Auto Scaling Group + Scaling Policies

set -e

# Configuration
AWS_REGION="ap-southeast-2"
AWS_ACCOUNT_ID="901444280953"
LAUNCH_TEMPLATE_NAME="video-forge-video-processor-lt"
ASG_NAME="video-forge-video-processor-asg"
INSTANCE_TYPE="t3.medium"  # Good balance for ASG with multiple instances
KEY_NAME="n12159069-CAB432"
IAM_INSTANCE_PROFILE="CAB432-Instance-Role"
SQS_QUEUE_NAME="video-forge-video-processing-queue"
ECR_REPO="901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-video-processor"

# ASG Configuration
MIN_SIZE=1
MAX_SIZE=3
DESIRED_CAPACITY=1

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Video Processor Auto Scaling Group Setup${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Check prerequisites
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not installed${NC}"
    exit 1
fi

# Verify AWS credentials
echo -e "${YELLOW}[1/7] Verifying AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with AWS${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials verified${NC}"
echo ""

# Get VPC and networking info
echo -e "${YELLOW}[2/7] Getting VPC and subnet information...${NC}"

# Try to get default VPC first
VPC_ID=$(aws ec2 describe-vpcs --region ${AWS_REGION} --filters "Name=isDefault,Values=true" --query "Vpcs[0].VpcId" --output text 2>/dev/null)

# If no default VPC, use the first available VPC
if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
    echo "No default VPC found, using first available VPC..."
    VPC_ID=$(aws ec2 describe-vpcs --region ${AWS_REGION} --query "Vpcs[0].VpcId" --output text)

    if [ -z "$VPC_ID" ] || [ "$VPC_ID" == "None" ]; then
        echo -e "${RED}Error: No VPC found in region${NC}"
        exit 1
    fi
fi

# Get all subnets in the VPC (across multiple AZs for high availability)
SUBNET_IDS=$(aws ec2 describe-subnets --region ${AWS_REGION} --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[*].SubnetId" --output text | tr '\t' ',')

echo -e "${GREEN}✓ VPC ID: ${VPC_ID}${NC}"
echo -e "${GREEN}✓ Subnets: ${SUBNET_IDS}${NC}"
echo ""

# Use existing security group
echo -e "${YELLOW}[3/7] Setting up security group...${NC}"

# Default to CAB432SG (or set via environment variable)
SG_NAME="${SECURITY_GROUP_NAME:-CAB432SG}"

echo "Looking for security group: ${SG_NAME}"
SG_ID=$(aws ec2 describe-security-groups \
    --region ${AWS_REGION} \
    --filters "Name=group-name,Values=${SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query "SecurityGroups[0].GroupId" \
    --output text 2>/dev/null)

if [ -z "$SG_ID" ] || [ "$SG_ID" == "None" ]; then
    echo -e "${RED}Error: Security group '${SG_NAME}' not found${NC}"
    echo -e "${YELLOW}Available security groups:${NC}"
    aws ec2 describe-security-groups --region ${AWS_REGION} --query 'SecurityGroups[*].[GroupName,GroupId]' --output table
    echo ""
    echo -e "${YELLOW}Please set SECURITY_GROUP_NAME environment variable or update the script${NC}"
    echo "Example: export SECURITY_GROUP_NAME=CAB432SG"
    exit 1
fi

echo -e "${GREEN}✓ Using existing security group: ${SG_ID} (${SG_NAME})${NC}"
echo ""

# Get Ubuntu 22.04 LTS AMI
echo -e "${YELLOW}[4/7] Getting Ubuntu 22.04 LTS AMI...${NC}"
AMI_ID=$(aws ec2 describe-images \
    --region ${AWS_REGION} \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text)

echo -e "${GREEN}✓ AMI ID: ${AMI_ID}${NC}"
echo ""

# Create user data script (same as your existing ec2-user-data.sh)
echo -e "${YELLOW}[5/7] Creating launch template...${NC}"

cat > /tmp/video-processor-user-data.sh <<'USERDATA_EOF'
#!/bin/bash
# EC2 User Data script for Video Processor ASG (Ubuntu 22.04)
set -e
exec > >(tee /var/log/user-data.log) 2>&1

echo "=== Video Processor Setup Started at $(date) ==="

# Update system
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# Install Docker
apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io
systemctl start docker
systemctl enable docker
usermod -a -G docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI v2
apt-get install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Configure AWS region
export AWS_REGION=ap-southeast-2
export AWS_DEFAULT_REGION=ap-southeast-2

# Install CloudWatch agent
echo "Installing CloudWatch agent..."
wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i -E ./amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# CloudWatch agent config
cat > /opt/aws/amazon-cloudwatch-agent/etc/config.json <<'CWCONFIG'
{
  "metrics": {
    "namespace": "VideoForge/VideoProcessor",
    "metrics_collected": {
      "cpu": {
        "measurement": [{"name": "cpu_usage_idle", "unit": "Percent"}],
        "metrics_collection_interval": 60,
        "totalcpu": false
      },
      "disk": {
        "measurement": [{"name": "used_percent", "unit": "Percent"}],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "mem": {
        "measurement": [{"name": "mem_used_percent", "unit": "Percent"}],
        "metrics_collection_interval": 60
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/video-processor/app.log",
            "log_group_name": "/asg/video-forge-video-processor",
            "log_stream_name": "{instance_id}/app",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "/asg/video-forge-video-processor",
            "log_stream_name": "{instance_id}/user-data",
            "timezone": "UTC"
          }
        ]
      }
    }
  }
}
CWCONFIG

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json

# Get instance metadata using IMDSv2
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null)
INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null)
AVAILABILITY_ZONE=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone 2>/dev/null)
echo "Instance ID: $INSTANCE_ID"
echo "Availability Zone: $AVAILABILITY_ZONE"

# Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

# Pull Video Processor container
echo "Pulling Video Processor image..."
docker pull 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-video-processor:latest

# Create log directory
mkdir -p /var/log/video-processor

# Create systemd service for video processor
cat > /etc/systemd/system/video-processor.service <<'SERVICEEOF'
[Unit]
Description=VideoForge Video Processor
After=docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="AWS_REGION=ap-southeast-2"
Environment="SQS_QUEUE_NAME=video-forge-video-processing-queue"
Environment="MAX_CONCURRENT_JOBS=2"
Environment="FFMPEG_THREADS=2"
ExecStartPre=-/usr/bin/docker stop video-processor
ExecStartPre=-/usr/bin/docker rm video-processor
ExecStart=/usr/bin/docker run --name video-processor \
  --log-driver=json-file \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -v /var/log/video-processor:/var/log/video-processor \
  -e NODE_ENV=production \
  -e AWS_REGION=ap-southeast-2 \
  -e SQS_QUEUE_NAME=video-forge-video-processing-queue \
  -e MAX_CONCURRENT_JOBS=2 \
  -e FFMPEG_THREADS=2 \
  901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-video-processor:latest
ExecStop=/usr/bin/docker stop video-processor

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Start the service
systemctl daemon-reload
systemctl enable video-processor
systemctl start video-processor

# Wait for service to start
sleep 5

# Check service status
if systemctl is-active --quiet video-processor; then
    echo "✓ Video Processor service is running"
else
    echo "✗ Video Processor service failed to start"
    systemctl status video-processor
fi

# Setup health check script
cat > /usr/local/bin/video-processor-health-check.sh <<'HEALTHCHECK'
#!/bin/bash
# Health check script for Video Processor

# Check if container is running
if ! docker ps | grep -q video-processor; then
    echo "Container not running"
    exit 1
fi

# Check if service is active
if ! systemctl is-active --quiet video-processor; then
    echo "Service not active"
    exit 1
fi

echo "Health check passed"
exit 0
HEALTHCHECK

chmod +x /usr/local/bin/video-processor-health-check.sh

# Setup monitoring cron job
echo "*/5 * * * * /usr/local/bin/video-processor-health-check.sh >> /var/log/video-processor/health-check.log 2>&1" | crontab -

echo "=== Video Processor setup completed at $(date) ==="
USERDATA_EOF

# Create Launch Template
# macOS uses base64 without -w flag, Linux uses -w 0 to remove line breaks
if base64 -w 0 /tmp/video-processor-user-data.sh 2>/dev/null >/dev/null; then
    # Linux
    USER_DATA_BASE64=$(base64 -w 0 /tmp/video-processor-user-data.sh)
else
    # macOS
    USER_DATA_BASE64=$(base64 -i /tmp/video-processor-user-data.sh | tr -d '\n')
fi

# Check if launch template exists
if aws ec2 describe-launch-templates --region ${AWS_REGION} --launch-template-names ${LAUNCH_TEMPLATE_NAME} &>/dev/null; then
    echo "Launch template exists, creating new version..."
    VERSION=$(aws ec2 create-launch-template-version \
        --region ${AWS_REGION} \
        --launch-template-name ${LAUNCH_TEMPLATE_NAME} \
        --version-description "Updated $(date '+%Y-%m-%d %H:%M:%S')" \
        --launch-template-data "{
            \"ImageId\": \"${AMI_ID}\",
            \"InstanceType\": \"${INSTANCE_TYPE}\",
            \"KeyName\": \"${KEY_NAME}\",
            \"IamInstanceProfile\": {\"Name\": \"${IAM_INSTANCE_PROFILE}\"},
            \"SecurityGroupIds\": [\"${SG_ID}\"],
            \"UserData\": \"${USER_DATA_BASE64}\",
            \"BlockDeviceMappings\": [{
                \"DeviceName\": \"/dev/xvda\",
                \"Ebs\": {
                    \"VolumeSize\": 50,
                    \"VolumeType\": \"gp3\",
                    \"Iops\": 3000,
                    \"DeleteOnTermination\": true,
                    \"Encrypted\": true
                }
            }],
            \"Monitoring\": {\"Enabled\": true},
            \"MetadataOptions\": {
                \"HttpTokens\": \"required\",
                \"HttpPutResponseHopLimit\": 1,
                \"HttpEndpoint\": \"enabled\"
            },
            \"TagSpecifications\": [{
                \"ResourceType\": \"instance\",
                \"Tags\": [
                    {\"Key\": \"Name\", \"Value\": \"VideoForge-VideoProcessor-ASG\"},
                    {\"Key\": \"Service\", \"Value\": \"video-processor\"},
                    {\"Key\": \"Environment\", \"Value\": \"production\"},
                    {\"Key\": \"ManagedBy\", \"Value\": \"ASG\"}
                ]
            }]
        }" --query 'LaunchTemplateVersion.VersionNumber' --output text)

    # Set as default
    aws ec2 modify-launch-template --region ${AWS_REGION} --launch-template-name ${LAUNCH_TEMPLATE_NAME} --default-version ${VERSION}
    echo -e "${GREEN}✓ Launch template version ${VERSION} created and set as default${NC}"
else
    echo "Creating new launch template..."
    aws ec2 create-launch-template \
        --region ${AWS_REGION} \
        --launch-template-name ${LAUNCH_TEMPLATE_NAME} \
        --version-description "Initial version - t3.medium for ASG" \
        --launch-template-data "{
            \"ImageId\": \"${AMI_ID}\",
            \"InstanceType\": \"${INSTANCE_TYPE}\",
            \"KeyName\": \"${KEY_NAME}\",
            \"IamInstanceProfile\": {\"Name\": \"${IAM_INSTANCE_PROFILE}\"},
            \"SecurityGroupIds\": [\"${SG_ID}\"],
            \"UserData\": \"${USER_DATA_BASE64}\",
            \"BlockDeviceMappings\": [{
                \"DeviceName\": \"/dev/xvda\",
                \"Ebs\": {
                    \"VolumeSize\": 50,
                    \"VolumeType\": \"gp3\",
                    \"Iops\": 3000,
                    \"DeleteOnTermination\": true,
                    \"Encrypted\": true
                }
            }],
            \"Monitoring\": {\"Enabled\": true},
            \"MetadataOptions\": {
                \"HttpTokens\": \"required\",
                \"HttpPutResponseHopLimit\": 1,
                \"HttpEndpoint\": \"enabled\"
            },
            \"TagSpecifications\": [{
                \"ResourceType\": \"instance\",
                \"Tags\": [
                    {\"Key\": \"Name\", \"Value\": \"VideoForge-VideoProcessor-ASG\"},
                    {\"Key\": \"Service\", \"Value\": \"video-processor\"},
                    {\"Key\": \"Environment\", \"Value\": \"production\"},
                    {\"Key\": \"ManagedBy\", \"Value\": \"ASG\"}
                ]
            }]
        }" > /dev/null
    echo -e "${GREEN}✓ Launch template created: ${LAUNCH_TEMPLATE_NAME}${NC}"
fi
echo ""

# Create CloudWatch Log Group if it doesn't exist
aws logs create-log-group --log-group-name /asg/video-forge-video-processor --region ${AWS_REGION} 2>/dev/null || true

# Create Auto Scaling Group
echo -e "${YELLOW}[6/7] Creating Auto Scaling Group...${NC}"

# Check if ASG exists
if aws autoscaling describe-auto-scaling-groups --region ${AWS_REGION} --auto-scaling-group-names ${ASG_NAME} --query "AutoScalingGroups[0]" --output text 2>/dev/null | grep -q "${ASG_NAME}"; then
    echo -e "${YELLOW}ASG already exists, updating...${NC}"
    aws autoscaling update-auto-scaling-group \
        --region ${AWS_REGION} \
        --auto-scaling-group-name ${ASG_NAME} \
        --launch-template "LaunchTemplateName=${LAUNCH_TEMPLATE_NAME},Version=\$Default" \
        --min-size ${MIN_SIZE} \
        --max-size ${MAX_SIZE} \
        --desired-capacity ${DESIRED_CAPACITY}
    echo -e "${GREEN}✓ ASG updated${NC}"
else
    echo "Creating new ASG..."
    aws autoscaling create-auto-scaling-group \
        --region ${AWS_REGION} \
        --auto-scaling-group-name ${ASG_NAME} \
        --launch-template "LaunchTemplateName=${LAUNCH_TEMPLATE_NAME},Version=\$Default" \
        --min-size ${MIN_SIZE} \
        --max-size ${MAX_SIZE} \
        --desired-capacity ${DESIRED_CAPACITY} \
        --vpc-zone-identifier "${SUBNET_IDS}" \
        --health-check-type EC2 \
        --health-check-grace-period 300 \
        --default-cooldown 300 \
        --tags "Key=Name,Value=VideoForge-VideoProcessor-ASG,PropagateAtLaunch=true" \
               "Key=Service,Value=video-processor,PropagateAtLaunch=true" \
               "Key=Environment,Value=production,PropagateAtLaunch=true"
    echo -e "${GREEN}✓ Auto Scaling Group created: ${ASG_NAME}${NC}"
fi
echo ""

# Setup Scaling Policies
echo -e "${YELLOW}[7/7] Setting up scaling policies based on SQS queue depth...${NC}"

# Get SQS Queue URL
SQS_QUEUE_URL=$(aws sqs get-queue-url --region ${AWS_REGION} --queue-name ${SQS_QUEUE_NAME} --query 'QueueUrl' --output text 2>/dev/null || echo "")

if [ -z "$SQS_QUEUE_URL" ]; then
    echo -e "${YELLOW}Warning: SQS queue '${SQS_QUEUE_NAME}' not found. Skipping scaling policies.${NC}"
    echo -e "${YELLOW}Create the queue first, then run this script again to add scaling policies.${NC}"
else
    echo "SQS Queue found: ${SQS_QUEUE_URL}"

    # Target tracking scaling policy based on SQS queue depth
    # Target: 5 messages per instance (so 10 messages = scale to 2 instances)
    aws autoscaling put-scaling-policy \
        --region ${AWS_REGION} \
        --auto-scaling-group-name ${ASG_NAME} \
        --policy-name video-processor-target-tracking-sqs \
        --policy-type TargetTrackingScaling \
        --target-tracking-configuration "{
            \"CustomizedMetricSpecification\": {
                \"MetricName\": \"ApproximateNumberOfMessagesVisible\",
                \"Namespace\": \"AWS/SQS\",
                \"Dimensions\": [{
                    \"Name\": \"QueueName\",
                    \"Value\": \"${SQS_QUEUE_NAME}\"
                }],
                \"Statistic\": \"Average\"
            },
            \"TargetValue\": 5.0
        }" > /dev/null 2>&1 && echo -e "${GREEN}✓ Target tracking scaling policy configured (target: 5 messages/instance)${NC}" || echo -e "${YELLOW}⚠ Could not create scaling policy (may already exist)${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}         Setup Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "Launch Template: ${YELLOW}${LAUNCH_TEMPLATE_NAME}${NC}"
echo -e "Auto Scaling Group: ${YELLOW}${ASG_NAME}${NC}"
echo -e "Instance Type: ${YELLOW}${INSTANCE_TYPE}${NC}"
echo -e "Key Pair: ${YELLOW}${KEY_NAME}${NC}"
echo -e "Min/Max/Desired: ${YELLOW}${MIN_SIZE}/${MAX_SIZE}/${DESIRED_CAPACITY}${NC}"
echo -e "Security Group: ${YELLOW}${SG_ID}${NC}"
echo -e "AMI: ${YELLOW}${AMI_ID}${NC}"
echo ""
echo -e "${GREEN}Useful Commands:${NC}"
echo ""
echo -e "${YELLOW}Monitor ASG:${NC}"
echo "aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names ${ASG_NAME} --region ${AWS_REGION}"
echo ""
echo -e "${YELLOW}View ASG instances:${NC}"
echo "aws ec2 describe-instances --filters \"Name=tag:aws:autoscaling:groupName,Values=${ASG_NAME}\" --region ${AWS_REGION} --query 'Reservations[*].Instances[*].[InstanceId,State.Name,PrivateIpAddress,PublicIpAddress]' --output table"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "aws logs tail /asg/video-forge-video-processor --follow --region ${AWS_REGION}"
echo ""
echo -e "${YELLOW}Scale manually (if needed):${NC}"
echo "aws autoscaling set-desired-capacity --auto-scaling-group-name ${ASG_NAME} --desired-capacity 2 --region ${AWS_REGION}"
echo ""
echo -e "${YELLOW}Test instance launch:${NC}"
echo "aws ec2 run-instances --launch-template LaunchTemplateName=${LAUNCH_TEMPLATE_NAME} --count 1 --region ${AWS_REGION}"
echo ""

# Cleanup
rm -f /tmp/video-processor-user-data.sh

echo -e "${GREEN}✓ All done!${NC}"
