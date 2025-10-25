# Service Separation Summary

## Overview
VideoForge has been successfully separated into distinct microservices with clear responsibilities. The video transcoding functionality is completely separated from the video gallery streaming service.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VideoForge Platform                      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
        ┌───────▼───────┐ ┌──▼──────────┐ ┌▼──────────────────┐
        │  API Gateway  │ │   Gallery   │ │ Video Processor   │
        │   Service     │ │  Service    │ │    Service        │
        │   (ECS)       │ │   (ECS)     │ │    (EC2 ASG)      │
        └───────────────┘ └─────────────┘ └───────────────────┘
             │                   │                  │
             │                   │                  │
             ▼                   ▼                  ▼
        ┌────────────────────────────────────────────────┐
        │         Shared Infrastructure                   │
        │  • PostgreSQL RDS                               │
        │  • Redis ElastiCache                            │
        │  • S3 Bucket                                    │
        │  • SQS Queue                                    │
        │  • Cognito                                      │
        └────────────────────────────────────────────────┘
```

## Service Responsibilities

### 1. Gallery Service (Streaming & Playback)
**Port**: 5000
**Deployment**: ECS Container
**Purpose**: Video streaming, gallery management, and user-facing video operations

#### Responsibilities
- ✅ Video listing with pagination and search
- ✅ Video metadata management (CRUD)
- ✅ Stream URL generation (pre-signed S3 URLs)
- ✅ Direct upload URL generation (S3 presigned PUT URLs)
- ✅ Upload confirmation and DB record creation
- ✅ View counting and analytics
- ✅ Visibility controls (public/private)
- ✅ Video metadata display (title, description, duration, etc.)

#### What It Does NOT Do
- ❌ No video transcoding
- ❌ No FFmpeg operations
- ❌ No video quality conversion
- ❌ No thumbnail generation
- ❌ No processing workflows

#### API Endpoints
```
GET    /api/gallery/videos       - List videos with search/filter
GET    /api/gallery/videos/:id   - Get video details
GET    /api/gallery/stream/:id   - Get stream URL
PUT    /api/gallery/videos/:id   - Update video metadata
DELETE /api/gallery/videos/:id   - Delete video

POST   /api/upload/url           - Generate upload URL
POST   /api/upload/confirm       - Confirm upload completion
```

#### Data Model
```javascript
GalleryVideo {
  id: INTEGER
  user_id: STRING (Cognito ID)
  title: STRING
  description: TEXT
  s3_key: STRING (original video location)
  visibility: ENUM('public', 'private')
  status: ENUM('uploaded', 'processing', 'ready', 'failed')
  duration: FLOAT
  resolution: STRING
  video_codec: STRING
  audio_codec: STRING
  file_size: BIGINT
  thumbnail_url: STRING
  views: INTEGER
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

#### Technology Stack
- Express.js server
- Sequelize ORM
- AWS SDK (S3 presigned URLs)
- JWT authentication middleware
- Winston logging

---

### 2. Video Processor Service (Transcoding)
**Deployment**: EC2 Auto Scaling Group
**Purpose**: CPU-intensive video transcoding and processing

#### Responsibilities
- ✅ SQS job polling and consumption
- ✅ Video downloading from S3 or URLs
- ✅ FFmpeg video transcoding to multiple formats
- ✅ Thumbnail generation
- ✅ GIF preview generation
- ✅ Video metadata extraction
- ✅ Multiple quality output (4K, 1080p, 720p, 480p, mobile)
- ✅ S3 upload of processed assets
- ✅ Job status updates in database
- ✅ Storage management (cleanup, orphaned files)

#### What It Does NOT Do
- ❌ No user-facing API endpoints
- ❌ No authentication handling
- ❌ No direct client interaction
- ❌ No streaming URL generation for end-users

#### Processing Workflow
```
1. Poll SQS queue for new jobs
2. Download source video from S3/URL
3. Extract video metadata
4. Update job status: DOWNLOADING → PROCESSING
5. Generate thumbnail (first frame)
6. Generate GIF preview
7. Transcode to multiple formats:
   - High quality (1080p, H.264)
   - Medium quality (720p, H.264)
   - Low quality (480p, H.264)
   - Mobile quality (optimized for mobile)
8. Upload all assets to S3
9. Save asset metadata to database
10. Update job status: COMPLETED
11. Clean up local temp files
```

#### Data Model
```javascript
Job {
  id: BIGINT
  user_id: STRING
  input_source: STRING (S3 URL or HTTP URL)
  output_format: STRING
  status: ENUM('PENDING', 'DOWNLOADING', 'PROCESSING',
               'UPLOADING', 'COMPLETED', 'FAILED', 'CANCELLED')
  progress: INTEGER (0-100)
  error_text: TEXT
  metadata_s3_key: STRING
  duration: DECIMAL
  original_size: BIGINT
  original_bitrate: INTEGER
  resolution: STRING
  video_codec: STRING
  audio_codec: STRING
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}

MediaAsset {
  id: BIGINT
  job_id: BIGINT (foreign key)
  asset_type: ENUM('video', 'thumbnail', 'gif', 'metadata')
  format: STRING
  s3_key: STRING
  s3_url: STRING
  file_size: BIGINT
  quality: STRING
  created_at: TIMESTAMP
}
```

#### Technology Stack
- Node.js worker process
- FFmpeg for video processing
- AWS SDK (S3, SQS)
- Sequelize ORM
- fs-extra for file operations

---

### 3. API Gateway Service (Existing)
**Port**: 3000
**Deployment**: ECS Container
**Purpose**: Authentication, routing, and job orchestration

#### Responsibilities
- User authentication (Cognito)
- API routing and request handling
- Job creation and SQS queuing
- Client serving (React app)
- Rate limiting and security

---

## Service Communication

### Gallery Service ↔ S3
```
User → Gallery Service → S3 Pre-signed Upload URL → User uploads directly to S3
User → Gallery Service → S3 Pre-signed Stream URL → User streams from S3
```

### Video Processor ↔ SQS
```
API Gateway → SQS Queue → Video Processor polls for jobs
Video Processor → Updates job status in database
```

### Data Flow: Upload → Process → Stream
```
1. User requests upload URL from Gallery Service
2. Gallery Service generates S3 pre-signed PUT URL
3. User uploads video directly to S3
4. User confirms upload to Gallery Service
5. Gallery Service creates GalleryVideo record (status: uploaded)
6. [Optional] API Gateway creates transcoding Job and sends to SQS
7. Video Processor picks up job from SQS
8. Video Processor downloads, transcodes, uploads to S3
9. Video Processor updates Job status to COMPLETED
10. User requests video from Gallery Service
11. Gallery Service generates S3 pre-signed GET URL
12. User streams video from S3
```

---

## Why This Separation?

### 1. Different Scaling Characteristics
- **Gallery Service**: Scales based on user requests (I/O bound)
- **Video Processor**: Scales based on processing queue depth (CPU bound)

### 2. Technology Optimization
- **Gallery Service**: Lightweight containers, fast deployment (ECS)
- **Video Processor**: High CPU instances, FFmpeg optimized (EC2)

### 3. Fault Isolation
- Gallery streaming continues working even if processing is down
- Processing failures don't affect video playback
- Each service can be deployed/updated independently

### 4. Cost Efficiency
- Gallery Service: Pay only for API request compute
- Video Processor: Auto-scale based on queue, scale to zero when idle
- No wasted compute on idle transcoding capacity

### 5. Development Velocity
- Teams can work on gallery features without touching processing code
- Independent testing and deployment
- Clear API boundaries

---

## Deployment Architecture

### Gallery Service (ECS)
```yaml
Service: gallery-service
Cluster: videoforge-cluster
Task Definition: gallery-service:latest
Desired Count: 2-10 (auto-scaling)
Scaling Metric: CPU, Request Count
Load Balancer: ALB with path-based routing (/api/gallery/*)
Health Check: GET /health
Environment: Containerized (Docker)
```

### Video Processor (EC2 ASG)
```yaml
Service: video-processor
Instance Type: t3.large (2 vCPU, 8GB RAM)
AMI: Amazon Linux 2 with FFmpeg
Scaling Policy: SQS Queue Depth (target: 5 messages per instance)
Min Instances: 0
Max Instances: 10
Health Check: EC2 instance status
Environment: EC2 with user-data script
```

---

## Configuration

### Gallery Service Environment Variables
```bash
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videoforge
DB_USER=postgres
DB_PASSWORD=password

# AWS
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=videoforge-media
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***

# Authentication
JWT_SECRET=***
COGNITO_USER_POOL_ID=***
COGNITO_CLIENT_ID=***
```

### Video Processor Environment Variables
```bash
# AWS
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=videoforge-media
SQS_QUEUE_URL=https://sqs.ap-southeast-2.amazonaws.com/.../video-jobs
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=videoforge
DB_USER=postgres
DB_PASSWORD=password

# Processing
MAX_CONCURRENT_JOBS=1
TEMP_DIR=/tmp/videoforge
FFMPEG_THREADS=2
```

---

## Testing the Separation

### Test Gallery Service Only
```bash
cd services/gallery-service
npm install
npm run dev

# Test upload URL generation
curl -X POST http://localhost:5000/api/upload/url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "test.mp4"}'

# Test video listing
curl http://localhost:5000/api/gallery/videos
```

### Test Video Processor Only
```bash
cd services/video-processor
npm install
npm run dev

# Processor will poll SQS queue automatically
# Send test job to SQS queue to trigger processing
```

### Integration Test
1. Upload video via gallery service
2. Create processing job via API gateway
3. Monitor video processor logs for processing
4. Check gallery service for updated video metadata
5. Stream video via gallery service

---

## Migration Checklist

- [x] Gallery Service created with streaming-only functionality
- [x] Video Processor contains all FFmpeg/transcoding code
- [x] S3Service separated (gallery: streaming URLs, processor: upload/download)
- [x] Separate data models (GalleryVideo vs Job/MediaAsset)
- [x] No shared code between services (except infrastructure)
- [x] Environment variables configured for both services
- [x] Documentation updated
- [ ] Dockerfiles created for both services
- [ ] ECS task definitions created
- [ ] EC2 user data script tested
- [ ] Auto-scaling policies configured
- [ ] Load balancer routing configured
- [ ] Integration tests passing

---

## Future Enhancements

### Gallery Service
- [ ] Add CDN integration (CloudFront)
- [ ] Implement adaptive bitrate streaming (HLS/DASH)
- [ ] Add comment and rating system
- [ ] Implement playlist functionality
- [ ] Add share/embed functionality

### Video Processor
- [ ] Multi-quality output (4K, 1080p, 720p, 480p)
- [ ] HLS/DASH segment generation
- [ ] Advanced audio processing
- [ ] Subtitle extraction
- [ ] AI-based content analysis

### Cross-Service
- [ ] Event-driven architecture (SNS/EventBridge)
- [ ] Real-time processing status updates (WebSocket)
- [ ] Distributed tracing (X-Ray)
- [ ] Centralized logging (CloudWatch)

---

**Last Updated**: 2025-10-05
**Status**: ✅ Service separation complete
**Next Steps**: Deploy to AWS, configure auto-scaling
