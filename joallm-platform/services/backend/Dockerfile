# Multi-stage build for production - More robust and smaller image size

# Stage 1: Builder
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies with retry logic
RUN apk update && apk add --no-cache \
    python3 \
    make \
    curl \
    ffmpeg \
    && apk add --no-cache --virtual .build-deps \
    g++ \
    gcc \
    musl-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install -g patch-package && \
    npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build application
RUN npm run build

# Copy migrations to dist
RUN mkdir -p dist/database && \
    cp -r src/database/migrations dist/database/

# Remove dev dependencies
RUN npm prune --production --legacy-peer-deps

# Stage 2: Production Runtime
FROM node:18-alpine AS production

WORKDIR /app

# Install only runtime dependencies (no build tools needed)
RUN apk update && apk add --no-cache \
    postgresql-client \
    curl \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY railway-start.sh ./
RUN chmod +x railway-start.sh

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

# Start application
CMD ["./railway-start.sh"]
