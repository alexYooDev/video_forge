# VideoForge Cloud-Native Architecture

## Overview

VideoForge uses a **4-microservice architecture** optimized for scalability, performance, and cost:

```
┌────────────────────────────────────────────────────────────────┐
│                    VideoForge Platform                          │
│              4 Microservices Architecture                       │
└────────────────────────────────────────────────────────────────┘

1. API Gateway (EC2/ECS)
   ├─ Authentication (Cognito)
   ├─ Job Management & SQS Queuing
   ├─ Rate Limiting
   └─ Redis Caching

2. Gallery Service (Lambda)
   ├─ Video Search & Browse
   ├─ Metadata CRUD
   ├─ Upload Management
   └─ User Library

3. Streaming Service (Lambda)
   ├─ Adaptive Quality Selection (YouTube-style)
   ├─ S3 Presigned URLs
   ├─ Thumbnail URLs
   └─ Playback Only (Read-only)

4. Video Processor (Auto Scaling Group)
   ├─ FFmpeg Transcoding (480p, 720p, 1080p, 4K)
   ├─ SQS Job Polling
   ├─ 1-3 EC2 Instances (t3.medium, Ubuntu 22.04)
   └─ Auto-scales on Queue Depth
```

## Service Breakdown

### 1. API Gateway Service
**Deployment:** EC2/ECS with Docker
**Port:** 8000
**Tech Stack:** Node.js, Express, Redis, Sequelize

**Responsibilities:**
- User authentication via Cognito
- Job creation and SQS queuing
- API routing and orchestration
- Rate limiting and security
- Redis caching layer

**Current Setup:**
```bash
docker-compose -f docker-compose.api-gateway.yml up
```

---

### 2. Gallery Service (Lambda)
**Deployment:** AWS Lambda Function
**Runtime:** Node.js 20.x
**Memory:** 512MB
**Timeout:** 30s

**Responsibilities:**
- ✅ Search & Browse videos (pagination, filters)
- ✅ Video metadata CRUD (create, update, delete)
- ✅ Upload URL generation (S3 presigned PUT)
- ✅ User library management
- ✅ View count tracking
- ❌ NO streaming URLs (delegated to Streaming Service)

**Database Operations:** Read/Write to `gallery_videos` table

**API Endpoints:**
```
GET    /api/gallery/videos              # List/search videos
GET    /api/gallery/videos/:id          # Get video details
PUT    /api/gallery/videos/:id          # Update metadata
DELETE /api/gallery/videos/:id          # Delete video
POST   /api/upload/url                  # Generate upload URL
POST   /api/upload/confirm              # Confirm upload
```

**Deployment:**
```bash
cd services/gallery-service
./deploy-lambda.sh
```

---

### 3. Streaming Service (Lambda) ⭐ NEW
**Deployment:** AWS Lambda Function
**Runtime:** Node.js 20.x
**Memory:** 512MB
**Timeout:** 10s (ultra-fast)

**Responsibilities:**
- ✅ List available qualities (480p, 720p, 1080p, 4K)
- ✅ Generate S3 presigned URLs for selected quality
- ✅ Thumbnail URL generation
- ✅ Adaptive streaming (YouTube-style quality selector)
- ❌ NO database writes (read-only)
- ❌ NO search/browse (delegated to Gallery Service)

**Database Operations:** Read-only from `media_assets` table

**API Endpoints:**
```
GET /api/stream/:videoId/qualities       # Get available qualities
GET /api/stream/:videoId?quality=720p    # Get stream URL
GET /api/stream/:videoId/thumbnail       # Get thumbnail
```

**YouTube-Style Quality Selection:**
```javascript
// 1. Get available qualities
const qualities = await fetch('/api/stream/123/qualities');
// Returns: [{ quality: '1080p', resolution: '1920x1080', ... }, ...]

// 2. User selects quality
const stream = await fetch('/api/stream/123?quality=720p');
// Returns: { streamUrl: 'https://s3...', expiresIn: 3600 }

// 3. Player loads stream
videoPlayer.src = stream.streamUrl;
```

**Deployment:**
```bash
cd services/streaming-service
./deploy-lambda.sh
```

---

### 4. Video Processor (Auto Scaling Group)
**Deployment:** EC2 Auto Scaling Group
**Instance Type:** t3.medium (2 vCPU, 4GB RAM)
**OS:** Ubuntu 22.04 LTS
**Scaling:** 1-3 instances based on SQS queue depth

**Responsibilities:**
- Poll SQS queue for processing jobs
- Download videos from S3/URLs
- FFmpeg transcoding to multiple qualities
- Thumbnail and GIF generation
- Upload processed assets to S3
- Update job status in database

**Scaling Policy:**
- **Target:** 5 messages per instance
- **Scale Out:** Queue > 5 msgs → add instance
- **Scale In:** Queue < 5 msgs → remove instance
- **Min/Max/Desired:** 1/3/1

**Deployment:**
```bash
./setup-video-processor-asg.sh
```

## Data Flow

### Upload → Process → Stream

```
1. User uploads video
   → Gallery Service: POST /api/upload/url (S3 presigned URL)
   → User uploads directly to S3
   → Gallery Service: POST /api/upload/confirm

2. User creates processing job
   → API Gateway: POST /api/jobs
   → API Gateway sends message to SQS
   → Video Processor polls SQS and picks up job

3. Video Processor transcodes
   → Downloads video from S3
   → Transcodes to 480p, 720p, 1080p
   → Generates thumbnail & GIF
   → Uploads to S3 as MediaAssets
   → Updates GalleryVideo.job_id

4. User watches video
   → Gallery Service: GET /api/gallery/videos/:id (metadata)
   → Streaming Service: GET /api/stream/:id/qualities (480p, 720p, 1080p)
   → User selects quality
   → Streaming Service: GET /api/stream/:id?quality=720p
   → User streams from S3
```

## Database Schema

### gallery_videos
```sql
CREATE TABLE gallery_videos (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  job_id BIGINT,  -- ⭐ Link to processing job
  title VARCHAR(255),
  description TEXT,
  s3_key VARCHAR(1024),  -- Original video
  visibility ENUM('public', 'private'),
  status ENUM('uploaded', 'processing', 'ready', 'failed'),
  views INTEGER DEFAULT 0,
  ...
);
```

### media_assets
```sql
CREATE TABLE media_assets (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT,  -- Link to job
  asset_type ENUM('480p', '720p', '1080p', '4K', 'THUMBNAIL', 'GIF'),
  s3_key VARCHAR(1024),  -- Processed asset S3 location
  resolution VARCHAR(20),
  bitrate INTEGER,
  file_size BIGINT,
  ...
);
```

## Service Separation Matrix

| Feature | API Gateway | Gallery | Streaming | Video Processor |
|---------|-------------|---------|-----------|-----------------|
| Authentication | ✅ | ❌ | ❌ | ❌ |
| Job Management | ✅ | ❌ | ❌ | ❌ |
| Search Videos | ❌ | ✅ | ❌ | ❌ |
| List Videos | ❌ | ✅ | ❌ | ❌ |
| Update Metadata | ❌ | ✅ | ❌ | ❌ |
| Upload URLs | ❌ | ✅ | ❌ | ❌ |
| Get Qualities | ❌ | ❌ | ✅ | ❌ |
| Stream URLs | ❌ | ❌ | ✅ | ❌ |
| Video Transcoding | ❌ | ❌ | ❌ | ✅ |
| SQS Polling | ❌ | ❌ | ❌ | ✅ |

## Deployment Steps

### Prerequisites

1. **Create IAM Roles** (see DEPLOYMENT_SUMMARY.md)
   - `VideoForgeVideoProcessorRole` (EC2)
   - `VideoForgeLambdaExecutionRole` (Lambda)

2. **Create CloudWatch Log Groups**
```bash
aws logs create-log-group --log-group-name /asg/video-forge-video-processor
aws logs create-log-group --log-group-name /aws/lambda/video-forge-gallery-service
aws logs create-log-group --log-group-name /aws/lambda/video-forge-streaming-service
```

### Step 1: Deploy Video Processor ASG
```bash
./setup-video-processor-asg.sh
```

### Step 2: Deploy Gallery Service Lambda
```bash
cd services/gallery-service
./deploy-lambda.sh
```

### Step 3: Deploy Streaming Service Lambda
```bash
cd services/streaming-service
./deploy-lambda.sh
```

### Step 4: Deploy API Gateway
```bash
docker-compose -f docker-compose.api-gateway.yml up -d
```

## Cost Breakdown

### Monthly Costs (USD)

**Video Processor ASG:**
- 1 t3.medium (24/7): ~$30/month
- 2 t3.medium (average): ~$60/month
- 3 t3.medium (peak): ~$90/month
- EBS (50GB gp3): ~$4/instance

**Gallery Service Lambda:**
- Free Tier: 1M requests/month
- Beyond: $0.20/1M requests
- Expected: $0-5/month

**Streaming Service Lambda:**
- High traffic (video plays)
- Expected: $5-15/month (100K-500K requests)

**Total Infrastructure:**
- **Minimum**: ~$40/month (1 processor + minimal Lambda)
- **Average**: ~$75/month (2 processors + moderate traffic)
- **Peak**: ~$110/month (3 processors + high traffic)

**Additional:**
- RDS PostgreSQL: $15-50/month
- S3 storage: $0.023/GB/month
- Data transfer: Varies

## Monitoring

### CloudWatch Metrics

```bash
# ASG instances
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names video-forge-video-processor-asg

# SQS queue depth
aws sqs get-queue-attributes \
  --queue-url <queue-url> \
  --attribute-names ApproximateNumberOfMessagesVisible

# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=video-forge-streaming-service
```

### Logs

```bash
# Video Processor
aws logs tail /asg/video-forge-video-processor --follow

# Gallery Service
aws logs tail /aws/lambda/video-forge-gallery-service --follow

# Streaming Service
aws logs tail /aws/lambda/video-forge-streaming-service --follow
```

## Why This Architecture?

### Scalability
- **Gallery Service**: Scales automatically with Lambda (low traffic)
- **Streaming Service**: Scales automatically with Lambda (high traffic)
- **Video Processor**: ASG scales 1-3 based on queue depth
- **API Gateway**: Can scale with ECS or ALB

### Cost Efficiency
- **Lambda for lightweight ops**: Pay only per request
- **EC2 for compute-heavy**: Predictable cost for FFmpeg
- **No idle costs**: Lambda scales to zero when not in use

### Performance
- **Gallery Service**: Fast database queries (<100ms)
- **Streaming Service**: Ultra-fast URL generation (<50ms)
- **Video Processor**: Dedicated compute for transcoding
- **Adaptive Streaming**: YouTube-style quality selection

### Separation of Concerns
- **API Gateway**: Auth & orchestration
- **Gallery**: Content discovery & management
- **Streaming**: Playback only (read-only)
- **Processor**: Transcoding only (background jobs)

## Key Files

```
video_forge_v2/
├── setup-video-processor-asg.sh           # ASG deployment
├── docker-compose.api-gateway.yml         # API Gateway config
├── ARCHITECTURE.md                        # This file
├── services/
│   ├── api-gateway/                       # API Gateway
│   │   ├── Dockerfile
│   │   └── src/
│   ├── gallery-service/                   # Gallery Lambda
│   │   ├── lambda-handler.js
│   │   ├── deploy-lambda.sh
│   │   └── src/
│   ├── streaming-service/                 # Streaming Lambda ⭐ NEW
│   │   ├── lambda-handler.js
│   │   ├── deploy-lambda.sh
│   │   └── src/
│   │       ├── controllers/streamingController.js
│   │       ├── routes/streamingRoutes.js
│   │       └── models/
│   └── video-processor/                   # Video Processor ASG
│       ├── Dockerfile
│       ├── ec2-user-data.sh
│       └── src/
└── README.md
```

---

**Last Updated**: 2025-10-17
**Architecture**: 4 Microservices
**Region**: ap-southeast-2 (Sydney)
**Account ID**: 901444280953
