# Environment Management Guide

This document explains how to switch between development and production environments.

## Quick Start

### Development Environment
```bash
# Start development environment (with hot reload)
./scripts/dev-env.sh start

# View logs
./scripts/dev-env.sh logs

# Stop development environment
./scripts/dev-env.sh stop
```

### Production Environment
```bash
# Start production environment
./scripts/prod-env.sh start

# Deploy latest changes
./scripts/prod-env.sh deploy

# Stop production environment
./scripts/prod-env.sh stop
```

## Environment Files

- `.env.development` - Local development configuration
- `.env.production` - Production configuration

## Docker Compose Files

- `docker-compose.dev.yml` - Development setup with hot reload
- `docker-compose.yml` - Production setup with ECR images

## Available Commands

### Development Scripts
- `./scripts/dev-env.sh start` - Start development environment
- `./scripts/dev-env.sh stop` - Stop development environment
- `./scripts/dev-env.sh restart` - Restart development environment
- `./scripts/dev-env.sh logs` - View development logs
- `./scripts/dev-env.sh status` - Show container status
- `./scripts/dev-env.sh build` - Build development containers
- `./scripts/dev-env.sh clean` - Clean up containers and volumes

### Production Scripts
- `./scripts/prod-env.sh start` - Start production environment
- `./scripts/prod-env.sh stop` - Stop production environment
- `./scripts/prod-env.sh restart` - Restart production environment
- `./scripts/prod-env.sh logs` - View production logs
- `./scripts/prod-env.sh status` - Show container status
- `./scripts/prod-env.sh deploy` - Pull latest images and deploy
- `./scripts/prod-env.sh clean` - Clean up containers and volumes

### Server Scripts
- `npm run dev:local` - Run server in development mode
- `npm run dev:prod` - Run server in production mode

## Environment URLs

### Development
- Client: http://localhost:3000
- Server: http://localhost:8000
- Health Check: http://localhost:8000/api/health

### Production
- Client: http://video-forge.cab432.com:3000
- Server: http://video-forge.cab432.com:8000
- Health Check: http://video-forge.cab432.com:8000/api/health

## Configuration Features

### Development Environment
- Hot reload enabled
- Debug logging
- Development S3 bucket
- Source code mounting for live changes

### Production Environment
- Optimized builds from ECR
- Production logging
- Production S3 bucket
- SSL/TLS configuration

## Switching Environments

1. **Stop Current Environment**
   ```bash
   ./scripts/dev-env.sh stop    # or prod-env.sh stop
   ```

2. **Start Target Environment**
   ```bash
   ./scripts/prod-env.sh start  # or dev-env.sh start
   ```

3. **Verify Environment**
   ```bash
   ./scripts/prod-env.sh status # Check containers are running
   ```

## AWS Configuration

Both environments use the same AWS resources:
- PostgreSQL RDS database
- S3 buckets (separate for dev/prod)
- Cognito user pool
- Parameter Store/Secrets Manager

The environment configuration automatically selects the appropriate S3 bucket based on NODE_ENV.