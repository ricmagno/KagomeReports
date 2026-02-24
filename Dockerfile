# ==========================================
# Historian Reports - Multi-stage Dockerfile
# Optimized for performance, security, and multi-arch
# ==========================================

# Use Node.js 20 slim as the base for better compatibility with native modules
FROM node:20-bookworm-slim AS base

# Install system dependencies for 'canvas' and other native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Stage 1: Build Backend ---
FROM base AS backend-builder
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# --- Stage 2: Build Client ---
FROM base AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

# --- Stage 3: Production Dependencies ---
FROM base AS prod-deps
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# --- Stage 4: Final Production Image ---
FROM node:20-bookworm-slim AS production

# Install runtime system dependencies
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgif7 \
    librsvg2-2 \
    curl \
    unzip \
    fonts-dejavu-core \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security (Debian uses different flags)
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/sh -m historian

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
RUN mkdir -p logs reports temp data .backups .updates .env.backups && \
    chown -R historian:nodejs /app && \
    chmod 755 logs reports temp data .backups .updates .env.backups

# Switch to non-root user
USER historian

# Expose the application port
EXPOSE 3000

# Environment defaults
ARG VERSION=unknown
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/home/historian/data \
    REPORTS_DIR=/home/historian/reports \
    LOG_FILE=/home/historian/logs/app.log \
    TEMP_DIR=/home/historian/temp \
    IS_DOCKER=true \
    VERSION=${VERSION}

# Labels for metadata
LABEL maintainer="Historian Reports Team" \
    description="Professional reporting application for AVEVA Historian database" \
    version="1.1.4"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node /app/scripts/healthcheck.js

# Start the application
CMD ["node", "dist/server.js"]