# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Use a placeholder so the built bundle can have the URL swapped at runtime
ARG VITE_API_URL=__API_URL_PLACEHOLDER__
ARG VITE_APP_ENV=production

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_ENV=${VITE_APP_ENV}

# Copy package files
COPY package*.json ./

# Install patch-package globally
RUN npm install -g patch-package

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install serve (busybox sed is already in alpine)
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy serve config and entrypoint
COPY serve.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

# Substitute runtime env var into the bundle, then start serve
ENTRYPOINT ["./entrypoint.sh"]
