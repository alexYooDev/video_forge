#!/bin/bash

# Fix client API URL - removes double /api/api issue
# Run this on your EC2 instance: i-0f6b5071d87422611

echo "Stopping and removing old client container..."
docker stop client
docker rm client

echo "Starting client with corrected API URL..."
docker run -d \
  --name client \
  --restart unless-stopped \
  -p 3000:80 \
  -e REACT_APP_API_BASE_URL=https://video-forge-v2.cab432.com \
  -e REACT_APP_PIXABAY_API_KEY=51815028-d9f2434e9b26002e4b2bd4fa4 \
  -e REACT_APP_PIXABAY_BASE_URL=https://pixabay.com/api/videos/ \
  --network $(docker network ls --format "{{.Name}}" | grep default | head -1) \
  901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/12159069-video-forge-client:latest

echo ""
echo "Waiting 5 seconds for container to start..."
sleep 5

echo ""
echo "Container status:"
docker ps --filter name=client

echo ""
echo "Testing client..."
curl -I http://localhost:3000

echo ""
echo "✅ Done! The client should now work correctly."
echo "Test by opening: https://video-forge-v2.cab432.com"
