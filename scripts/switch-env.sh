#!/bin/bash

# Environment Switcher Script for VideoForge
# Usage: ./scripts/switch-env.sh [local|production]

set -e

ENV_TYPE=${1:-local}

if [ "$ENV_TYPE" != "local" ] && [ "$ENV_TYPE" != "production" ]; then
    echo "Invalid environment type: $ENV_TYPE"
    echo "Usage: ./scripts/switch-env.sh [local|production]"
    exit 1
fi

echo "Switching to $ENV_TYPE environment..."

# Root directory
ROOT_DIR=$(pwd)

# Function to copy environment files
copy_env_files() {
    local env_type=$1
    
    echo "Copying environment files for $env_type..."
    
    # Root .env file
    if [ -f ".env.$env_type" ]; then
        cp ".env.$env_type" ".env"
        echo "   Copied .env.$env_type to .env"
    fi
    
    # Client .env file
    if [ -f "client/.env.$env_type" ]; then
        cp "client/.env.$env_type" "client/.env"
        echo "   Copied client/.env.$env_type to client/.env"
    fi
    
    # Server .env file
    if [ -f "server/.env.$env_type" ]; then
        cp "server/.env.$env_type" "server/.env"
        echo "   Copied server/.env.$env_type to server/.env"
    fi
}

# Function to create docker-compose override
create_docker_override() {
    local env_type=$1
    
    if [ "$env_type" = "local" ]; then
        echo "Setting up Docker for local development..."
        if [ -f "docker-compose.local.yml" ]; then
            cp "docker-compose.local.yml" "docker-compose.override.yml"
            echo "   Created docker-compose.override.yml for local development"
        fi
    else
        echo "Setting up Docker for production..."
        if [ -f "docker-compose.override.yml" ]; then
            rm "docker-compose.override.yml"
            echo "   Removed docker-compose.override.yml (using production docker-compose.yml)"
        fi
    fi
}

# Function to display current configuration
show_config() {
    local env_type=$1
    
    echo ""
    echo "Current Configuration ($env_type):"
    echo "=================================="
    
    if [ -f ".env" ]; then
        echo "API URLs:"
        if [ "$env_type" = "local" ]; then
            echo "   Server: http://localhost:8000"
            echo "   Client: http://localhost:3000"
            echo "   Database: localhost:3306"
        else
            echo "   Server: http://3.106.192.215:8000"
            echo "   Client: http://3.106.192.215:3000"  
            echo "   Database: (Docker internal)"
        fi
        
        echo ""
        echo "  Processing Settings:"
        echo "   Max Concurrent Jobs: $(grep MAX_CONCURRENT_JOBS .env | cut -d'=' -f2)"
        echo "   FFmpeg Preset: $(grep FFMPEG_PRESET .env | cut -d'=' -f2)"
        echo "   Log Level: $(grep LOG_LEVEL .env | cut -d'=' -f2)"
    fi
}

# Function to display next steps
show_next_steps() {
    local env_type=$1
    
    echo ""
    echo "Next Steps:"
    echo "=============="
    
    if [ "$env_type" = "local" ]; then
        echo "For LOCAL development:"
        echo "  1. Start services: docker-compose up --build"
        echo "  2. Or run server directly: cd server && npm run dev"
        echo "  3. Or run client directly: cd client && npm start"
        echo ""
        echo "Note: Local setup includes hot-reload for development"
    else
        echo "For PRODUCTION deployment:"
        echo "  1. Build and push images: ./scripts/build-and-push.sh"
        echo "  2. Deploy: docker-compose up -d"
        echo "  3. Check logs: docker-compose logs -f"
        echo ""
        echo "Note: Production uses pre-built images from ECR"
    fi
}

# Main execution
copy_env_files $ENV_TYPE
create_docker_override $ENV_TYPE
show_config $ENV_TYPE
show_next_steps $ENV_TYPE

echo ""
echo "Successfully switched to $ENV_TYPE environment!"
echo ""