1. **Clone and navigate to the project:**
   ```bash
   cd video_forge
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your specific values (API keys, passwords, etc.)
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000 # dev
   - Backend API: http://localhost:8000 # dev
   - Database: localhost:3306

## Environment Configuration

### Required Environment Variables

Copy `.env.example` to `.env` and update these values:

```bash
# Database
DB_ROOT_PASSWORD=your_secure_root_password
DB_PASSWORD=your_secure_user_password
JWT_SECRET=your_super_secure_jwt_secret_key

# External APIs
PIXABAY_API_KEY=your_pixabay_api_key_here
```

## Docker Commands

### Production Deployment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove all data
docker-compose down -v
```

### Development Mode
```bash
# Start with hot-reload (server only, run client locally)
docker-compose -f docker-compose.dev.yml up -d

# Run client locally for development
cd client && npm start
```

### Individual Service Management
```bash
# Start only database
docker-compose up -d database

# Rebuild and restart server
docker-compose build server
docker-compose up -d server

# View specific service logs
docker-compose logs -f server
```

## Service Details

### Database (MariaDB)
- **Container**: `videoforge_db`
- **Port**: 3306
- **Volume**: `db_data` (persistent storage)
- **Init Script**: Auto-runs `server/src/scripts/db.sql`

### Server (Node.js + Express)
- **Container**: `videoforge_server`
- **Port**: 8000
- **Features**: FFmpeg video processing, JWT auth, REST API
- **Volumes**: 
  - `video_inputs` - Input video files
  - `video_outputs` - Processed video outputs
  - `video_temp` - Temporary processing files

### Client (React + Nginx)
- **Container**: `videoforge_client`
- **Port**: 3000 (mapped to 80 in container)
- **Features**: Production-optimized build, Nginx proxy to API

## Data Persistence

All data is stored in Docker volumes:
- `db_data` - Database files
- `video_inputs` - Input videos
- `video_outputs` - Processed videos

## Troubleshooting

### Common Issues

1. **Port conflicts:**
   ```bash
   # Change ports in .env file
   SERVER_PORT=8001
   CLIENT_PORT=3001
   DB_PORT=3307
   ```

2. **Permission issues with video processing:**
   ```bash
   # Check container logs
   docker-compose logs server
   
   # Restart with clean volumes
   docker-compose down -v
   docker-compose up -d
   ```

3. **Database connection issues:**
   ```bash
   # Wait for database to be ready
   docker-compose logs database
   
   # Check database health
   docker-compose ps
   ```

### Useful Commands

```bash
# Check service status
docker-compose ps

# Execute command in running container
docker-compose exec server bash
docker-compose exec database mysql -u root -p

# View resource usage
docker stats

# Clean up unused resources
docker system prune
```

## Health Checks
- Database: MySQL ping
- Server: HTTP health endpoint
- Client: Nginx response

## Monitoring

### Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server

# Last N lines
docker-compose logs --tail=100 server
```

### Performance
```bash
# Resource usage
docker stats

# Container processes
docker-compose top
```

## Backup & Recovery

### Database Backup
```bash
# Create backup
docker-compose exec database mysqldump -u root -p video_forge > backup.sql

# Restore backup
docker-compose exec -T database mysql -u root -p video_forge < backup.sql
```

### Video Files Backup
```bash
# Backup processed videos
docker cp videoforge_server:/app/data/outputs ./video_backup
```