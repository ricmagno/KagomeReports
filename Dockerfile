# Multi-stage Docker build for Historian Reports Application
# Supports both ARM64 and AMD64 architectures with optimized builds
# Build with: docker buildx build --platform linux/amd64,linux/arm64 -t historian-reports:1.0.0 .

# Build arguments for version tagging
ARG VERSION=1.0.0
ARG BUILD_DATE
ARG VCS_REF

# Stage 1: Base dependencies stage
FROM node:18-alpine AS base

# Install system dependencies for both architectures
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    fontconfig-dev \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Stage 2: Development dependencies
FROM base AS dev-deps

# Install all dependencies (including dev dependencies)
RUN npm ci && npm cache clean --force

# Stage 3: Production dependencies
FROM base AS prod-deps

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 4: Build stage
FROM dev-deps AS builder

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Verify build output
RUN ls -la dist/ && test -f dist/server.js

# Stage 5: Client build stage (if client exists)
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci && npm cache clean --force

# Copy client source
COPY client/ ./

# Build client application
RUN npm run build

# Stage 6: Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    fontconfig \
    ttf-dejavu \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user and group
RUN addgroup -g 1001 -S nodejs && \
    adduser -S historian -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=historian:nodejs /app/dist ./dist
COPY --from=prod-deps --chown=historian:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=historian:nodejs /app/package*.json ./

# Copy client build if it exists
COPY --from=client-builder --chown=historian:nodejs /app/build ./client/build 2>/dev/null || true

# Copy templates and other runtime assets
COPY --from=builder --chown=historian:nodejs /app/templates ./templates

# Create necessary directories with proper permissions
RUN mkdir -p logs reports temp data && \
    chown -R historian:nodejs logs reports temp data && \
    chmod 755 logs reports temp data

# Create health check script
COPY --chown=historian:nodejs <<EOF /app/healthcheck.js
const http = require('http');
const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/health',
  timeout: 2000,
  method: 'GET'
};

const request = http.request(options, (res) => {
  console.log(\`Health check status: \${res.statusCode}\`);
  process.exit(res.statusCode === 200 ? 0 : 1);
});

request.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.error('Health check timeout');
  request.destroy();
  process.exit(1);
});

request.end();
EOF

# Switch to non-root user
USER historian

# Expose port
EXPOSE 3000

# Add labels for better container management
LABEL maintainer="Historian Reports Team" \
      version="${VERSION}" \
      description="Professional reporting application for AVEVA Historian database" \
      org.opencontainers.image.title="Historian Reports" \
      org.opencontainers.image.description="Professional reporting application for AVEVA Historian database" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.vendor="Historian Reports Team" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}"

# Health check with improved configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node /app/healthcheck.js

# Start the application
CMD ["node", "dist/server.js"]