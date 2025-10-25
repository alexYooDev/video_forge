# Quick Production Deployment Guide

Your app is ready for production! Follow these steps:

## Prerequisites
- EC2 m5.large instance: `3.25.84.108` (video-forge.cab432.com)
- SSH key in `~/.ssh/` directory
- ECR repositories configured
- Production environment configured

## Deployment Steps

### 1. Build and Push Docker Images
```bash
# Make sure you're logged into AWS
aws configure  # if not already configured

# Build and push to ECR
./prepare-ecr.sh
```

### 3. Deploy to EC2
```bash
# Set production environment
cp .env.production .env

# Deploy using docker-compose or your preferred method
# (Note: deploy-to-ec2.sh script has been removed)
```

### 4. Verify Deployment
After deployment, check these URLs:
- **Frontend**: http://video-forge.cab432.com:3000
- **Backend API**: http://video-forge.cab432.com:8000
- **Health Check**: http://video-forge.cab432.com:8000/api/health

### 5. Monitor & Troubleshoot
```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ec2-user@3.25.84.108

# Check container status
cd ~/video_forge
docker-compose ps

# View logs
docker-compose logs -f

# Restart if needed
docker-compose restart
```

## 🔒 Security Group Configuration
Make sure your EC2 Security Group allows:
```
Inbound Rules:
- Port 22 (SSH): Your IP only
- Port 3000 (React): 0.0.0.0/0
- Port 8000 (API): 0.0.0.0/0
```

## 🛠️ Troubleshooting

**If containers won't start:**
```bash
# Check Docker service
sudo service docker status
sudo service docker start

# Check available space
df -h

# Check memory
free -h
```

**If images won't pull:**
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com
```

## 🎯 Next Steps After Deployment
1. Test video upload and transcoding
2. Set up SSL certificate (Let's Encrypt)
3. Configure domain name
4. Set up monitoring and alerts
5. Plan for horizontal scaling

## 📞 Quick Commands Reference
```bash
# Redeploy after changes
# Deploy using docker-compose after ECR preparation
./prepare-ecr.sh

# Check logs
ssh -i ~/.ssh/your-key.pem ec2-user@54.206.200.144 'cd ~/video_forge && docker-compose logs --tail=50'

# Restart services
ssh -i ~/.ssh/your-key.pem ec2-user@54.206.200.144 'cd ~/video_forge && docker-compose restart'
```

Ready to deploy! 🚀