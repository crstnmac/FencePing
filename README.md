# GeoFence Webhooks

> **Location-based automation platform connecting MQTT device tracking to business workflows**

A comprehensive geofencing solution that processes location events through a real-time stream processing pipeline to trigger automated workflows via integrations with Notion, Google Sheets, Slack, WhatsApp, and custom webhooks.

## 🏗️ Architecture Overview

GeoFence Webhooks follows an event-driven architecture designed for high throughput and reliability:

```
📱 MQTT Devices → 🔄 Kafka Streams → 🗺️ PostGIS → ⚡ Automation Workers → 🔗 Integrations
```

### Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **MQTT Ingestion** | EMQX/Node.js | Real-time device location collection |
| **Stream Processing** | Apache Kafka | Event routing and audit logging |
| **Geospatial Engine** | PostgreSQL + PostGIS | Geofence calculations and spatial queries |
| **Automation Workers** | Bull + Redis | Webhook processing with retry logic |
| **API Server** | Express.js + TypeScript | REST API and OAuth management |
| **Dashboard** | Next.js + MapLibre GL | Interactive geofence management |

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20.0.0
- npm ≥ 10.0.0
- Docker & Docker Compose
- PostgreSQL with PostGIS extension

### 1. Clone and Install

```bash
git clone <repository-url>
cd geofence
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Infrastructure

```bash
# Start all required services
npm run docker:up

# Or start individual services
docker-compose up postgres kafka mqtt-broker redis -d
```

### 4. Database Setup

```bash
# Run migrations
npm run migrate

# Seed development data
npm run seed:dev
```

### 5. Development

```bash
# Start all services in development mode
npm run dev

# Or start individual services
npm run dev:api          # API server (port 3001)
npm run dev:dashboard    # Dashboard (port 3000)
npm run dev:geofence-engine     # Geofence processor
npm run dev:automation-workers  # Webhook workers
```

### 6. Management UIs
- **Dashboard**: http://localhost:3000
- **EMQX MQTT**: http://localhost:18083 (admin/geofence123)
- **Kafka UI**: http://localhost:8080
- **pgAdmin**: http://localhost:8081 (admin@geofence.local/geofence123) - Optional, run with `--profile tools`

## 📋 Environment Configuration

### Required Variables

```env
# Database
DATABASE_URL="postgresql://geofence_user:geofence_pass@localhost:5432/geofence"

# API Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# MQTT Broker
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_USERNAME=
MQTT_PASSWORD=

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=geofence-app

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key-change-in-production-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# Maps (Optional - using MapLibre GL JS)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Integration Credentials

```env
# Google Sheets
GOOGLE_SHEETS_CLIENT_ID=
GOOGLE_SHEETS_CLIENT_SECRET=

# Notion
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# WhatsApp Business
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=

# Twilio (Alternative WhatsApp)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Payment Processing
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

## 🎯 Core Features

### 1. Device Management
- Real-time location tracking via MQTT
- Device registration and authentication
- Location history and status monitoring
- REST API fallback for location updates

### 2. Geofence Management
- Interactive map-based geofence creation (polygons and circles)
- Real-time geofence visualization with **MapLibre GL JS**
- Support for complex multi-polygon geofences
- Drag-and-drop geofence editing with **Terra Draw**

### 3. Event Processing
- Enter/Exit/Dwell event detection
- GPS accuracy filtering and hysteresis logic
- Configurable dwell time thresholds
- Event replay and audit logging

### 4. Automation Engine
- Rule-based automation triggers
- Multi-integration support per rule
- Template-based message formatting
- Retry logic with exponential backoff

### 5. Integrations

#### Notion
- Create database records automatically
- Custom property mapping
- OAuth 2.0 authentication
- Template-based page creation

#### Google Sheets
- Append rows to spreadsheets
- Custom column mapping
- Real-time data updates
- OAuth 2.0 authentication

#### Slack
- Channel notifications
- Direct messages
- Rich message formatting
- Bot token and webhook support

#### WhatsApp Business
- Template and freeform messages
- Media attachments
- WhatsApp Business API integration
- Twilio fallback support

#### Custom Webhooks
- HTTP/HTTPS endpoint calls
- Custom headers and authentication
- JSON payload formatting
- Retry and dead letter queues

## 🗄️ Database Schema

### Core Tables

```sql
-- Users and Organizations
users (id, email, name, created_at, updated_at)
organizations (id, name, owner_id, created_at, updated_at)

-- Devices and Tracking
devices (id, name, organization_id, device_token, last_location, last_seen, is_active)
geofences (id, name, organization_id, geometry, geofence_type, metadata, is_active)

-- Events and Automation
events (id, event_type, device_id, geofence_id, location, metadata, timestamp, processed_at)
automation_rules (id, name, geofence_id, device_id, integration_id, trigger_type, action_config)
automation_executions (id, automation_rule_id, event_id, status, response_data, executed_at)

-- Integrations
integrations (id, name, type, organization_id, config, credentials, is_active)
```

### Spatial Indexes

```sql
CREATE INDEX idx_devices_location ON devices USING GIST (last_location);
CREATE INDEX idx_geofences_geometry ON geofences USING GIST (geometry);
CREATE INDEX idx_events_location ON events USING GIST (location);
```

## 🔄 Data Flow

### 1. Device Location Ingestion

```
Device → MQTT Topic (devices/{id}/location) → MQTT Ingestion Service → Kafka (raw_events)
```

### 2. Geofence Processing

```
Kafka (raw_events) → Geofence Engine → PostGIS Spatial Query → Kafka (geofence_events)
```

### 3. Automation Execution

```
Kafka (geofence_events) → Automation Workers → Integration APIs → Kafka (audit_log)
```

## 📡 MQTT Topics

### Device Location Updates
```
Topic: devices/{device_id}/location
Payload: {
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10.0,
  "altitude": 100.0,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Device Status Updates
```
Topic: devices/{device_id}/status
Payload: {
  "battery": 85,
  "signal_strength": -75,
  "last_seen": "2025-01-01T12:00:00Z"
}
```

## 🎛️ Kafka Topics

| Topic | Purpose | Key | Retention |
|-------|---------|-----|-----------|
| `raw_events` | Incoming location data | device_id | 7 days |
| `geofence_events` | Enter/exit/dwell events | device_id | 30 days |
| `automations` | Triggered webhook events | rule_id | 30 days |
| `audit_log` | Immutable event history | event_id | 1 year |

## 🔧 API Endpoints

### Authentication
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh
DELETE /api/auth/logout
```

### Device Management
```
GET    /api/devices                    # List all devices
POST   /api/devices                    # Create device
GET    /api/devices/:id                # Get device details
PUT    /api/devices/:id                # Update device
DELETE /api/devices/:id                # Delete device
POST   /api/devices/:id/location       # Update device location
```

### Geofence Management
```
GET    /api/geofences                  # List all geofences
POST   /api/geofences                  # Create geofence
GET    /api/geofences/:id              # Get geofence details
PUT    /api/geofences/:id              # Update geofence
DELETE /api/geofences/:id              # Delete geofence
```

### Integration Management
```
GET    /api/integrations               # List integrations
POST   /api/integrations               # Create integration
PUT    /api/integrations/:id           # Update integration
DELETE /api/integrations/:id           # Delete integration
POST   /api/integrations/:id/test      # Test integration
```

### OAuth Flows
```
GET    /api/auth/oauth/:provider       # Start OAuth flow
GET    /api/auth/oauth/:provider/callback  # OAuth callback
DELETE /api/auth/oauth/:provider       # Revoke tokens
```

## 🧪 Testing

### Unit Tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

### Integration Tests
```bash
npm run test:integration
```

### Geospatial Tests
```bash
npm run test:geospatial
```

### Load Testing
```bash
npm run test:load
```

## 🚀 Deployment

### Docker Compose (Development)
```bash
npm run docker:up
```

### Production Deployment

#### 1. Build Services
```bash
npm run build
npm run build:packages
```

#### 2. Database Migration
```bash
npm run migrate
```

#### 3. Start Services
```bash
# API Server
npm run start:api

# Geofence Engine
npm run start:geofence-engine

# Automation Workers
npm run start:automation-workers

# Dashboard
npm run start:dashboard
```

### Kubernetes

The project includes Kubernetes manifests in the `k8s/` directory:

```bash
kubectl apply -f k8s/
```

### Environment-Specific Configs

- **Development**: Full stack with hot reloading
- **Staging**: Production build with debug logging
- **Production**: Optimized build with monitoring

## 📊 Monitoring and Observability

### Health Checks
- API: `GET /health`
- Database connection validation
- Kafka producer/consumer health
- MQTT broker connectivity

### Metrics
- Device location update rate
- Geofence event processing latency
- Integration success/failure rates
- Automation execution times

### Logging
- Structured JSON logging with Pino
- Request/response logging
- Error tracking and alerting
- Performance metrics

## 🔒 Security

### Authentication
- JWT-based API authentication
- OAuth 2.0 for integrations
- Device token-based MQTT auth

### Authorization
- Organization-scoped data access
- Role-based permissions
- API key management

### Data Protection
- Encrypted credential storage
- HTTPS/WSS encrypted communication
- Input validation and sanitization
- Rate limiting and DDoS protection

## 🎨 Dashboard Features

### Map Interface
- **MapLibre GL JS** for open-source mapping
- **Terra Draw** for interactive geofence creation
- Real-time device location display
- Geofence visualization and editing

### Management Interfaces
- Device management with status monitoring
- Geofence creation with drag-and-drop editing
- Automation rule configuration
- Integration setup with OAuth flows

### Analytics Dashboard
- Event history and filtering
- Automation success/failure rates
- Device activity tracking
- Geofence usage analytics

## 🛠️ Development Tools

### Code Quality
```bash
npm run lint              # ESLint
npm run lint:fix          # Auto-fix linting issues
npm run format            # Prettier formatting
npm run format:check      # Check formatting
npm run typecheck         # TypeScript validation
```

### Database Tools
```bash
npm run migrate           # Run migrations
npm run migrate:create    # Create new migration
npm run seed:dev          # Seed development data
npm run backup:events     # Backup event data
npm run restore:events    # Restore event data
```

### Utilities
```bash
npm run clean             # Clean build artifacts
npm run reset             # Full reset and reinstall
npm run turbo:cache:clear # Clear Turbo cache
```

## 📝 API Documentation

### Device Location Update

```typescript
POST /api/devices/:deviceId/location

{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "accuracy": 10.0,
  "altitude": 100.0,
  "timestamp": "2025-01-01T12:00:00Z"
}
```

### Create Geofence

```typescript
POST /api/geofences

{
  "name": "Office Building",
  "description": "Main office location",
  "geofence_type": "polygon",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-122.4194, 37.7749],
      [-122.4194, 37.7849],
      [-122.4094, 37.7849],
      [-122.4094, 37.7749],
      [-122.4194, 37.7749]
    ]]
  }
}
```

### Create Automation Rule

```typescript
POST /api/automation-rules

{
  "name": "Office Entry Alert",
  "geofence_id": "uuid",
  "device_id": "uuid", // optional
  "integration_id": "uuid",
  "trigger_type": "enter",
  "action_config": {
    "message": "Device {{device.name}} entered {{geofence.name}}",
    "channel": "#alerts"
  }
}
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

### Coding Standards
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Conventional commits for git messages
- Jest for testing

### Architecture Decisions
- Event-driven architecture for scalability
- PostgreSQL + PostGIS for geospatial queries
- Kafka for reliable event streaming
- Redis for caching and queues

## 📚 Resources

### Documentation
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Apache Kafka Guide](https://kafka.apache.org/documentation/)
- [MapLibre GL JS API](https://maplibre.org/maplibre-gl-js/docs/)
- [Terra Draw Documentation](https://terra-draw.vercel.app/)

### Integration APIs
- [Notion API](https://developers.notion.com/)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Slack API](https://api.slack.com/)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- PostGIS for powerful geospatial capabilities
- Apache Kafka for reliable event streaming
- MapLibre GL JS for open-source mapping
- Terra Draw for intuitive drawing tools
- The Node.js ecosystem for excellent tooling

---

**Built with ❤️ for location-based automation**