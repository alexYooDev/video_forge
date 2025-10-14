# Multi-stage build for Video Processor
FROM node:20-alpine AS base

# Install FFmpeg and other dependencies
RUN apk add --no-cache ffmpeg

# Install production dependencies
FROM base AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Build stage
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 processor && \
    mkdir -p /tmp/video-processing && \
    chown -R processor:nodejs /tmp/video-processing

# Copy dependencies from deps stage
COPY --from=deps --chown=processor:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=processor:nodejs . .

USER processor

CMD ["node", "src/processor.js"]
