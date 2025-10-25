# VideoForge Streaming Service

Lightweight Lambda service for adaptive quality video streaming (YouTube-style).

## Purpose

Serves video content with adaptive quality selection - generates S3 presigned URLs for specific video qualities.

## Features

- **Adaptive Quality Selection** - List available qualities (480p, 720p, 1080p, 4K)
- **Quality-Specific Streaming** - Get stream URL for user-selected quality
- **Thumbnail URLs** - Generate presigned URLs for video thumbnails
- **Lightweight** - Read-only operations, no database writes
- **Fast Response** - Optimized for low latency (<100ms)

## API Endpoints

### Get Available Qualities
```http
GET /api/stream/:videoId/qualities
```

**Response:**
```json
{
  "videoId": 123,
  "title": "My Video",
  "thumbnail": "https://...",
  "qualities": [
    {
      "quality": "1080p",
      "label": "1080p",
      "resolution": "1920x1080",
      "fileSize": 52345678,
      "bitrate": 5000,
      "available": true
    },
    {
      "quality": "720p",
      "label": "720p",
      "resolution": "1280x720",
      "fileSize": 32345678,
      "bitrate": 2500,
      "available": true
    }
  ]
}
```

### Get Stream URL
```http
GET /api/stream/:videoId?quality=720p
```

**Query Parameters:**
- `quality` (optional): `480p`, `720p`, `1080p`, `4k`, `auto` (default: `auto`)

**Response:**
```json
{
  "streamUrl": "https://s3.amazonaws.com/...",
  "quality": "720p",
  "videoId": 123,
  "expiresIn": 3600
}
```

### Get Thumbnail
```http
GET /api/stream/:videoId/thumbnail
```

**Response:**
```json
{
  "thumbnailUrl": "https://s3.amazonaws.com/..."
}
```

## Database Schema

### GalleryVideo (links to Jobs)
```sql
CREATE TABLE gallery_videos (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  job_id BIGINT,  -- Link to processing job
  title VARCHAR(255),
  s3_key VARCHAR(1024),  -- Original video
  visibility ENUM('public', 'private'),
  status ENUM('uploaded', 'processing', 'ready', 'failed'),
  ...
);
```

### MediaAsset (transcoded outputs)
```sql
CREATE TABLE media_assets (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT,  -- Link to job
  asset_type ENUM('480p', '720p', '1080p', '4K', 'THUMBNAIL', 'GIF'),
  s3_key VARCHAR(1024),  -- Processed asset location
  resolution VARCHAR(20),
  bitrate INTEGER,
  file_size BIGINT,
  ...
);
```

## Deployment

### Local Development
```bash
cd services/streaming-service
npm install
npm run dev  # Runs on port 5001
```

### Lambda Deployment
```bash
cd services/streaming-service
./deploy-lambda.sh
```

## Configuration

Set these as Lambda environment variables:

```bash
NODE_ENV=production
AWS_REGION=ap-southeast-2
DB_HOST=<rds-endpoint>
DB_NAME=videoforge
DB_USER=<db-user>
DB_PASSWORD=<from-secrets-manager>
S3_BUCKET_NAME=video-forge-storage
```

## Performance

- **Cold Start**: ~1-2s (database connection)
- **Warm Request**: <100ms (just generates presigned URL)
- **Concurrency**: High (no writes, minimal database load)
- **Cost**: $0.20 per 1M requests

## Use Cases

### 1. Video Player Initial Load
```javascript
// Frontend: Get available qualities
const qualities = await fetch('/api/stream/123/qualities');
// Show quality selector: Auto, 1080p, 720p, 480p

// Get stream URL for selected quality
const stream = await fetch('/api/stream/123?quality=720p');
videoPlayer.src = stream.streamUrl;
```

### 2. Quality Switching (YouTube-style)
```javascript
// User clicks quality selector
const changeQuality = async (quality) => {
  const { streamUrl } = await fetch(`/api/stream/123?quality=${quality}`);
  videoPlayer.src = streamUrl;
  videoPlayer.play();
};
```

### 3. Auto Quality Selection
```javascript
// Default to 'auto' - picks best available
const { streamUrl } = await fetch('/api/stream/123?quality=auto');
```

## Separation from Gallery Service

| Feature | Gallery Service | Streaming Service |
|---------|----------------|-------------------|
| **Search videos** | ✅ | ❌ |
| **List videos** | ✅ | ❌ |
| **Update metadata** | ✅ | ❌ |
| **Delete videos** | ✅ | ❌ |
| **Upload management** | ✅ | ❌ |
| **Get qualities** | ❌ | ✅ |
| **Generate stream URLs** | ❌ | ✅ |
| **Playback only** | ❌ | ✅ |

## Architecture

```
User Request
    ↓
API Gateway / ALB
    ↓
Streaming Lambda ← VPC → RDS (read MediaAssets)
    ↓
Generate S3 Presigned URL
    ↓
Return to User
    ↓
User streams directly from S3
```

## Monitoring

```bash
# View logs
aws logs tail /aws/lambda/video-forge-streaming-service --follow

# Test function
aws lambda invoke \
  --function-name video-forge-streaming-service \
  --payload '{"httpMethod":"GET","path":"/api/stream/123/qualities"}' \
  response.json
```

---

**Last Updated**: 2025-10-17
**Service Type**: AWS Lambda Function
**Dependencies**: RDS PostgreSQL, S3
