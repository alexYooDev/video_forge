#!/bin/bash

# Production Environment Control Script  
# Usage: ./scripts/prod-env.sh [start|stop|restart|logs|status]

set -e

COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="videoforge-prod"

case "$1" in
    start)
        echo "🚀 Starting VideoForge in PRODUCTION mode..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        echo "✅ Production environment started!"
        echo "🌐 Client: http://video-forge.cab432.com:3000"
        echo "🖥️  Server: http://video-forge.cab432.com:8000"
        echo "📊 Health: http://video-forge.cab432.com:8000/api/health"
        ;;
    
    stop)
        echo "🛑 Stopping production environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        echo "✅ Production environment stopped!"
        ;;
    
    restart)
        echo "🔄 Restarting production environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        echo "✅ Production environment restarted!"
        ;;
    
    logs)
        echo "📋 Showing production logs..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME logs -f
        ;;
    
    status)
        echo "📊 Production environment status:"
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME ps
        ;;
    
    deploy)
        echo "🚢 Deploying to production..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME pull
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME up -d
        echo "✅ Production deployment complete!"
        ;;
    
    clean)
        echo "🧹 Cleaning up production environment..."
        docker-compose -f $COMPOSE_FILE -p $PROJECT_NAME down -v
        echo "✅ Production environment cleaned!"
        ;;
    
    *)
        echo "🏭 VideoForge Production Environment Control"
        echo "============================================="
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start    - Start production environment"
        echo "  stop     - Stop production environment"
        echo "  restart  - Restart production environment"
        echo "  logs     - View production logs"
        echo "  status   - Show container status"
        echo "  deploy   - Pull latest images and deploy"
        echo "  clean    - Clean up containers and volumes"
        echo ""
        echo "Production URLs:"
        echo "  Client:  http://video-forge.cab432.com:3000"
        echo "  Server:  http://video-forge.cab432.com:8000"
        echo "  Health:  http://video-forge.cab432.com:8000/api/health"
        exit 1
        ;;
esac