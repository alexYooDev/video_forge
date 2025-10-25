# ECS Console Setup Guide - Step by Step

**Goal**: Configure ECS services manually via AWS Console to get them running

**Date**: 2025-10-23

---

## 🔍 Current Problem Analysis

### Service Status:
- **video-forge-gallery-service**: 0/1 tasks running (FAILING)
- **video-forge-streaming-service**: 0/1 tasks running (FAILING)
- **video-forge-api-gateway-service**: 0/2 tasks running (FAILING)

### Why Tasks Are Failing:
1. ❌ **Missing environment variables** (DB password, S3 bucket, SQS URL, Cognito config)
2. ❌ **Wrong ports** (Task def shows 5000/5001, app might expect different)
3. ⚠️ **Database initialization** (App tries to connect to DB on startup, might fail)

### What We Found:
- ✅ ECR images exist: `video-forge-gallery-service:latest`
- ✅ Task execution role exists: `Execution-Role-CAB432-ECS`
- ✅ Task role exists: `Task-Role-CAB432-ECS`
- ❌ Environment variables are minimal (only PORT, AWS_REGION, NODE_ENV)
- ❌ Database credentials not configured

---

## 📝 Step-by-Step Guide

### Part 1: Gather Required Information (5 minutes)

#### 1.1 Database Information
**You need**:
```bash
DB_HOST: database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com
DB_NAME: videoforge
DB_USER: postgres
DB_PASSWORD: <from secrets manager or your notes>
```

**How to find DB password**:
1. Go to AWS Console → Secrets Manager
2. Look for secret named `database-1` or `rds-db-secret` or similar
3. Click "Retrieve secret value"
4. Copy the password

**Alternative**: Check your local `.env` file:
```bash
cat services/.env.local | grep DB_PASSWORD
```

#### 1.2 S3 Bucket
```bash
S3_BUCKET: video-forge-storage
```

#### 1.3 SQS Queue URL
```bash
# Get queue URL
aws sqs get-queue-url --queue-name video-forge-video-processing-queue --region ap-southeast-2
```

Expected:
```
SQS_QUEUE_URL: https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue
```

#### 1.4 Cognito Configuration
```bash
COGNITO_USER_POOL_ID: ap-southeast-2_jft50FBre
COGNITO_REGION: ap-southeast-2
```

---

### Part 2: Update Gallery Service Task Definition (15-20 minutes)

#### Step 2.1: Navigate to ECS Task Definitions
1. Go to AWS Console: https://ap-southeast-2.console.aws.amazon.com/ecs
2. Click **"Task definitions"** in the left menu
3. Click **"video-forge-gallery-service"**
4. Click **"Create new revision"** button

#### Step 2.2: Configure Task Definition Basics
**Don't change** (keep existing values):
- Task definition family: `video-forge-gallery-service`
- Launch type: `AWS Fargate`
- Operating system: `Linux/X86_64`
- Task role: `Task-Role-CAB432-ECS`
- Task execution role: `Execution-Role-CAB432-ECS`
- Task memory: `1 GB`
- Task CPU: `0.5 vCPU`

#### Step 2.3: Configure Container
Scroll to **"Container - 1"** section:

**Container name**: `gallery-service` (keep)
**Image URI**: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-gallery-service:latest`

**Port mappings**:
- Container port: `5000`
- Protocol: `TCP`
- App protocol: `HTTP`

#### Step 2.4: Add Environment Variables (CRITICAL)
Scroll to **"Environment variables"** section:

Click **"Add environment variable"** for each:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `AWS_REGION` | `ap-southeast-2` |
| `DB_HOST` | `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com` |
| `DB_NAME` | `videoforge` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `<YOUR_DB_PASSWORD>` ⚠️ |
| `DB_PORT` | `5432` |
| `S3_BUCKET` | `video-forge-storage` |
| `SQS_QUEUE_URL` | `https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue` |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_jft50FBre` |
| `COGNITO_REGION` | `ap-southeast-2` |

**IMPORTANT**: Replace `<YOUR_DB_PASSWORD>` with actual password!

#### Step 2.5: Configure Logging (Keep Existing)
**Log configuration**:
- Log driver: `awslogs`
- Log group: `/ecs/video-forge-gallery-service`
- Region: `ap-southeast-2`
- Stream prefix: `ecs`
- ✅ Check "Auto-configure CloudWatch Logs"

#### Step 2.6: Health Check (Optional but Recommended)
Scroll to **"Health check"** section:

**Command**:
```
CMD-SHELL,curl -f http://localhost:5000/health || exit 1
```

**Interval**: `30` seconds
**Timeout**: `5` seconds
**Start period**: `60` seconds (give DB time to connect)
**Retries**: `3`

#### Step 2.7: Create Task Definition
1. Click **"Create"** at the bottom
2. Wait for confirmation message
3. Note the new revision number (should be `video-forge-gallery-service:4` or higher)

---

### Part 3: Update Streaming Service Task Definition (15 minutes)

#### Repeat Part 2 for Streaming Service

**Navigate to**: Task definitions → `video-forge-streaming-service` → Create new revision

**Container name**: `streaming-service`
**Image**: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-streaming-service:latest`
**Port**: `5001` (or check your code - might be `4000`)

**Environment variables**:
| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5001` |
| `AWS_REGION` | `ap-southeast-2` |
| `DB_HOST` | `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com` |
| `DB_NAME` | `videoforge` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `<YOUR_DB_PASSWORD>` |
| `DB_PORT` | `5432` |
| `S3_BUCKET` | `video-forge-storage` |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_jft50FBre` |
| `COGNITO_REGION` | `ap-southeast-2` |

**Health check command**:
```
CMD-SHELL,curl -f http://localhost:5001/health || exit 1
```

Click **"Create"**.

---

### Part 4: Update API Gateway Service Task Definition (Optional)

If you want to use EC2 API Gateway with Lambda, you can **skip this** and delete the service later.

If you want API Gateway on ECS:
- Same process as above
- Port: `8000`
- Add environment variables for `GALLERY_SERVICE_URL` and `STREAMING_SERVICE_URL`

---

### Part 5: Update ECS Services to Use New Task Definitions (10 minutes)

#### Step 5.1: Update Gallery Service
1. Go to **ECS → Clusters → video-forge-cluster**
2. Click **"Services"** tab
3. Select **"video-forge-gallery-service-service-v24pef3w"**
4. Click **"Update service"**

**Configuration**:
- Task definition: Select the **new revision** you just created (e.g., `video-forge-gallery-service:4`)
- Desired tasks: `1`
- Min running tasks: `1`
- Max running tasks: `1` (or `3` if you want auto-scaling)

**DO NOT CHANGE**:
- Launch type: Fargate
- Platform version: LATEST
- VPC, Subnets, Security groups (keep existing)

**Load balancing** (SKIP FOR NOW):
- You can add this later after confirming tasks start successfully

5. Click **"Update"** at the bottom
6. Wait 2-3 minutes for new task to start

#### Step 5.2: Check Service Status
1. Go to **Services** tab
2. Click the service name
3. Go to **"Tasks"** tab
4. You should see a task with status **"RUNNING"** (or "PENDING" → "RUNNING")

**If task is STOPPED**:
1. Click the stopped task ID
2. Look at **"Stopped reason"** - this tells you what went wrong
3. Common issues:
   - Database connection failed → Check DB_PASSWORD
   - Container failed health check → Check port mapping
   - Image pull failed → Check ECR image exists

#### Step 5.3: Repeat for Streaming Service
Same process for `video-forge-streaming-service-service-ivo8hq2q`

---

### Part 6: Verify Tasks Are Running (5 minutes)

#### Step 6.1: Check Task Logs
1. Go to service → **Tasks** tab
2. Click on the **Task ID**
3. Click **"Logs"** tab
4. You should see logs like:
   ```
   Gallery service running on port 5000
   Database connected successfully
   ```

**If you see errors**:
- **"Connection refused"**: Check DB_HOST and DB_PORT
- **"Authentication failed"**: Check DB_PASSWORD
- **"getaddrinfo ENOTFOUND"**: DB_HOST is wrong
- **"ECONNREFUSED"**: Database security group doesn't allow ECS connection

#### Step 6.2: Test Health Endpoint (Optional)
If you added load balancer:
1. Get task public IP (if using public subnet) or use ALB
2. Test: `curl http://<TASK_IP>:5000/health`

Expected response:
```json
{
  "status": "ok",
  "service": "gallery-service"
}
```

---

## 🔧 Troubleshooting Common Issues

### Issue 1: Tasks Keep Stopping
**Symptom**: Task starts, then stops after 10-30 seconds

**Causes**:
1. Database connection failed
2. Missing environment variables
3. Health check failing

**Solution**:
1. Click stopped task → Check "Stopped reason"
2. Check CloudWatch logs → See actual error
3. Fix environment variables → Create new task definition revision
4. Update service → Use new revision

### Issue 2: "Essential container exited"
**Cause**: Your Node.js app crashed

**Solution**:
1. Check logs in CloudWatch
2. Look for error messages (DB connection, missing env vars)
3. Add missing environment variables
4. Ensure DB security group allows ECS connection:
   - Go to RDS → database-1 → Security → Security groups
   - Edit inbound rules → Add PostgreSQL (5432) from ECS security group

### Issue 3: "CannotPullContainerError"
**Cause**: ECS can't pull image from ECR

**Solution**:
1. Check execution role has `AmazonECSTaskExecutionRolePolicy`
2. Verify image exists: `aws ecr describe-images --repository-name video-forge-gallery-service --region ap-southeast-2`
3. Check image URI is exactly: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/video-forge-gallery-service:latest`

### Issue 4: Database Security Group
**Problem**: ECS tasks can't connect to RDS

**Solution**:
1. Go to **RDS Console** → Your database → **Connectivity & security**
2. Click the **Security group** link
3. Edit **Inbound rules**
4. Add rule:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Security group of ECS tasks (`sg-032bd1ff8cf77dbb9`)
   - Description: "Allow ECS tasks"
5. Save

---

## 📋 Quick Reference: Environment Variables Checklist

Use this as a checklist when creating task definitions:

### Gallery Service (`port 5000`):
- [ ] `NODE_ENV=production`
- [ ] `PORT=5000`
- [ ] `AWS_REGION=ap-southeast-2`
- [ ] `DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
- [ ] `DB_NAME=videoforge`
- [ ] `DB_USER=postgres`
- [ ] `DB_PASSWORD=<actual password>`
- [ ] `DB_PORT=5432`
- [ ] `S3_BUCKET=video-forge-storage`
- [ ] `SQS_QUEUE_URL=https://sqs...queue`
- [ ] `COGNITO_USER_POOL_ID=ap-southeast-2_jft50FBre`
- [ ] `COGNITO_REGION=ap-southeast-2`

### Streaming Service (`port 5001`):
- [ ] `NODE_ENV=production`
- [ ] `PORT=5001`
- [ ] `AWS_REGION=ap-southeast-2`
- [ ] `DB_HOST=database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com`
- [ ] `DB_NAME=videoforge`
- [ ] `DB_USER=postgres`
- [ ] `DB_PASSWORD=<actual password>`
- [ ] `DB_PORT=5432`
- [ ] `S3_BUCKET=video-forge-storage`
- [ ] `COGNITO_USER_POOL_ID=ap-southeast-2_jft50FBre`
- [ ] `COGNITO_REGION=ap-southeast-2`

---

## 🎯 Expected Timeline

| Task | Time | Cumulative |
|------|------|------------|
| Gather DB password & configs | 5 min | 5 min |
| Update Gallery task definition | 15 min | 20 min |
| Update Streaming task definition | 15 min | 35 min |
| Update Gallery service | 5 min | 40 min |
| Update Streaming service | 5 min | 45 min |
| Wait for tasks to start | 5 min | 50 min |
| Verify logs & troubleshoot | 10 min | 60 min |

**Total: ~1 hour** (if everything goes smoothly)

---

## ✅ Success Criteria

You'll know it's working when:
1. ✅ Service shows **"Running count: 1"** (not 0)
2. ✅ Task status is **"RUNNING"** (not STOPPED or PENDING forever)
3. ✅ CloudWatch logs show: **"Database connected successfully"** and **"Gallery service running on port 5000"**
4. ✅ Health endpoint returns: `{"status":"ok"}`

---

## 🚦 What to Do After Tasks Are Running

Once tasks are running successfully:

1. **Configure ALB Target Groups** (I can help with this via CLI)
2. **Add Load Balancer to Services** (via Console or CLI)
3. **Configure Auto Scaling** (optional)
4. **Test end-to-end flow**

---

## 📞 Need Help?

If you get stuck, let me know:
1. Which step you're on
2. What error message you see (in Console or CloudWatch logs)
3. Screenshot of the issue (if helpful)

I can help troubleshoot and guide you through the fix!

---

## 🎬 Ready to Start?

**Next step**:
1. Find your DB password (Secrets Manager or `.env.local`)
2. Open AWS Console → ECS → Task Definitions
3. Follow Part 2 above to update Gallery service task definition

Let me know when you're ready to start or if you need help with any step!
