# VideoForge Video Processing Service

The Video Processing Service handles CPU-intensive video transcoding operations using FFmpeg for the VideoForge microservices architecture.

## Responsibilities

- **SQS Polling**: Monitor SQS queue for video processing jobs
- **Video Transcoding**: Convert videos to multiple quality levels (4K, 1080p, 720p, 480p)
- **Thumbnail Generation**: Create video thumbnails and animated GIFs
- **S3 Operations**: Upload processed media to S3 storage
- **Database Updates**: Update job status and save media asset records

## Environment Variables

Configure the following in your `.env.development` or `.env.production` file:

```bash
# SQS Configuration
SQS_QUEUE_NAME=video-processing-queue
SQS_POLLING_INTERVAL=5000

# Processing Configuration
MAX_CONCURRENT_JOBS=2
FFMPEG_THREADS=2

# Database Configuration (loaded from AWS SSM/Secrets Manager in production)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=video_forge_dev
PG_USERNAME=postgres
PG_PASSWORD=password

# AWS Configuration
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=video-forge-storage

# Sample video for testing
SAMPLE_VIDEO_URL=https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4
```

## Installation

```bash
cd services/video-processor
npm install
```

## FFmpeg Requirement

This service requires FFmpeg to be installed on the system:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# Amazon Linux 2
sudo amazon-linux-extras install epel
sudo yum install ffmpeg

# macOS
brew install ffmpeg
```

## Development

```bash
# Development with auto-reload
npm run dev

# Production mode
npm start
```

## Deployment

This service is designed to run on **EC2** instances for CPU-intensive video processing workloads.

## Processing Pipeline

1. **Poll SQS Queue**: Continuously monitor for new processing jobs
2. **Download Video**: Fetch source video from URL or S3
3. **Extract Metadata**: Get video properties (duration, resolution, codecs)
4. **Generate Assets**:
   - Video thumbnail (JPEG)
   - Animated GIF preview
   - Multiple quality transcodes (MP4)
5. **Upload to S3**: Store all processed media
6. **Update Database**: Save media asset records and job completion status
7. **Cleanup**: Remove temporary local files

## Supported Output Formats

- **4K (2160p)**: 3840x2160, H.264, 8000k bitrate
- **1080p**: 1920x1080, H.264, 5000k bitrate
- **720p**: 1280x720, H.264, 2500k bitrate
- **480p**: 854x480, H.264, 1000k bitrate

## Architecture

- **SQS Long Polling** for efficient job consumption
- **Concurrent Processing** with configurable job limits
- **FFmpeg Integration** via fluent-ffmpeg library
- **PostgreSQL** database for job status tracking
- **AWS S3** for processed media storage
- **Graceful Shutdown** handling for clean process termination

## Scaling

The service can be horizontally scaled by:
- Running multiple EC2 instances
- Adjusting `MAX_CONCURRENT_JOBS` per instance
- Using Auto Scaling Groups based on SQS queue depth