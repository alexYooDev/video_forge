#!/bin/bash

# Development Environment Control Script
# Usage: ./scripts/dev-env.sh [start|stop|restart|logs|status]

set -e

COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="videoforge-dev"

case "$1" in
    start)
        echo "🚀 Starting VideoForge in DEVELOPMENT mode..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        echo "✅ Development environment started!"
        echo "📱 Client: http://localhost:3000"
        echo "🖥️  Server: http://localhost:8000"
        echo "📊 Health: http://localhost:8000/api/health"
        ;;
    
    stop)
        echo "🛑 Stopping development environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        echo "✅ Development environment stopped!"
        ;;
    
    restart)
        echo "🔄 Restarting development environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        echo "✅ Development environment restarted!"
        ;;
    
    logs)
        echo "📋 Showing development logs..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
        ;;
    
    status)
        echo "📊 Development environment status:"
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
        ;;
    
    build)
        echo "🔨 Building development containers..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME build
        echo "✅ Development containers built!"
        ;;
    
    clean)
        echo "🧹 Cleaning up development environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v --rmi local
        echo "✅ Development environment cleaned!"
        ;;
    
    *)
        echo "🎮 VideoForge Development Environment Control"
        echo "============================================="
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start    - Start development environment"
        echo "  stop     - Stop development environment" 
        echo "  restart  - Restart development environment"
        echo "  logs     - View development logs"
        echo "  status   - Show container status"
        echo "  build    - Build development containers"
        echo "  clean    - Clean up containers and volumes"
        echo ""
        echo "Development URLs:"
        echo "  Client:  http://localhost:3000"
        echo "  Server:  http://localhost:8000"
        echo "  Health:  http://localhost:8000/api/health"
        exit 1
        ;;
esac