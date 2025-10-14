# VideoForge Use Cases & Workflows

## Service Overview

### Services in the Platform
1. **API Gateway Service** (server/) - Job management, authentication, SQS queuing
2. **Gallery Service** (services/gallery-service/) - Video streaming and playback
3. **Video Processor Service** (services/video-processor/) - Video transcoding

---

## Use Case 1: Upload and Stream Video (Simple Playback)

**Actors**: End User
**Services**: Gallery Service only
**Goal**: Upload a video and stream it back without transcoding

### Flow
```
1. User authenticates with Cognito
2. User requests upload URL
   → POST /api/upload/generate-url
   ← Pre-signed S3 PUT URL (expires in 1 hour)
3. User uploads video directly to S3
4. User confirms upload
   → POST /api/upload/confirm { s3Key, title, description }
   ← GalleryVideo record created (status: 'uploaded')
5. User browses gallery
   → GET /api/gallery/videos
   ← List of videos with metadata
6. User selects video to watch
   → GET /api/gallery/videos/:id/stream
   ← Pre-signed S3 GET URL for streaming
7. Browser streams video from S3
```

### API Calls
```bash
# 1. Generate upload URL
curl -X POST http://localhost:5000/api/upload/generate-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "my-video.mp4", "contentType": "video/mp4"}'

# Response:
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/gallery/user123/...",
  "s3Key": "gallery/user123/1234567890-my-video.mp4",
  "expiresIn": 3600
}

# 2. Upload video to S3 (client-side)
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @my-video.mp4

# 3. Confirm upload
curl -X POST http://localhost:5000/api/upload/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "s3Key": "gallery/user123/1234567890-my-video.mp4",
    "title": "My Amazing Video",
    "description": "A video I uploaded",
    "visibility": "public"
  }'

# Response:
{
  "id": 42,
  "title": "My Amazing Video",
  "s3Key": "gallery/user123/1234567890-my-video.mp4",
  "status": "uploaded",
  "visibility": "public"
}

# 4. Get stream URL
curl -X GET http://localhost:5000/api/gallery/videos/42/stream \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "streamUrl": "https://s3.amazonaws.com/bucket/gallery/user123/...?signature=..."
}
```

### Database State
```sql
-- After upload confirmation
SELECT * FROM gallery_videos WHERE id = 42;
/*
id: 42
user_id: "user123"
title: "My Amazing Video"
s3_key: "gallery/user123/1234567890-my-video.mp4"
status: "uploaded"
visibility: "public"
views: 0
*/
```

---

## Use Case 2: Upload, Transcode, and Stream (Full Processing)

**Actors**: End User
**Services**: API Gateway + Video Processor + Gallery Service
**Goal**: Upload video, transcode to multiple formats, stream optimized version

### Flow
```
1. User uploads video via Gallery Service (same as Use Case 1)
2. User creates transcoding job via API Gateway
   → POST /api/jobs { inputSource, outputFormats }
   ← Job created, message sent to SQS
3. Video Processor polls SQS
   → Receives job message
4. Video Processor downloads source video from S3
5. Video Processor transcodes video
   - Extracts metadata
   - Generates thumbnail
   - Generates GIF preview
   - Transcodes to multiple formats (1080p, 720p, 480p)
6. Video Processor uploads processed files to S3
7. Video Processor updates Job status to COMPLETED
8. [Optional] Video Processor updates GalleryVideo metadata
9. User checks job status via API Gateway
   → GET /api/jobs/:id
   ← Job status: COMPLETED, progress: 100%
10. User downloads/streams processed assets
    → GET /api/jobs/:id/assets
    ← List of processed video files, thumbnails, GIFs
```

### API Calls
```bash
# 1. Upload video (same as Use Case 1)
# ... (steps 1-3 from Use Case 1)

# 2. Create transcoding job
curl -X POST http://localhost:3000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputSource": "gallery/user123/1234567890-my-video.mp4",
    "outputFormats": ["high", "medium", "low"]
  }'

# Response:
{
  "job": {
    "id": 101,
    "userId": "user123",
    "inputSource": "gallery/user123/1234567890-my-video.mp4",
    "status": "PENDING",
    "progress": 0
  },
  "message": "Job created successfully"
}

# 3. Check job status
curl -X GET http://localhost:3000/api/jobs/101 \
  -H "Authorization: Bearer $TOKEN"

# Response (in progress):
{
  "job": {
    "id": 101,
    "status": "PROCESSING",
    "progress": 45,
    "duration": 120.5,
    "resolution": "1920x1080",
    "videoCodec": "h264",
    "audioCodec": "aac"
  }
}

# Response (completed):
{
  "job": {
    "id": 101,
    "status": "COMPLETED",
    "progress": 100
  }
}

# 4. Get processed assets
curl -X GET http://localhost:3000/api/jobs/101/assets \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "assets": [
    {
      "id": 1,
      "assetType": "thumbnail",
      "format": "jpg",
      "s3Key": "videos/output/101/thumbnail.jpg",
      "fileSize": 124532
    },
    {
      "id": 2,
      "assetType": "gif",
      "format": "gif",
      "s3Key": "videos/output/101/preview.gif",
      "fileSize": 2456789
    },
    {
      "id": 3,
      "assetType": "video",
      "format": "mp4",
      "quality": "high",
      "s3Key": "videos/output/101/high.mp4",
      "fileSize": 52345678
    },
    {
      "id": 4,
      "assetType": "video",
      "format": "mp4",
      "quality": "medium",
      "s3Key": "videos/output/101/medium.mp4",
      "fileSize": 32345678
    }
  ]
}

# 5. Download specific asset
curl -X GET http://localhost:3000/api/jobs/101/assets/3/download \
  -H "Authorization: Bearer $TOKEN" \
  -L -o high-quality.mp4
```

### Processing Logs (Video Processor)
```
[2025-10-05 10:00:00] Video Processing Service is running
[2025-10-05 10:01:23] Processing job from queue: jobId=101
[2025-10-05 10:01:23] Starting processing for job 101
[2025-10-05 10:01:23] Updating job status: DOWNLOADING
[2025-10-05 10:01:45] Downloaded video: /tmp/videoforge/101/input.mp4
[2025-10-05 10:01:45] Updating job status: PROCESSING (10%)
[2025-10-05 10:01:50] Video metadata extracted: 1920x1080, 120s, h264/aac
[2025-10-05 10:02:15] Thumbnail generated: /tmp/videoforge/101/thumbnail.jpg
[2025-10-05 10:02:40] GIF preview generated: /tmp/videoforge/101/preview.gif
[2025-10-05 10:02:41] Transcoding to high quality (1080p)...
[2025-10-05 10:05:30] High quality complete (50%)
[2025-10-05 10:05:31] Transcoding to medium quality (720p)...
[2025-10-05 10:07:45] Medium quality complete (75%)
[2025-10-05 10:07:46] Transcoding to low quality (480p)...
[2025-10-05 10:09:20] Low quality complete (90%)
[2025-10-05 10:09:21] Uploading assets to S3...
[2025-10-05 10:10:12] All assets uploaded
[2025-10-05 10:10:12] Updating job status: COMPLETED (100%)
[2025-10-05 10:10:13] Job 101 completed successfully
[2025-10-05 10:10:13] Cleaned up temp files
```

### Database State
```sql
-- Jobs table
SELECT * FROM jobs WHERE id = 101;
/*
id: 101
user_id: "user123"
input_source: "gallery/user123/1234567890-my-video.mp4"
output_format: "high,medium,low"
status: "COMPLETED"
progress: 100
duration: 120.50
resolution: "1920x1080"
video_codec: "h264"
audio_codec: "aac"
*/

-- Media assets table
SELECT * FROM media_assets WHERE job_id = 101;
/*
id  | asset_type | format | quality | s3_key
----|------------|--------|---------|--------
1   | thumbnail  | jpg    | NULL    | videos/output/101/thumbnail.jpg
2   | gif        | gif    | NULL    | videos/output/101/preview.gif
3   | video      | mp4    | high    | videos/output/101/high.mp4
4   | video      | mp4    | medium  | videos/output/101/medium.mp4
5   | video      | mp4    | low     | videos/output/101/low.mp4
*/
```

---

## Use Case 3: Browse Public Video Gallery

**Actors**: Anonymous User
**Services**: Gallery Service only
**Goal**: Discover and watch public videos without authentication

### Flow
```
1. User visits gallery (no auth)
   → GET /api/gallery/videos?visibility=public
   ← List of public videos only
2. User searches for videos
   → GET /api/gallery/videos?search=tutorial
   ← Filtered list of public videos
3. User views video details
   → GET /api/gallery/videos/42
   ← Video metadata + view count incremented
4. User streams video
   → GET /api/gallery/videos/42/stream
   ← Pre-signed S3 stream URL
```

### API Calls
```bash
# 1. List public videos (no auth)
curl -X GET "http://localhost:5000/api/gallery/videos?page=1&limit=10"

# Response:
{
  "videos": [
    {
      "id": 42,
      "title": "My Amazing Video",
      "description": "A video I uploaded",
      "visibility": "public",
      "status": "uploaded",
      "duration": 120.5,
      "resolution": "1920x1080",
      "views": 156,
      "thumbnailUrl": "videos/output/101/thumbnail.jpg",
      "createdAt": "2025-10-05T10:00:00Z",
      "userId": "user123"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}

# 2. Search videos
curl -X GET "http://localhost:5000/api/gallery/videos?search=amazing"

# 3. Get video details (increments view count)
curl -X GET "http://localhost:5000/api/gallery/videos/42"

# Response:
{
  "id": 42,
  "title": "My Amazing Video",
  "views": 157,  // Incremented
  "videoCodec": "h264",
  "audioCodec": "aac",
  "fileSize": 52345678
}

# 4. Stream video
curl -X GET "http://localhost:5000/api/gallery/videos/42/stream"

# Response:
{
  "streamUrl": "https://s3.amazonaws.com/..."
}
```

---

## Use Case 4: Manage Personal Video Library

**Actors**: Authenticated User
**Services**: Gallery Service
**Goal**: Manage uploaded videos (update metadata, change visibility, delete)

### Flow
```
1. User lists their videos
   → GET /api/gallery/videos (authenticated)
   ← Both public and private videos for this user
2. User updates video metadata
   → PUT /api/gallery/videos/42 { title, description }
   ← Video updated
3. User changes visibility to private
   → PUT /api/gallery/videos/42 { visibility: "private" }
   ← Video now private
4. User deletes video
   → DELETE /api/gallery/videos/42
   ← Video deleted (DB record only, S3 files remain)
```

### API Calls
```bash
# 1. List my videos (including private)
curl -X GET http://localhost:5000/api/gallery/videos \
  -H "Authorization: Bearer $TOKEN"

# 2. Update video metadata
curl -X PUT http://localhost:5000/api/gallery/videos/42 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "New description",
    "visibility": "private"
  }'

# Response:
{
  "id": 42,
  "title": "Updated Title",
  "description": "New description",
  "visibility": "private"
}

# 3. Delete video
curl -X DELETE http://localhost:5000/api/gallery/videos/42 \
  -H "Authorization: Bearer $TOKEN"

# Response:
{
  "message": "Video deleted successfully"
}
```

---

## Use Case 5: Admin Job Management

**Actors**: Admin User
**Services**: API Gateway
**Goal**: Monitor and manage all transcoding jobs across all users

### Flow
```
1. Admin views all jobs
   → GET /api/jobs/admin/all
   ← All jobs from all users
2. Admin checks processing statistics
   → GET /api/jobs/admin/stats
   ← Job statistics (pending, processing, completed, failed)
3. Admin restarts failed jobs
   → POST /api/jobs/admin/restart-failed
   ← Failed jobs requeued
4. Admin cleans up old jobs
   → DELETE /api/jobs/admin/cleanup-old?days=30
   ← Old jobs deleted
```

### API Calls
```bash
# 1. Get all jobs (admin only)
curl -X GET http://localhost:3000/api/jobs/admin/all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
{
  "jobs": [
    { "id": 101, "userId": "user123", "status": "COMPLETED" },
    { "id": 102, "userId": "user456", "status": "PROCESSING" },
    { "id": 103, "userId": "user789", "status": "FAILED" }
  ],
  "pagination": {...}
}

# 2. Get job statistics
curl -X GET http://localhost:3000/api/jobs/admin/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
{
  "totalJobs": 1523,
  "pending": 12,
  "processing": 5,
  "completed": 1489,
  "failed": 17,
  "avgProcessingTime": 342.5,  // seconds
  "totalStorageUsed": 52.3     // GB
}

# 3. Restart failed jobs
curl -X POST http://localhost:3000/api/jobs/admin/restart-failed \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
{
  "message": "17 failed jobs restarted",
  "jobIds": [103, 145, 189, ...]
}

# 4. Cleanup old jobs
curl -X DELETE "http://localhost:3000/api/jobs/admin/cleanup-old?days=90" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
{
  "message": "234 old jobs deleted",
  "freedSpace": 12.4  // GB
}
```

---

## Integration Points Between Services

### 1. Gallery Service → S3
- **Generate upload URL**: Pre-signed PUT URL for direct uploads
- **Generate stream URL**: Pre-signed GET URL for streaming
- **Check file existence**: Verify uploaded files exist

### 2. API Gateway → SQS → Video Processor
- **API Gateway**: Creates job, sends message to SQS queue
- **SQS Queue**: Buffers job messages
- **Video Processor**: Polls queue, processes jobs, updates database

### 3. Video Processor → S3
- **Download source**: Get original video for processing
- **Upload outputs**: Put transcoded videos, thumbnails, GIFs to S3
- **Storage management**: Cleanup orphaned files, generate reports

### 4. All Services → PostgreSQL
- **Gallery Service**: Reads/writes `gallery_videos` table
- **API Gateway**: Reads/writes `jobs` table
- **Video Processor**: Reads `jobs`, writes `media_assets`

### 5. All Services → Redis (Cache)
- **Gallery Service**: Cache video metadata, popular videos
- **API Gateway**: Cache user sessions, job statistics
- **Video Processor**: Cache S3 configuration

---

## Data Flow Diagrams

### Simple Upload & Stream
```
User
  │
  ├─1─→ POST /upload/generate-url → Gallery Service
  │                                      │
  │     ←──────────────────────────2────┤
  │           (S3 presigned URL)
  │
  ├─3─→ PUT s3://bucket/key → S3
  │
  ├─4─→ POST /upload/confirm → Gallery Service → PostgreSQL
  │                                                (gallery_videos)
  │
  ├─5─→ GET /gallery/videos → Gallery Service → PostgreSQL
  │
  ├─6─→ GET /videos/42/stream → Gallery Service
  │                                      │
  │     ←──────────────────────────7────┤
  │         (Stream URL)
  │
  └─8─→ GET s3://bucket/key → S3 → Stream video
```

### Full Transcoding Workflow
```
User
  │
  ├─1─→ POST /jobs → API Gateway → PostgreSQL (jobs table)
  │                      │
  │                      └─2─→ SQS Queue
  │                              │
  │                              └─3─→ Video Processor
  │                                      │
  │                                      ├─4─→ S3 (download source)
  │                                      │
  │                                      ├─5─→ FFmpeg (transcode)
  │                                      │
  │                                      ├─6─→ S3 (upload outputs)
  │                                      │
  │                                      └─7─→ PostgreSQL (update job)
  │
  ├─8─→ GET /jobs/101 → API Gateway → PostgreSQL
  │
  └─9─→ GET /jobs/101/assets → API Gateway → PostgreSQL (media_assets)
```

---

## Performance Characteristics

### Gallery Service
- **Request latency**: < 100ms (cached metadata)
- **Stream URL generation**: < 50ms (S3 presigned URL)
- **Throughput**: 1000+ req/s per container
- **Scaling**: Horizontal (add more ECS containers)

### Video Processor
- **Job processing time**: 2-10 minutes (depends on video length)
- **Concurrent jobs**: 1 per instance (CPU bound)
- **Throughput**: ~6-30 videos/hour per instance
- **Scaling**: Horizontal (add more EC2 instances based on queue depth)

### API Gateway
- **Request latency**: < 50ms (simple CRUD)
- **Job creation**: < 100ms (includes SQS send)
- **Throughput**: 500+ req/s per container
- **Scaling**: Horizontal (ECS auto-scaling)

---

## Error Handling

### Gallery Service Errors
```json
// 404 - Video not found
{
  "error": "Video not found"
}

// 403 - Private video access denied
{
  "error": "Access denied"
}

// 400 - Invalid request
{
  "error": "Filename is required"
}

// 500 - S3 error
{
  "error": "Failed to generate upload URL"
}
```

### Video Processor Errors
```json
// Job failure in database
{
  "id": 101,
  "status": "FAILED",
  "errorText": "Failed to download source video: 404 Not Found"
}

// Processing errors
- Download failed
- Transcoding failed (corrupt video)
- Upload failed (S3 permission denied)
- Metadata extraction failed
```

### Recovery Mechanisms
- **SQS retry**: Failed jobs automatically retry (up to 3 times)
- **Dead letter queue**: Permanently failed jobs moved to DLQ
- **Admin restart**: Admins can manually restart failed jobs
- **Graceful degradation**: Gallery continues working if processor is down

---

## Security Considerations

### Authentication
- **Gallery Service**: Optional auth (public videos), required for uploads/updates
- **API Gateway**: Required Cognito JWT token for all endpoints
- **Video Processor**: No public endpoints (internal service)

### Authorization
- **Video owners**: Can update/delete their own videos
- **Public videos**: Anyone can view
- **Private videos**: Only owner can view
- **Admin users**: Can manage all jobs

### S3 Security
- **Pre-signed URLs**: Time-limited (1 hour default)
- **Private bucket**: No public access, only via pre-signed URLs
- **IAM roles**: Services use minimal required permissions
- **Encryption**: S3 encryption at rest (AES-256)

---

**Last Updated**: 2025-10-05
**Status**: ✅ Use cases documented and verified
