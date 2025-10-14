#!/bin/bash
# EC2 User Data script for Video Processor
# This script runs on EC2 instance launch

set -e

# Update system
yum update -y

# Install Docker
amazon-linux-extras install docker -y
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Login to ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com

# Pull and run Video Processor container
docker pull 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-video-processor:latest

# Create systemd service for video processor
cat > /etc/systemd/system/video-processor.service <<'EOF'
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
ExecStartPre=-/usr/bin/docker stop video-processor
ExecStartPre=-/usr/bin/docker rm video-processor
ExecStart=/usr/bin/docker run --name video-processor \
  --log-driver=awslogs \
  --log-opt awslogs-region=ap-southeast-2 \
  --log-opt awslogs-group=/ec2/video-forge-video-processor \
  --log-opt awslogs-stream=video-processor \
  -e NODE_ENV=production \
  -e AWS_REGION=ap-southeast-2 \
  -e SQS_QUEUE_NAME=video-forge-video-processing-queue \
  901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-video-processor:latest
ExecStop=/usr/bin/docker stop video-processor

[Install]
WantedBy=multi-user.target
EOF

# Start the service
systemctl daemon-reload
systemctl enable video-processor
systemctl start video-processor

echo "Video Processor installation complete"
