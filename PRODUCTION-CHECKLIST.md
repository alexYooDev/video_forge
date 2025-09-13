# 🚀 Production Deployment Checklist

## Pre-Deployment Requirements

### 1. 🔐 EC2 Instance Setup
- [ ] Launch m5.large EC2 instance in your preferred region
- [ ] Configure Security Group:
  ```
  Inbound Rules:
  - Port 22 (SSH): Your IP only
  - Port 80 (HTTP): 0.0.0.0/0
  - Port 443 (HTTPS): 0.0.0.0/0  
  - Port 3000 (React): 0.0.0.0/0 (temporary)
  - Port 8000 (API): 0.0.0.0/0
  ```
- [ ] Create/download EC2 Key Pair (.pem file)
- [ ] Update `deploy-to-ec2.sh` with your key path
- [ ] Test SSH connection: `ssh -i your-key.pem ec2-user@3.25.84.108`

### 2. 🐳 Docker Registry (Choose One Option)

#### Option A: Use Docker Hub (Recommended for simplicity)
- [ ] Create Docker Hub account
- [ ] Update docker-compose.yml image names:
  ```yaml
  server:
    image: yourusername/video-forge-server:latest
  client:
    image: yourusername/video-forge-client:latest
  ```
- [ ] Build and push images:
  ```bash
  docker build -t yourusername/video-forge-server:latest ./server
  docker build -t yourusername/video-forge-client:latest ./client
  docker push yourusername/video-forge-server:latest
  docker push yourusername/video-forge-client:latest
  ```

#### Option B: Use AWS ECR (Current setup)
- [ ] Ensure your ECR repositories exist
- [ ] Authenticate Docker with ECR
- [ ] Push latest images to ECR

### 3. 📁 Volume & Data Management
- [ ] Verify production paths in `.env.production`
- [ ] Plan for persistent storage (videos, database)
- [ ] Consider EBS volumes for data persistence

## Deployment Steps

### 4. 🚀 Deploy to EC2
```bash
# 1. Set production environment
cp .env.production .env

# 2. Run deployment script
./deploy-to-ec2.sh

# 3. Monitor deployment
ssh -i your-key.pem ec2-user@54.206.200.144
cd ~/video_forge
docker-compose logs -f
```

### 5. ✅ Post-Deployment Verification
- [ ] Frontend accessible: http://video-forge.cab432.com:3000
- [ ] Backend API: http://video-forge.cab432.com:8000/api/health
- [ ] Database connection working
- [ ] Video upload/transcoding functionality
- [ ] All Docker containers running:
  ```bash
  docker-compose ps
  ```

## Production Hardening

### 6. 🔒 Security Enhancements
- [ ] Set up SSL/TLS certificates (Let's Encrypt)
- [ ] Configure reverse proxy (Nginx)
- [ ] Restrict database access
- [ ] Update JWT secret if needed
- [ ] Enable firewall rules
- [ ] Set up fail2ban for SSH protection

### 7. 📊 Monitoring & Logging
- [ ] Set up CloudWatch monitoring
- [ ] Configure log aggregation
- [ ] Set up health check endpoints
- [ ] Configure alerts for service failures

### 8. 🔄 Backup & Recovery
- [ ] Database backup strategy
- [ ] Video files backup to S3
- [ ] Docker volume snapshots
- [ ] Recovery procedure documentation

### 9. 🚀 Performance Optimization
- [ ] Enable compression in Nginx
- [ ] Configure CDN for static assets
- [ ] Optimize Docker images
- [ ] Database performance tuning
- [ ] Video processing queue optimization

## Scaling Preparation

### 10. 📈 Horizontal Scaling Setup
- [ ] Application Load Balancer configuration
- [ ] Auto Scaling Group setup
- [ ] Database separation (RDS)
- [ ] Shared storage solution (EFS/S3)
- [ ] Redis for session management
- [ ] Container orchestration (ECS/EKS consideration)

## Troubleshooting Commands

```bash
# Connect to EC2
ssh -i your-key.pem ec2-user@3.25.84.108

# Check application status
cd ~/video_forge
docker-compose ps
docker-compose logs

# Restart services
docker-compose restart

# Update application
docker-compose pull
docker-compose up -d

# Check system resources
top
df -h
free -h
```

## Environment URLs
- **Frontend**: http://video-forge.cab432.com:3000
- **Backend API**: http://video-forge.cab432.com:8000
- **Database**: Internal (docker network)

## Notes
- Remember to update DNS records if using a custom domain
- Consider using AWS Application Load Balancer for better availability
- Monitor costs and set up billing alerts
- Plan for database migrations and schema updates