# ==========================================
# Historian Reports - Multi-stage Dockerfile
# Optimized for performance, security, and multi-arch
# ==========================================

# Use Node.js 20 Alpine as the base for all stages
FROM node:20-alpine AS base

# Install system dependencies for 'canvas' and other native modules
RUN apk add --no-cache \
    python3 \
    py3-setuptools \
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

WORKDIR /app

# --- Stage 1: Build Backend ---
FROM base AS backend-builder
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Stage 2: Build Client ---
FROM base AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Stage 3: Production Dependencies ---
FROM base AS prod-deps
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# --- Stage 4: Final Production Image ---
FROM node:20-alpine AS production

# Install runtime system dependencies
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

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S historian -u 1001 -G nodejs

WORKDIR /app

# Copy production dependencies
COPY --from=prod-deps --chown=historian:nodejs /app/node_modules ./node_modules

# Copy built artifacts from builders
COPY --from=backend-builder --chown=historian:nodejs /app/dist ./dist
COPY --from=backend-builder --chown=historian:nodejs /app/package.json ./package.json
COPY --from=backend-builder --chown=historian:nodejs /app/templates ./templates
COPY --from=backend-builder --chown=historian:nodejs /app/scripts/healthcheck.js ./scripts/healthcheck.js

# Copy client build to be served by the backend
COPY --from=client-builder --chown=historian:nodejs /app/client/build ./client/build

# Create necessary directories for runtime data
RUN mkdir -p logs reports temp data && \
    chown -R historian:nodejs logs reports temp data && \
    chmod 755 logs reports temp data

# Switch to non-root user
USER historian

# Expose the application port
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    REPORTS_DIR=/app/reports \
    LOG_FILE=/app/logs/app.log \
    TEMP_DIR=/app/temp

# Labels for metadata
LABEL maintainer="Historian Reports Team" \
    description="Professional reporting application for AVEVA Historian database" \
    version="0.65.0"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node /app/scripts/healthcheck.js

# Start the application
CMD ["node", "dist/server.js"]