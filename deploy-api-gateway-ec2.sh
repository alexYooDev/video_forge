#!/bin/bash

# Deploy API Gateway to EC2 Instance
# Connects to Lambda Function URLs for gallery and streaming services

set -e

REGION="ap-southeast-2"
KEY_NAME="CAB432"
SECURITY_GROUP="sg-032bd1ff8cf77dbb9"
SUBNET="subnet-04cc288ea3b2e1e53"
INSTANCE_TYPE="t3.small"

# Lambda Function URLs
GALLERY_LAMBDA_URL="https://xipqsagjkfm3qc666xjj5xz4n40gyuju.lambda-url.ap-southeast-2.on.aws"
STREAMING_LAMBDA_URL="https://zlhtbz7nh3tktqvbsb3jbadrum0fihxo.lambda-url.ap-southeast-2.on.aws"

# Database and AWS config
DB_HOST="database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com"
DB_NAME="cohort_2025"
DB_USER="s458"
DB_PASSWORD="4T5gnYmROThF"
S3_BUCKET="video-forge-storage"
COGNITO_USER_POOL_ID="ap-southeast-2_jft50FBre"
COGNITO_CLIENT_ID="59ff9f0j33qp7al3vje4j4isc0"
JWT_SECRET="v8CH5wbdp9iPJHyBXQA2a8ALW58QJ9Ek"

echo "=========================================="
echo "VideoForge API Gateway EC2 Deployment"
echo "=========================================="
echo ""
echo "This will deploy API Gateway to EC2"
echo "connecting to Lambda Function URLs"
echo ""

# Step 1: Create User Data Script
echo "Step 1/4: Creating user data script..."

cat > /tmp/api-gateway-userdata.sh << 'USERDATA_EOF'
#!/bin/bash
set -x
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

# Update system
yum update -y

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# Install PM2 globally
npm install -g pm2

# Create app directory
mkdir -p /opt/videoforge
cd /opt/videoforge

# Clone or copy API Gateway code
# For now, we'll create a minimal version
cat > package.json << 'EOF'
{
  "name": "video-forge-api-gateway",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  }
}
EOF

# Create directory structure
mkdir -p src/routes src/utils src/middleware

# Create logger
cat > src/utils/logger.js << 'EOF'
const winston = require('winston');

const apiLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = { apiLogger };
EOF

# Create gallery router
cat > src/routes/galleryRouter.js << 'EOF'
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { apiLogger } = require('../utils/logger');

const GALLERY_SERVICE_URL = process.env.GALLERY_SERVICE_URL;

router.use(async (req, res) => {
  try {
    const targetUrl = `${GALLERY_SERVICE_URL}/api/gallery${req.path}`;
    apiLogger.info(`Proxying ${req.method} to gallery: ${targetUrl}`);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined,
      },
      validateStatus: () => true,
    });

    Object.entries(response.headers).forEach(([key, value]) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.set(key, value);
      }
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    apiLogger.error('Gallery proxy error:', error.message);
    res.status(503).json({ error: 'Gallery service unavailable' });
  }
});

module.exports = router;
EOF

# Create streaming router
cat > src/routes/streamingRouter.js << 'EOF'
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { apiLogger } = require('../utils/logger');

const STREAMING_SERVICE_URL = process.env.STREAMING_SERVICE_URL;

router.use(async (req, res) => {
  try {
    const targetUrl = `${STREAMING_SERVICE_URL}/api/stream${req.path}`;
    apiLogger.info(`Proxying ${req.method} to streaming: ${targetUrl}`);

    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        ...req.headers,
        host: undefined,
      },
      validateStatus: () => true,
    });

    Object.entries(response.headers).forEach(([key, value]) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.set(key, value);
      }
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    apiLogger.error('Streaming proxy error:', error.message);
    res.status(503).json({ error: 'Streaming service unavailable' });
  }
});

module.exports = router;
EOF

# Create main app
cat > src/index.js << 'EOF'
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { apiLogger } = require('./utils/logger');

const app = express();
const PORT = process.env.SERVER_PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  apiLogger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    environment: process.env.NODE_ENV || 'production'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    galleryUrl: process.env.GALLERY_SERVICE_URL,
    streamingUrl: process.env.STREAMING_SERVICE_URL
  });
});

// Routes
app.use('/api/gallery', require('./routes/galleryRouter'));
app.use('/api/stream', require('./routes/streamingRouter'));

// Error handling
app.use((err, req, res, next) => {
  apiLogger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  apiLogger.info(`API Gateway running on port ${PORT}`);
  apiLogger.info(`Gallery Service: ${process.env.GALLERY_SERVICE_URL}`);
  apiLogger.info(`Streaming Service: ${process.env.STREAMING_SERVICE_URL}`);
});
EOF

# Create .env file with environment variables
cat > .env << EOF
NODE_ENV=production
SERVER_PORT=8080
GALLERY_SERVICE_URL=__GALLERY_URL__
STREAMING_SERVICE_URL=__STREAMING_URL__
DB_HOST=__DB_HOST__
DB_NAME=__DB_NAME__
DB_USER=__DB_USER__
DB_PASSWORD=__DB_PASSWORD__
S3_BUCKET_NAME=__S3_BUCKET__
COGNITO_USER_POOL_ID=__COGNITO_POOL__
COGNITO_CLIENT_ID=__COGNITO_CLIENT__
JWT_SECRET=__JWT_SECRET__
AWS_REGION=__REGION__
EOF

# Install dependencies
npm install

# Start with PM2
pm2 start src/index.js --name api-gateway
pm2 save
pm2 startup systemd -u root --hp /root

echo "API Gateway deployed successfully!"
USERDATA_EOF

# Replace placeholders in user data (macOS compatible)
sed -i '' "s|__GALLERY_URL__|$GALLERY_LAMBDA_URL|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__STREAMING_URL__|$STREAMING_LAMBDA_URL|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__DB_HOST__|$DB_HOST|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__DB_NAME__|$DB_NAME|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__DB_USER__|$DB_USER|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__DB_PASSWORD__|$DB_PASSWORD|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__S3_BUCKET__|$S3_BUCKET|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__COGNITO_POOL__|$COGNITO_USER_POOL_ID|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__COGNITO_CLIENT__|$COGNITO_CLIENT_ID|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__JWT_SECRET__|$JWT_SECRET|g" /tmp/api-gateway-userdata.sh
sed -i '' "s|__REGION__|$REGION|g" /tmp/api-gateway-userdata.sh

echo "✓ User data script created"
echo ""

# Step 2: Launch EC2 Instance
echo "Step 2/4: Launching EC2 instance..."

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id ami-0146fc9ad419e2cfd \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SECURITY_GROUP \
  --subnet-id $SUBNET \
  --user-data file:///tmp/api-gateway-userdata.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=video-forge-api-gateway},{Key=Service,Value=api-gateway}]" \
  --region $REGION \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✓ Instance launched: $INSTANCE_ID"
echo ""

# Step 3: Wait for instance to be running
echo "Step 3/4: Waiting for instance to be running..."

aws ec2 wait instance-running \
  --instance-ids $INSTANCE_ID \
  --region $REGION

echo "✓ Instance is running"
echo ""

# Step 4: Get instance details
echo "Step 4/4: Getting instance details..."

INSTANCE_INFO=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].[PublicIpAddress,PrivateIpAddress]' \
  --output text)

PUBLIC_IP=$(echo $INSTANCE_INFO | awk '{print $1}')
PRIVATE_IP=$(echo $INSTANCE_INFO | awk '{print $2}')

echo "✓ Instance details retrieved"
echo ""

echo "=========================================="
echo "✓ API Gateway Deployed Successfully!"
echo "=========================================="
echo ""
echo "Instance ID: $INSTANCE_ID"
echo "Public IP:   $PUBLIC_IP"
echo "Private IP:  $PRIVATE_IP"
echo ""
echo "Endpoints:"
echo "  Health: http://$PUBLIC_IP:8080/health"
echo "  API:    http://$PUBLIC_IP:8080/api/health"
echo ""
echo "The instance is initializing. Wait 2-3 minutes, then test:"
echo "  curl http://$PUBLIC_IP:8080/health"
echo ""
echo "Next steps:"
echo "  1. Wait for initialization to complete"
echo "  2. Test the health endpoint"
echo "  3. Create Application Load Balancer"
echo "  4. Configure HTTPS with ACM"
echo ""
echo "To SSH into instance:"
echo "  ssh -i ~/.ssh/$KEY_NAME.pem ec2-user@$PUBLIC_IP"
echo ""
echo "To check logs:"
echo "  ssh ec2-user@$PUBLIC_IP 'pm2 logs api-gateway'"
echo ""
