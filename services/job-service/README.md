# VideoForge API Gateway Service

The API Gateway handles authentication, job management, storage operations, and client serving for the VideoForge microservices architecture.

## Responsibilities

- **Authentication & Authorization**: Cognito integration, JWT token validation
- **Job Management**: Create, read, update, delete video processing jobs
- **Storage Operations**: S3 pre-signed URLs for file uploads/downloads
- **SQS Integration**: Queue jobs for video processing service
- **Client Serving**: Serve the React frontend and handle API routing

## Environment Variables

Configure the following in your `.env.development` or `.env.production` file:

```bash
# Server Configuration
SERVER_PORT=8000
SERVER_HOST=localhost

# SQS Configuration
SQS_QUEUE_NAME=video-processing-queue

# Database Configuration (loaded from AWS SSM/Secrets Manager in production)
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=video_forge_dev
PG_USERNAME=postgres
PG_PASSWORD=password

# Cache Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
CACHE_ENABLED=true

# AWS Configuration
AWS_REGION=ap-southeast-2
S3_BUCKET_NAME=video-forge-storage

# Cognito Configuration (loaded from AWS SSM/Secrets Manager)
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-client-id
COGNITO_CLIENT_SECRET=your-client-secret
```

## Installation

```bash
cd services/api-gateway
npm install
```

## Development

```bash
# Development with auto-reload
npm run dev

# Production mode
npm start
```

## Deployment

This service is designed to run on **ECS** for automatic scaling and load balancing.

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/jobs` - List user jobs
- `POST /api/jobs` - Create new video processing job
- `GET /api/jobs/:id` - Get job details
- `DELETE /api/jobs/:id` - Delete job
- `GET /api/storage/upload-url` - Get S3 upload URL
- `GET /api/storage/download-url` - Get S3 download URL

## Architecture

- **Express.js** server with middleware for security, CORS, and logging
- **PostgreSQL** database with Sequelize ORM
- **Redis** caching layer for performance
- **AWS SQS** for job queuing to video processing service
- **AWS Cognito** for user authentication
- **AWS S3** for file storage operations