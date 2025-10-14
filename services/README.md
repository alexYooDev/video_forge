# VideoForge Microservices Architecture

This directory contains the microservices implementation of VideoForge for CAB432 Assessment 3, transforming the monolithic application into separate, scalable services.

## Architecture Overview

The application has been split into two main microservices:

### 1. API Gateway Service (ECS Deployment)
- **Purpose**: I/O-intensive operations, client serving, and API management
- **Technology**: Express.js server
- **Deployment**: AWS ECS for automatic scaling and load balancing
- **Responsibilities**:
  - User authentication and authorization (Cognito)
  - Job management APIs (CRUD operations)
  - Storage operations (S3 pre-signed URLs)
  - SQS job queuing
  - Client serving

### 2. Video Processing Service (EC2 Deployment)
- **Purpose**: CPU-intensive video transcoding operations
- **Technology**: Node.js with FFmpeg integration
- **Deployment**: AWS EC2 for high-performance computing
- **Responsibilities**:
  - SQS job polling and consumption
  - Video transcoding (multiple qualities)
  - Thumbnail and GIF generation
  - S3 media uploads
  - Database status updates

## Service Communication

```
Client Request → API Gateway → SQS Queue → Video Processor
     ↓                           ↓              ↓
 Database Updates          Job Queuing     Processing
     ↓                           ↓              ↓
 Client Response           Status Updates  S3 Upload
```

## Directory Structure

```
services/
├── api-gateway/           # Express.js API server
│   ├── package.json       # Dependencies for web server, auth, SQS client
│   ├── src/
│   │   ├── server.js      # Main entry point
│   │   ├── routes/        # API route handlers
│   │   ├── controllers/   # Business logic
│   │   ├── services/      # Service layer (auth, cache, SQS)
│   │   ├── middleware/    # Authentication, error handling
│   │   ├── models/        # Database models
│   │   └── config/        # Configuration files
│   └── README.md
│
├── video-processor/       # Video processing worker
│   ├── package.json       # Dependencies for FFmpeg, SQS client, S3
│   ├── src/
│   │   ├── processor.js   # Main entry point
│   │   ├── services/      # Processing services (FFmpeg, SQS polling)
│   │   ├── models/        # Database models
│   │   └── config/        # Configuration files
│   └── README.md
│
├── .env.development       # Shared environment configuration
└── README.md             # This file
```

## Deployment Strategy

### API Gateway (ECS)
- **Container orchestration** for automatic scaling
- **Load balancing** across multiple instances
- **Health checks** and automatic recovery
- **Environment**: Containerized with Docker

### Video Processor (EC2)
- **High-performance computing** instances
- **Auto Scaling Groups** based on SQS queue depth
- **Spot instances** for cost optimization
- **Environment**: Direct EC2 deployment

## Shared Infrastructure

Both services share:
- **PostgreSQL RDS**: Job and user data storage
- **Redis ElastiCache**: Caching layer for performance
- **S3**: Media file storage
- **SQS**: Job queue for service communication
- **Cognito**: User authentication
- **SSM/Secrets Manager**: Configuration management

## Environment Configuration

Copy `.env.development` to configure both services:

```bash
# Copy environment file
cp .env.development api-gateway/.env.development
cp .env.development video-processor/.env.development
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis server
- FFmpeg (for video processor)
- AWS credentials configured

### API Gateway
```bash
cd api-gateway
npm install
npm run dev
```

### Video Processor
```bash
cd video-processor
npm install
npm run dev
```

## Benefits of Microservices Architecture

1. **Separation of Concerns**: I/O vs CPU-intensive operations
2. **Independent Scaling**: Scale services based on demand
3. **Technology Optimization**: Different deployment strategies for different workloads
4. **Fault Isolation**: Service failures don't cascade
5. **Development Velocity**: Teams can work independently on services

## Load Distribution

- **API Gateway**: Handles user requests, lightweight operations
- **SQS Queue**: Buffers and distributes processing jobs
- **Video Processor**: Handles heavy transcoding workloads
- **Database**: Shared state management
- **S3**: Distributed file storage

This architecture demonstrates proper microservices patterns for cloud-native applications with clear service boundaries and appropriate technology choices for each workload type.