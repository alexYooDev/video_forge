# ECS Deployment WITHOUT Service Discovery

Since you don't have permissions for Cloud Map service discovery, we'll use **Internal Application Load Balancers** for service communication.

## Architecture

```
Internet → Public ALB → API Gateway (ECS)
                          ↓
                          ├→ Internal ALB → Gallery Service (ECS)
                          └→ Internal ALB → Streaming Service (ECS)
```

## Step 1: Create ECS Cluster

```bash
aws ecs create-cluster --cluster-name video-forge-cluster --region ap-southeast-2
```

## Step 2: Create CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name /ecs/video-forge-gallery-service --region ap-southeast-2
aws logs create-log-group --log-group-name /ecs/video-forge-streaming-service --region ap-southeast-2
aws logs create-log-group --log-group-name /ecs/video-forge-api-gateway --region ap-southeast-2
```

## Step 3: Deploy Gallery Service with Internal ALB

### Via AWS Console:

1. **ECS Console** → **Clusters** → `video-forge-cluster` → **Services** → **Create**

2. **Compute configuration:**
   - Launch type: **Fargate**
   - Platform version: **LATEST**

3. **Deployment configuration:**
   - Task definition: **video-forge-gallery-service** (latest)
   - Service name: `gallery-service`
   - Desired tasks: **1**

4. **Networking:**
   - VPC: Your VPC
   - Subnets: Choose **2 private subnets**
   - Security group: **CAB432SG**
   - Public IP: **Turn OFF**

5. **Load balancing:**
   - Load balancer type: **Application Load Balancer**
   - Container: **gallery-service** port **5000**
   - Create new load balancer:
     - Name: `gallery-internal-alb`
     - **Scheme: Internal** ⚠️ (Very important!)
     - Subnets: Choose **2 private subnets**
   - Target group:
     - Name: `gallery-tg`
     - Protocol: **HTTP**
     - Port: **5000**
     - Health check path: `/health`
     - Health check interval: **30 seconds**

6. **Service discovery:** **Skip** (leave disabled)

7. Click **Create**

8. **SAVE THE INTERNAL ALB DNS NAME** - You'll need it for API Gateway!

## Step 4: Deploy Streaming Service with Internal ALB

Repeat Step 3 with these changes:
- Task definition: **video-forge-streaming-service**
- Service name: `streaming-service`
- Port: **5001**
- Load balancer name: `streaming-internal-alb`
- Target group name: `streaming-tg`
- Health check path: `/health`

**SAVE THE INTERNAL ALB DNS NAME**

## Step 5: Update API Gateway Environment Variables

Before deploying API Gateway, you need to update its task definition with the actual ALB endpoints.

### Get the ALB DNS names:

```bash
# Get gallery ALB DNS
aws elbv2 describe-load-balancers \
  --names gallery-internal-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text \
  --region ap-southeast-2

# Get streaming ALB DNS
aws elbv2 describe-load-balancers \
  --names streaming-internal-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text \
  --region ap-southeast-2
```

### Update the task definition:

1. Go to **ECS Console** → **Task Definitions** → `video-forge-api-gateway`
2. Click **Create new revision**
3. In the container definition, update **Environment variables:**

Change:
```
GALLERY_SERVICE_URL = http://gallery-service.video-forge.local:5000
STREAMING_SERVICE_URL = http://streaming-service.video-forge.local:5001
```

To:
```
GALLERY_SERVICE_URL = http://<gallery-internal-alb-dns-name>
STREAMING_SERVICE_URL = http://<streaming-internal-alb-dns-name>
```

For example:
```
GALLERY_SERVICE_URL = http://gallery-internal-alb-123456.ap-southeast-2.elb.amazonaws.com
STREAMING_SERVICE_URL = http://streaming-internal-alb-789012.ap-southeast-2.elb.amazonaws.com
```

4. Click **Create** to create the new revision

## Step 6: Deploy API Gateway with Public ALB

1. **ECS Console** → **Clusters** → `video-forge-cluster` → **Services** → **Create**

2. **Compute configuration:**
   - Launch type: **Fargate**

3. **Deployment configuration:**
   - Task definition: **video-forge-api-gateway** (use the NEW revision you just created)
   - Service name: `api-gateway`
   - Desired tasks: **1**

4. **Networking:**
   - VPC: Your VPC
   - Subnets: Choose **2 public subnets** ⚠️
   - Security group: Create new or use one that allows HTTP from internet
   - Public IP: **Turn ON**

5. **Load balancing:**
   - Load balancer type: **Application Load Balancer**
   - Container: **api-gateway** port **8000**
   - Create new load balancer:
     - Name: `video-forge-public-alb`
     - **Scheme: Internet-facing** ⚠️
     - Subnets: Choose **2 public subnets**
   - Listener: Port **80** (or 443 if you have SSL certificate)
   - Target group:
     - Name: `api-gateway-tg`
     - Protocol: **HTTP**
     - Port: **8000**
     - Health check path: `/api/health`

6. Click **Create**

## Step 7: Get the Public ALB URL

```bash
aws elbv2 describe-load-balancers \
  --names video-forge-public-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text \
  --region ap-southeast-2
```

This is your new API endpoint! For example:
```
video-forge-public-alb-123456.ap-southeast-2.elb.amazonaws.com
```

## Step 8: Update Your Client

Update your client application to use the new ALB URL:

In your client environment or Nginx config:
```
REACT_APP_API_BASE_URL=http://video-forge-public-alb-123456.ap-southeast-2.elb.amazonaws.com
```

## Step 9: Test Everything

```bash
# Test API Gateway health
curl http://<public-alb-dns>/api/health

# Test gallery endpoint
curl http://<public-alb-dns>/api/gallery/videos?limit=10

# Check service status
aws ecs describe-services \
  --cluster video-forge-cluster \
  --services gallery-service streaming-service api-gateway \
  --region ap-southeast-2
```

## Security Group Configuration

Make sure your security groups allow:

**CAB432SG** (for ECS tasks):
- Inbound: Port 5000 from API Gateway security group (gallery)
- Inbound: Port 5001 from API Gateway security group (streaming)
- Inbound: Port 5432 from itself (RDS)
- Outbound: All traffic

**API Gateway Security Group**:
- Inbound: Port 8000 from Public ALB security group
- Outbound: All traffic

**Public ALB Security Group**:
- Inbound: Port 80 from 0.0.0.0/0 (internet)
- Inbound: Port 443 from 0.0.0.0/0 (if using HTTPS)
- Outbound: All traffic

**Internal ALBs Security Group**:
- Inbound: Port 80 from CAB432SG
- Outbound: All traffic

## Troubleshooting

**Services not starting:**
```bash
aws logs tail /ecs/video-forge-gallery-service --follow --region ap-southeast-2
```

**ALB health checks failing:**
- Verify health check path is correct
- Check security groups allow traffic
- Review target group health in EC2 Console → Target Groups

**API Gateway can't reach internal services:**
- Verify ALB DNS names are correct in environment variables
- Check security groups allow traffic between services
- Test internal ALB connectivity from API Gateway task
