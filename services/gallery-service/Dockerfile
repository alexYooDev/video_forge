FROM node:20-alpine as base

# Gallery Service Dockerfile for ECS deployment
FROM base as deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base as runner
WORKDIR /app

# Add non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 galleryservice

# Copy dependencies and source code
COPY --from=deps --chown=galleryservice:nodejs /app/node_modules ./node_modules
COPY --chown=galleryservice:nodejs . .

# Switch to non-root user
USER galleryservice

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the service
CMD ["node", "src/index.js"]
