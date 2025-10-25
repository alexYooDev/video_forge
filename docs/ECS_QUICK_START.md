# ECS Quick Start - Complete Environment Variables

**Ready to copy-paste into AWS Console!**

---

## 🔑 Your Credentials

**Database Password**: `4T5gnYmROThF`
**SQS Queue URL**: `https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue`

---

## 📋 Gallery Service Environment Variables

Copy these into ECS Task Definition for **video-forge-gallery-service**:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `AWS_REGION` | `ap-southeast-2` |
| `DB_HOST` | `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com` |
| `DB_NAME` | `videoforge` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `4T5gnYmROThF` |
| `DB_PORT` | `5432` |
| `S3_BUCKET` | `video-forge-storage` |
| `SQS_QUEUE_URL` | `https://sqs.ap-southeast-2.amazonaws.com/901444280953/video-forge-video-processing-queue` |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_jft50FBre` |
| `COGNITO_REGION` | `ap-southeast-2` |

---

## 📋 Streaming Service Environment Variables

Copy these into ECS Task Definition for **video-forge-streaming-service**:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `5001` |
| `AWS_REGION` | `ap-southeast-2` |
| `DB_HOST` | `database-1-instance-1.ce2haupt2cta.ap-southeast-2.rds.amazonaws.com` |
| `DB_NAME` | `videoforge` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `4T5gnYmROThF` |
| `DB_PORT` | `5432` |
| `S3_BUCKET` | `video-forge-storage` |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_jft50FBre` |
| `COGNITO_REGION` | `ap-southeast-2` |

---

## 🚀 Step-by-Step (15 minutes per service)

### Step 1: Go to ECS Console
https://ap-southeast-2.console.aws.amazon.com/ecs/v2/task-definitions

### Step 2: Update Gallery Service Task Definition
1. Click **"video-forge-gallery-service"**
2. Click **"Create new revision"** button
3. Scroll to **"Container - 1"** section
4. Find **"Environment variables"** section
5. Click **"Add environment variable"** for each variable above
6. Scroll down, click **"Create"**

### Step 3: Update Gallery Service
1. Go to **Clusters** → **video-forge-cluster**
2. Click **"Services"** tab
3. Select **"video-forge-gallery-service-service-v24pef3w"**
4. Click **"Update service"**
5. Under **"Task definition"**, select the new revision (should be :4 or higher)
6. Click **"Update"**
7. Wait 2-3 minutes

### Step 4: Check if Task is Running
1. Go to **Services** → Click service name
2. Click **"Tasks"** tab
3. Should see task with status **"RUNNING"** ✅

**If task is STOPPED**:
- Click task ID → See "Stopped reason"
- Click **"Logs"** tab → See actual error
- Common fix: Database security group (see below)

### Step 5: Repeat for Streaming Service
Same process for **video-forge-streaming-service**

---

## 🔧 Common Issue: Database Security Group

If tasks fail with **"Connection refused"** or **"ECONNREFUSED"**:

### Fix Database Security Group:
1. Go to **RDS Console**: https://ap-southeast-2.console.aws.amazon.com/rds
2. Click **"Databases"** → Click your database
3. Under **"Connectivity & security"**, click the **Security group** link
4. Click **"Edit inbound rules"**
5. Click **"Add rule"**:
   - **Type**: PostgreSQL
   - **Port**: 5432
   - **Source**: Custom → `sg-032bd1ff8cf77dbb9` (your ECS security group)
   - **Description**: "Allow ECS tasks"
6. Click **"Save rules"**
7. Go back to ECS and try again

---

## ✅ Success Checklist

- [ ] Gallery service task definition updated (new revision created)
- [ ] Gallery service updated to use new task definition
- [ ] Gallery service shows "Running count: 1"
- [ ] Streaming service task definition updated
- [ ] Streaming service updated to use new task definition
- [ ] Streaming service shows "Running count: 1"
- [ ] Both services have tasks with status "RUNNING"
- [ ] CloudWatch logs show "Database connected successfully"
- [ ] Database security group allows ECS connection

---

## 📊 What You'll See When It Works

**ECS Console** (Cluster → Services):
```
Service Name: video-forge-gallery-service-service-v24pef3w
Status: ACTIVE
Running count: 1  ← Should be 1, not 0!
Desired count: 1
```

**Task Logs** (Click task → Logs tab):
```
Gallery service running on port 5000
Database connected successfully
```

---

## 🎯 Next Steps After Tasks Are Running

Once both services show "Running count: 1":

1. **Test health endpoints** (I can help with CLI)
2. **Configure ALB target groups** (I can help via CLI)
3. **Add load balancer to services** (via Console)
4. **Test end-to-end flow**

---

## 💬 Need Help?

If you get stuck, tell me:
1. Which service you're working on
2. What the "Stopped reason" says (if task stopped)
3. What the CloudWatch logs show (if available)

I'll help you troubleshoot!

---

## 🎬 Ready?

**Start here**: https://ap-southeast-2.console.aws.amazon.com/ecs/v2/task-definitions

Follow **Step 2** above to update the Gallery service task definition first.

Good luck! 🚀
