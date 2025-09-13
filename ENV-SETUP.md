# Environment Configuration Guide

## Overview

VideoForge now supports easy switching between local development and production environments. This setup allows you to quickly switch configurations without manually editing files.

## Environment Files Structure

```
video_forge/
├── .env                     # Active environment file (auto-generated)
├── .env.local              # Local development settings
├── .env.production         # Production deployment settings
├── client/
│   ├── .env                # Active client config (auto-generated)
│   ├── .env.local          # Local client settings
│   └── .env.production     # Production client settings
├── server/
│   ├── .env                # Active server config (auto-generated)
│   ├── .env.local          # Local server settings
│   └── .env.production     # Production server settings
├── docker-compose.yml      # Production Docker config
├── docker-compose.local.yml # Local development Docker config
└── docker-compose.override.yml # Active override (auto-generated)
```

## Quick Environment Switching

### Switch to Local Development
```bash
./scripts/switch-env.sh local
```

### Switch to Production
```bash
./scripts/switch-env.sh production
```

## Environment Differences

### Local Development
- **Server**: `http://localhost:8000`
- **Client**: `http://localhost:3000`
- **Database**: Local MariaDB on port 3306
- **Processing**: 1 concurrent job, fast encoding
- **Hot Reload**: Enabled for both client and server
- **Logging**: Debug level

### Production Deployment
- **Server**: `http://3.106.192.215:8000`
- **Client**: `http://3.106.192.215:3000`
- **Database**: Docker internal network
- **Processing**: 2 concurrent jobs, quality encoding
- **Images**: Pre-built ECR images
- **Logging**: Info level

## Manual Configuration

If you prefer manual setup, you can:

1. Copy the appropriate `.env.*` files to `.env`
2. Update `docker-compose.override.yml` as needed
3. Restart services

## Key Environment Variables

### Client (`client/.env`)
- `REACT_APP_API_BASE_URL` - Backend API endpoint
- `REACT_APP_SERVER_URL` - Server URL for SSE connections
- `REACT_APP_ENV` - Environment indicator

### Server (`server/.env`)
- `NODE_ENV` - Node environment (development/production)
- `APP_BASE_URL` - Server base URL
- `DB_HOST` - Database host
- `MAX_CONCURRENT_JOBS` - Processing concurrency
- `FFMPEG_PRESET` - Video encoding speed/quality

### Docker (`.env`)
- `SERVER_PORT` - Server port mapping
- `CLIENT_PORT` - Client port mapping
- `DB_PORT` - Database port mapping

## Running the Application

### Local Development
```bash
# Switch to local environment
./scripts/switch-env.sh local

# Option 1: Docker with hot reload
docker-compose up --build

# Option 2: Run services separately
cd server && npm run dev    # Terminal 1
cd client && npm start      # Terminal 2
```

### Production Deployment
```bash
# Switch to production environment
./scripts/switch-env.sh production

# Deploy with pre-built images
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

## Troubleshooting

### API Connection Issues
1. Check if the correct environment is active
2. Verify API URLs in browser network tab
3. Ensure server is running on expected port

### Real-time Updates Not Working
1. Confirm SSE connection URL in browser DevTools
2. Check that `REACT_APP_SERVER_URL` matches server URL
3. Verify WebSocket connections in Network tab

### Docker Issues
1. Ensure correct Docker Compose file is being used
2. Check if `docker-compose.override.yml` exists for local dev
3. Rebuild images: `docker-compose build --no-cache`

## Tips

- Always run the switch script from the project root directory
- The switch script will show current configuration after switching
- Environment files are automatically backed up during switches
- You can customize settings in `.env.local` and `.env.production` files