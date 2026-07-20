# JoaLLM Platform - Complete Deployment Guide

This comprehensive guide covers all deployment options for the JoaLLM platform.

## 🎯 Deployment Options

### 1. Cloud Platforms (Easiest)
- **Railway** (Recommended for quick deployment)
- **Vercel** (Frontend only)
- **Heroku** (Full stack)
- **DigitalOcean App Platform**
- **AWS Amplify/Elastic Beanstalk**

### 2. VPS/Server (Full Control)
- **DigitalOcean Droplet**
- **AWS EC2**
- **Google Cloud Compute Engine**
- **Linode**
- **Vultr**

### 3. Containerized (Advanced)
- **Docker Compose** (what you're using locally)
- **Kubernetes**
- **Docker Swarm**

---

## 🚀 Option 1: Railway Deployment (Recommended)

**Best for**: Quick deployment, automatic scaling, managed databases

### Step 1: Prerequisites
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### Step 2: Initialize Project
```bash
cd /Users/aeishwary/JoaLLM-platform/joallm-platform
railway init
```

### Step 3: Add Services
```bash
# Add PostgreSQL
railway add --database postgresql

# Add Redis
railway add --database redis
```

### Step 4: Set Environment Variables
```bash
# Backend service
railway variables set \
  NODE_ENV=production \
  JWT_SECRET=your-super-secret-jwt-key-here \
  GROQ_API_KEY=<YOUR_GROQ_API_KEY> \
  COHERE_API_KEY=<YOUR_COHERE_API_KEY> \
  GOOGLE_CLIENT_ID=<YOUR_GOOGLE_CLIENT_ID>.apps.googleusercontent.com \
  GOOGLE_CLIENT_SECRET=<YOUR_GOOGLE_CLIENT_SECRET> \
  CORS_ORIGIN=https://your-frontend-url.railway.app
```

### Step 5: Deploy
```bash
railway up
```

### Post-Deployment
1. Get your URLs from Railway dashboard
2. Update `GOOGLE_REDIRECT_URI` to match your backend URL
3. Update frontend `VITE_API_URL` to match your backend URL
4. Run database migrations:
   ```bash
   railway run npm run db:migrate
   ```

**📝 See full Railway guide**: `docs/RAILWAY_DEPLOYMENT.md`

---

## 🖥️ Option 2: VPS Deployment (Ubuntu/Linux Server)

**Best for**: Full control, custom configuration, cost-effective for high traffic

### Step 1: Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt install -y docker-compose

# Install Nginx
sudo apt install -y nginx

# Install Certbot (for SSL)
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Clone & Setup

```bash
# Clone repository
git clone https://github.com/yourusername/joallm-platform.git
cd joallm-platform

# Install dependencies
npm install

# Build services
npm run build
```

### Step 3: Configure Environment

```bash
# Backend .env
cp services/backend/env.example services/backend/.env
nano services/backend/.env
# Set all your API keys and production values

# Frontend .env
nano services/frontend/.env
# Set VITE_API_URL=https://api.yourdomain.com
```

### Step 4: Setup Nginx Reverse Proxy

```bash
# Copy nginx configuration
sudo cp nginx-production.conf /etc/nginx/sites-available/joallm
sudo ln -s /etc/nginx/sites-available/joallm /etc/nginx/sites-enabled/

# Edit configuration with your domain
sudo nano /etc/nginx/sites-available/joallm
# Replace yourdomain.com with your actual domain

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Step 5: Setup SSL Certificate

```bash
# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renew setup (already configured by certbot)
sudo certbot renew --dry-run
```

### Step 6: Start Services with Docker Compose

```bash
# Start all services in production mode
docker-compose -f docker-compose.yml up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 7: Setup Process Manager (Alternative to Docker)

If you prefer running Node.js directly:

```bash
# Install PM2
sudo npm install -g pm2

# Start services
pm2 start npm --name "backend" -- run start --workspace=services/backend
pm2 start npm --name "frontend" -- run preview --workspace=services/frontend
pm2 start npm --name "landing" -- run preview --workspace=services/landing-page

# Save PM2 configuration
pm2 save
pm2 startup
```

### Step 8: Setup Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 🔒 Security Checklist

### Before Going Live:

- [ ] Change all default passwords
- [ ] Set strong JWT_SECRET
- [ ] Configure proper CORS origins
- [ ] Enable HTTPS/SSL
- [ ] Setup firewall rules
- [ ] Enable rate limiting
- [ ] Setup monitoring and alerts
- [ ] Configure backups
- [ ] Update Google OAuth redirect URIs
- [ ] Remove debug/development features
- [ ] Set NODE_ENV=production

---

## 📊 Monitoring Setup (Production)

### Access Monitoring (Once Deployed)

```bash
# Prometheus metrics
https://prometheus.yourdomain.com

# Grafana dashboards
https://monitoring.yourdomain.com
# Login: admin/admin (change immediately!)

# Application health
https://api.yourdomain.com/api/health
```

### Configure Alerts

Edit `monitoring/alertmanager/alertmanager.yml`:

```yaml
receivers:
  - name: 'email'
    email_configs:
      - to: 'your-email@example.com'
        from: 'alerts@yourdomain.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'your-email@gmail.com'
        auth_password: 'your-app-password'
```

---

## 🌐 DNS Configuration

### Required DNS Records:

```
# Main application
A       @                  your-server-ip
A       www                your-server-ip

# API (if separate)
A       api                your-server-ip

# Landing page
A       landing            your-server-ip

# Monitoring (optional, restrict access!)
A       monitoring         your-server-ip
A       prometheus         your-server-ip
```

---

## 🔄 Continuous Deployment

### GitHub Actions (Automated Deployment)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/joallm-platform
            git pull
            npm install
            npm run build
            docker-compose restart
```

---

## 📈 Performance Optimization

### Production Settings:

**Backend (`services/backend/.env`):**
```bash
NODE_ENV=production
LOG_LEVEL=warn
# Enable compression
# Enable caching
```

**Frontend Build:**
```bash
# Build with optimizations
npm run build:frontend

# This creates optimized bundle in services/frontend/dist
```

**Nginx Caching:**
```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g;
proxy_cache my_cache;
```

---

## 🧪 Testing Your Deployment

### 1. Health Checks
```bash
curl https://api.yourdomain.com/api/health
curl https://api.yourdomain.com/api/health/detailed
```

### 2. Load Testing
```bash
# Install k6 or Apache Bench
sudo apt install apache2-utils

# Test API
ab -n 1000 -c 10 https://api.yourdomain.com/api/health
```

### 3. Monitor Logs
```bash
# Application logs
docker-compose logs -f

# Nginx logs
sudo tail -f /var/log/nginx/joallm-access.log
sudo tail -f /var/log/nginx/joallm-error.log
```

---

## 🆘 Troubleshooting

### Common Issues:

**Service Won't Start:**
```bash
# Check logs
docker-compose logs backend

# Verify environment variables
docker-compose exec backend env | grep API_KEY

# Test database connection
docker-compose exec backend npm run db:migrate
```

**SSL Certificate Issues:**
```bash
# Renew certificate
sudo certbot renew

# Check certificate
sudo certbot certificates
```

**High Memory Usage:**
```bash
# Check container stats
docker stats

# Restart services
docker-compose restart
```

---

## 📞 Support

- Railway: https://railway.app/help
- Let's Encrypt: https://letsencrypt.org/docs/
- Nginx: https://nginx.org/en/docs/
- Docker: https://docs.docker.com/

---

## 🎉 Your Application is Live!

Once deployed, your application will be accessible at:

- **Frontend**: https://yourdomain.com
- **API**: https://api.yourdomain.com (or https://yourdomain.com/api)
- **Landing Page**: https://landing.yourdomain.com
- **Monitoring**: https://monitoring.yourdomain.com (restricted)
- **Prometheus**: https://prometheus.yourdomain.com (restricted)

**Remember to**:
1. Share URLs with your users
2. Setup analytics (if enabled)
3. Monitor performance regularly
4. Keep dependencies updated
5. Backup database regularly


