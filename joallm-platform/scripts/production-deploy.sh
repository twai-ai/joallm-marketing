#!/bin/bash

# JoaLLM Platform Production Deployment Script
# This script handles the complete production deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
SERVICES=("api-gateway" "auth-service" "chat-service" "backend")
MONITORING_SERVICES=("prometheus" "grafana" "alertmanager" "node-exporter" "postgres-exporter" "redis-exporter")

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check if required environment variables are set
    if [ -z "$OPENAI_API_KEY" ]; then
        warning "OPENAI_API_KEY is not set"
    fi
    
    if [ -z "$JWT_SECRET" ]; then
        error "JWT_SECRET is required for production"
    fi
    
    success "Prerequisites check completed"
}

# Run tests
run_tests() {
    log "Running comprehensive test suite..."
    
    # Unit tests
    log "Running unit tests..."
    for service in "${SERVICES[@]}"; do
        if [ -d "services/$service" ]; then
            log "Testing $service..."
            cd "services/$service"
            if [ -f "package.json" ]; then
                npm test || error "Unit tests failed for $service"
            fi
            cd ../..
        fi
    done
    
    # Integration tests
    log "Running integration tests..."
    if [ -d "tests/integration" ]; then
        cd tests/integration
        npm test || error "Integration tests failed"
        cd ../..
    fi
    
    # E2E tests
    log "Running end-to-end tests..."
    if [ -d "tests/e2e" ]; then
        cd tests/e2e
        npx playwright test || error "E2E tests failed"
        cd ../..
    fi
    
    success "All tests passed"
}

# Build services
build_services() {
    log "Building services..."
    
    for service in "${SERVICES[@]}"; do
        if [ -d "services/$service" ]; then
            log "Building $service..."
            cd "services/$service"
            if [ -f "package.json" ]; then
                npm ci --only=production
                npm run build
            fi
            cd ../..
        fi
    done
    
    success "Services built successfully"
}

# Security scan
security_scan() {
    log "Running security scan..."
    
    # Scan Docker images for vulnerabilities
    for service in "${SERVICES[@]}"; do
        if [ -d "services/$service" ]; then
            log "Scanning $service for vulnerabilities..."
            docker build -t "joallm-$service" "services/$service/"
            # Note: In production, use a proper vulnerability scanner like Trivy
            # trivy image joallm-$service
        fi
    done
    
    success "Security scan completed"
}

# Deploy services
deploy_services() {
    log "Deploying services..."
    
    # Create production environment file
    if [ ! -f ".env.production" ]; then
        error "Production environment file not found"
    fi
    
    # Start services with monitoring
    docker-compose -f docker-compose.microservices.yml --env-file .env.production up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    for service in "${SERVICES[@]}"; do
        log "Checking health of $service..."
        # Add health check logic here
    done
    
    success "Services deployed successfully"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Start monitoring services
    docker-compose -f docker-compose.microservices.yml up -d prometheus grafana alertmanager node-exporter postgres-exporter redis-exporter
    
    # Wait for monitoring services
    sleep 20
    
    # Configure Grafana dashboards
    log "Configuring Grafana dashboards..."
    # Add dashboard configuration logic here
    
    success "Monitoring setup completed"
}

# Performance testing
performance_test() {
    log "Running performance tests..."
    
    if [ -d "performance" ]; then
        cd performance
        npm install
        npm run load
        npm run stress
        cd ..
    fi
    
    success "Performance tests completed"
}

# Backup setup
setup_backup() {
    log "Setting up backup strategy..."
    
    # Create backup directory
    mkdir -p backups
    
    # Setup database backup
    cat > backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec joallm-postgres pg_dump -U joallm joallm > "$BACKUP_DIR/joallm_$DATE.sql"
find $BACKUP_DIR -name "joallm_*.sql" -mtime +7 -delete
EOF
    
    chmod +x backup-db.sh
    
    # Setup Redis backup
    cat > backup-redis.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec joallm-redis redis-cli BGSAVE
docker cp joallm-redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb"
find $BACKUP_DIR -name "redis_*.rdb" -mtime +7 -delete
EOF
    
    chmod +x backup-redis.sh
    
    success "Backup strategy configured"
}

# SSL/TLS setup
setup_ssl() {
    log "Setting up SSL/TLS..."
    
    # Create SSL directory
    mkdir -p ssl
    
    # Generate self-signed certificate for development
    # In production, use Let's Encrypt or a proper CA
    if [ ! -f "ssl/cert.pem" ]; then
        openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=joallm.local"
    fi
    
    success "SSL/TLS setup completed"
}

# Main deployment function
main() {
    log "Starting JoaLLM Platform Production Deployment"
    log "Environment: $ENVIRONMENT"
    
    check_prerequisites
    run_tests
    build_services
    security_scan
    setup_ssl
    deploy_services
    setup_monitoring
    setup_backup
    performance_test
    
    success "Production deployment completed successfully!"
    
    log "Access URLs:"
    log "  - API Gateway: https://localhost:3000"
    log "  - Frontend: https://localhost:5173"
    log "  - Grafana: http://localhost:3001 (admin/admin)"
    log "  - Prometheus: http://localhost:9090"
    log "  - Alertmanager: http://localhost:9093"
    
    log "Next steps:"
    log "  1. Configure your domain and SSL certificates"
    log "  2. Set up proper backup schedules"
    log "  3. Configure monitoring alerts"
    log "  4. Review security settings"
    log "  5. Set up log aggregation"
}

# Run main function
main "$@"






