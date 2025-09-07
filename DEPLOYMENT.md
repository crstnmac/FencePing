# Production Deployment Guide

This guide covers deploying the GeoFence Webhooks platform to production using Docker Compose.

## Prerequisites

- Docker Engine 24.0+ with Docker Compose
- Node.js 20+ (for local development)
- At least 4GB RAM and 2 CPU cores
- Domain name with SSL certificates (recommended)

## Quick Start

1. **Generate Production Secrets**
   ```bash
   ./scripts/generate-secrets.sh
   ```

2. **Configure Environment**
   ```bash
   # Edit the generated .env.prod file
   nano .env.prod
   ```

3. **Build and Deploy**
   ```bash
   npm run docker:prod:build
   npm run docker:prod
   ```

4. **Verify Deployment**
   ```bash
   npm run docker:prod:logs
   ```

## Detailed Setup

### 1. Environment Configuration

The production environment requires several configuration values:

#### Required Secrets (Generated Automatically)
- `POSTGRES_PASSWORD` - PostgreSQL database password
- `REDIS_PASSWORD` - Redis cache password  
- `EMQX_PASSWORD` - MQTT broker dashboard password
- `JWT_SECRET` - JWT signing secret (256-bit)

#### Required Manual Configuration
- `CORS_ORIGIN` - Your production domain (e.g., `https://your-domain.com`)
- `NEXT_PUBLIC_API_URL` - Production API URL (e.g., `https://api.your-domain.com`)

#### Optional Integration Secrets
- `SLACK_WEBHOOK_URL` - Slack webhook for notifications
- `GOOGLE_SERVICE_ACCOUNT_JSON` - Google Sheets integration
- `NOTION_SECRET` - Notion integration token
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` - WhatsApp integration

### 2. Build Process

The production build uses multi-stage Dockerfiles optimized for:

- **Security**: Non-root users, minimal attack surface
- **Performance**: Optimized layers, production dependencies only
- **Reliability**: Health checks, proper signal handling
- **Observability**: Structured logging, metrics endpoints

```bash
# Build all images
npm run docker:prod:build

# Or build individual services
docker build -f docker/production/Dockerfile.api -t geofence/api:latest .
docker build -f docker/production/Dockerfile.dashboard -t geofence/dashboard:latest .
```

### 3. Service Architecture

The production deployment includes:

#### Infrastructure Services
- **PostgreSQL + PostGIS**: Geospatial database
- **RedPanda**: Kafka-compatible streaming platform
- **EMQX**: MQTT broker for device communication
- **Redis**: Cache and session store

#### Application Services
- **API**: REST API server (Node.js/Express)
- **Dashboard**: Frontend application (Next.js)
- **MQTT Ingestion**: Device data ingestion service
- **Geofence Engine**: Spatial processing service
- **Automation Workers**: Webhook/notification processors

### 4. Resource Requirements

#### Minimum Production Requirements
```yaml
postgres:       1 CPU, 2GB RAM, 20GB storage
redpanda:       1 CPU, 1GB RAM, 10GB storage
api:            0.5 CPU, 1GB RAM
dashboard:      0.25 CPU, 512MB RAM
mqtt-ingestion: 0.25 CPU, 256MB RAM
geofence-engine: 0.5 CPU, 512MB RAM
automation-workers: 0.5 CPU, 512MB RAM
```

#### Recommended Production Requirements
```yaml
Total: 4 CPU, 8GB RAM, 50GB storage
```

### 5. Monitoring and Health Checks

All services include health checks:

```bash
# Check service health
docker ps
docker compose -f docker-compose.prod.yml ps

# View service logs
docker compose -f docker-compose.prod.yml logs -f [service]

# Check service metrics
curl http://localhost:3001/api/health
```

### 6. Database Migration

Initialize the database on first deployment:

```bash
# Wait for PostgreSQL to be ready
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Run migrations
docker compose -f docker-compose.prod.yml exec api npm run migrate

# Optional: Seed with sample data
docker compose -f docker-compose.prod.yml exec api npm run seed:dev
```

### 7. SSL/TLS Configuration

For production deployments, use a reverse proxy (nginx, Traefik, or Caddy):

```nginx
# Example nginx configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 8. Backup and Recovery

#### Database Backup
```bash
# Create backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U geofence_user geofence > backup.sql

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U geofence_user geofence < backup.sql
```

#### Volume Backup
```bash
# Backup persistent volumes
docker run --rm -v geofence-webhooks-prod_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz -C /data .
```

### 9. Updates and Maintenance

#### Update Application
```bash
# Pull latest images
npm run docker:prod:pull

# Rebuild and redeploy
npm run docker:prod:build
npm run docker:prod:down
npm run docker:prod
```

#### Rolling Updates
```bash
# Update individual services
docker compose -f docker-compose.prod.yml up -d --no-deps api
docker compose -f docker-compose.prod.yml up -d --no-deps dashboard
```

### 10. Troubleshooting

#### Common Issues

**Service won't start**
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs [service]

# Check resource usage
docker stats
```

**Database connection issues**
```bash
# Verify PostgreSQL is healthy
docker compose -f docker-compose.prod.yml exec postgres pg_isready

# Check connection from API
docker compose -f docker-compose.prod.yml exec api npm run migrate
```

**High memory usage**
```bash
# Adjust resource limits in docker-compose.prod.yml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '0.5'
```

#### Service Logs
```bash
# Real-time logs for all services
npm run docker:prod:logs

# Logs for specific service
docker compose -f docker-compose.prod.yml logs -f api

# Export logs to file
docker compose -f docker-compose.prod.yml logs > deployment.log
```

### 11. Security Considerations

1. **Secrets Management**: Never commit `.env.prod` to version control
2. **Network Security**: Use proper firewall rules and VPN access
3. **SSL/TLS**: Always use HTTPS in production
4. **Regular Updates**: Keep Docker images and dependencies updated
5. **Monitoring**: Set up log aggregation and alerting
6. **Backup**: Regular automated backups of data and configurations

### 12. Performance Optimization

#### Database Optimization
```sql
-- Create spatial indexes for better geofence performance
CREATE INDEX IF NOT EXISTS idx_geofences_geometry ON geofences USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_devices_location ON devices USING GIST (ST_MakePoint((meta->>'longitude')::float, (meta->>'latitude')::float));
```

#### Kafka Optimization
```yaml
# Adjust Kafka settings for production
environment:
  KAFKA_NUM_PARTITIONS: 6
  KAFKA_DEFAULT_REPLICATION_FACTOR: 1
  KAFKA_LOG_RETENTION_HOURS: 168
```

### 13. Monitoring and Observability

Consider integrating with monitoring tools:
- **Prometheus + Grafana** for metrics
- **ELK Stack** for log aggregation  
- **Jaeger** for distributed tracing
- **Sentry** for error tracking

## Production Checklist

- [ ] Secrets generated and configured
- [ ] Environment variables set
- [ ] SSL certificates configured
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Performance testing completed
- [ ] Security audit completed