# Node.js server Dockerfile
FROM node:24-alpine

# Install FFmpeg for video processing and htop for CPU monitoring
RUN apk add --no-cache ffmpeg htop

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

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