# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Use placeholders so the built bundle can have URLs swapped at runtime
ARG VITE_API_URL=__API_URL_PLACEHOLDER__
ARG VITE_API_BASE_URL=__API_BASE_URL_PLACEHOLDER__
ARG VITE_APP_ENV=production

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
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

# Install serve and sed (busybox sed is already in alpine)
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy serve config and entrypoint
COPY serve.json ./
COPY entrypoint.sh ./
COPY railway-start.sh ./
RUN chmod +x entrypoint.sh railway-start.sh

# Expose port
EXPOSE 5174

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-5174}/ || exit 1

# Substitute runtime env vars into the bundle, then start serve
CMD ["./railway-start.sh"]
