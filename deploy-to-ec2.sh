#!/bin/bash

# Video Forge Production Deployment Script for EC2
# Usage: ./deploy-to-ec2.sh

set -e  # Exit on any error

echo "🚀 Starting Video Forge Production Deployment..."

# Configuration
EC2_USER="ec2-user"
EC2_HOST="54.206.200.144"
SSH_KEY_PATH="~/.ssh/your-ec2-key.pem"  # Update with your actual key filename
REPO_URL="https://github.com/your-username/video_forge.git"  # Update this

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Prepare production environment
echo "📋 Step 1: Preparing production environment..."
cp .env.production .env
print_status "Environment configuration set to production"

# Step 2: Build production Docker images locally (if needed)
echo "🔨 Step 2: Building Docker images..."
docker-compose -f docker-compose.yml build 2>/dev/null || echo "Using pre-built images from registry"

# Step 3: Connect to EC2 and setup
echo "🌐 Step 3: Connecting to EC2 instance..."

ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_HOST << 'ENDSSH'
    echo "🔧 Setting up EC2 instance..."
    
    # Update system
    sudo yum update -y
    
    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        echo "📦 Installing Docker..."
        sudo yum install docker -y
        sudo service docker start
        sudo usermod -a -G docker ec2-user
        sudo chkconfig docker on
    fi
    
    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        echo "📦 Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
    fi
    
    # Create application directory
    mkdir -p ~/video_forge
    cd ~/video_forge
    
    echo "✅ EC2 instance setup complete"
ENDSSH

# Step 4: Copy application files to EC2
echo "📁 Step 4: Copying application files..."
scp -i $SSH_KEY_PATH -r .env docker-compose.yml $EC2_USER@$EC2_HOST:~/video_forge/
print_status "Application files copied to EC2"

# Step 5: Deploy application
echo "🚀 Step 5: Deploying application..."
ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_HOST << 'ENDSSH'
    cd ~/video_forge
    
    # Stop existing containers if any
    docker-compose down 2>/dev/null || true
    
    # Pull latest images and start services
    docker-compose -f docker-compose.yml pull
    docker-compose -f docker-compose.yml up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to start..."
    sleep 30
    
    # Check service status
    docker-compose -f docker-compose.yml ps
    
    echo "🎉 Deployment complete!"
ENDSSH

print_status "Deployment completed successfully!"
echo ""
echo "🌐 Your application should now be available at:"
echo "   Frontend: http://54.206.200.144:3000"
echo "   Backend:  http://54.206.200.144:8000"
echo ""
print_warning "Make sure your EC2 Security Group allows inbound traffic on ports 3000 and 8000"
echo ""
echo "📋 Next steps:"
echo "   1. Test the application endpoints"
echo "   2. Monitor logs: ssh -i $SSH_KEY_PATH $EC2_USER@$EC2_HOST 'cd ~/video_forge && docker-compose logs -f'"
echo "   3. Set up SSL certificate for production use"