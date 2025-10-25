# Multi-stage build for Job Service
FROM node:20-alpine AS base

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

# Install ffmpeg for metadata extraction
RUN apk add --no-cache ffmpeg

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 jobservice

# Copy dependencies from deps stage
COPY --from=deps --chown=jobservice:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=jobservice:nodejs . .

USER jobservice

EXPOSE 8000

CMD ["node", "src/server.js"]
