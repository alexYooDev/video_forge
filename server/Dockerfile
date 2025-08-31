# Node.js server Dockerfile
FROM node:22-alpine

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p data/inputs data/outputs data/temp

# Set permissions for data directories
RUN chmod 755 data/inputs data/outputs data/temp

# Expose port
EXPOSE 8000

# Start the application
CMD ["npm", "start"]