# Multi-stage build for API Gateway
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

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 apigateway

# Copy dependencies from deps stage
COPY --from=deps --chown=apigateway:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=apigateway:nodejs . .

USER apigateway

EXPOSE 8000

CMD ["node", "src/server.js"]
