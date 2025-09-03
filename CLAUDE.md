# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeoFence Webhooks is a location-based automation platform that connects MQTT device tracking to business workflows via webhooks to Notion, Google Sheets, Slack, and WhatsApp. The system processes location events through a Kafka stream to trigger automations when devices enter/exit/dwell within geofenced areas.

## Architecture

The system follows an event-driven architecture with these core components:

### Data Flow
1. **Ingestion Layer**: MQTT broker (EMQX/Mosquitto) + REST API fallback
2. **Stream Processing**: Kafka topics for event routing and audit logging
3. **Geospatial Engine**: PostgreSQL + PostGIS for geofence calculations
4. **Automation Workers**: Webhook processors with retry/DLQ handling
5. **Dashboard**: Next.js frontend with Mapbox GL for geofence management

### Key Kafka Topics
- `raw_events`: Incoming device location data
- `geofence_events`: Enter/exit/dwell events after processing
- `automations`: Triggered webhook/notification events
- `audit_log`: Immutable event history for replay

### Database Schema Focus Areas
- PostGIS geometry columns for geofence polygons/circles
- Event tables with ST_Contains/ST_DWithin spatial queries
- Dwell tracking via window functions with hysteresis logic
- User/device/integration configuration tables

## Development Commands

### Backend Services
```bash
# Start MQTT broker
docker-compose up mqtt-broker

# Start Kafka cluster
docker-compose up kafka zookeeper

# Start PostgreSQL with PostGIS
docker-compose up postgres

# Run geospatial processing service
npm run dev:geofence-engine

# Run webhook automation workers
npm run dev:automation-workers

# Run API server
npm run dev:api
```

### Frontend Dashboard
```bash
# Start Next.js development server
npm run dev:dashboard

# Build for production
npm run build:dashboard

# Run tests
npm test
npm run test:geospatial  # PostGIS-specific tests
```

### Database Operations
```bash
# Run PostGIS migrations
npm run migrate

# Seed test geofences and devices
npm run seed:dev

# Backup/restore event data
npm run backup:events
npm run restore:events
```

## Core Technical Patterns

### Geofence Event Processing
- Use ST_Contains for polygon containment with 15-30 second debounce
- Implement hysteresis to prevent boundary flicker
- Store device state transitions for dwell time calculations
- Handle GPS accuracy variations with buffer zones

### Webhook Reliability
- Implement exponential backoff with jitter for failed webhooks
- Use Kafka dead letter queues for undeliverable events
- Provide webhook replay functionality from audit log
- Support webhook signing for secure integrations

### Integration Templates
- Pre-built automation templates for common use cases
- Parameterized webhook payloads for each destination (Notion, Sheets, Slack)
- Template marketplace integration points
- White-label customization capabilities

### Performance Considerations
- Spatial indexing on PostGIS geometry columns
- Kafka partitioning by device ID for parallel processing
- Connection pooling for webhook destinations
- Rate limiting per integration to avoid API limits

## Environment Configuration

### Required Environment Variables
- `MQTT_BROKER_URL`: MQTT broker connection string
- `KAFKA_BROKERS`: Kafka cluster endpoints
- `DATABASE_URL`: PostgreSQL connection with PostGIS enabled
- `NOTION_CLIENT_ID`, `GOOGLE_SHEETS_API_KEY`: Integration credentials
- `STRIPE_SECRET_KEY`: Payment processing
- `MAPBOX_ACCESS_TOKEN`: Map rendering

### Integration Setup
- OAuth flows for Notion, Google Sheets, Slack
- Twilio/Meta API setup for WhatsApp notifications
- Stripe Connect for payment automation triggers
- Rate limiting configuration per third-party API

## Implementation Roadmap

### Phase 1: Core Infrastructure (Priority 1)

#### 1.1 MQTT Ingestion Service
- **Status**: Missing - needs complete implementation
- **Location**: `apps/mqtt-ingestion/`
- **Dependencies**: EMQX broker already configured
- **Tasks**:
  - Create MQTT client service to subscribe to device location topics
  - Implement location data validation and parsing
  - Publish sanitized events to Kafka `raw_events` topic
  - Add connection resilience and error handling
  - Support both MQTT and REST API fallback endpoints

#### 1.2 Complete API Route Implementations  
- **Status**: Route files exist but missing implementations
- **Location**: `apps/api/src/routes/`
- **Tasks**:
  - Implement CRUD operations for devices, geofences, automations
  - Add PostgreSQL queries with PostGIS spatial functions
  - Implement authentication middleware and JWT handling
  - Add input validation using shared Zod schemas
  - Create admin endpoints for organization management

#### 1.3 Database Seeding & Migration Scripts
- **Status**: Migration exists, seeding scripts missing
- **Location**: `packages/db/scripts/`
- **Tasks**:
  - Complete `seed-dev.ts` with test geofences and devices
  - Implement `seed-prod.ts` for production setup
  - Add migration rollback functionality in `rollback.ts`
  - Create backup/restore scripts for event data replay

#### 1.4 Enhanced Geofence Processing
- **Status**: Basic implementation exists, needs dwell time support
- **Location**: `apps/geofence-engine/src/processors/GeofenceProcessor.ts`
- **Tasks**:
  - Implement dwell time detection with sliding window calculations
  - Add GPS accuracy filtering and buffer zone handling  
  - Enhance hysteresis logic for boundary flicker prevention
  - Support multiple geofence types (polygon/circle) with optimization
  - Add device state transition tracking for dwell calculations

### Phase 2: Integration & Automation Platform (Priority 2)

#### 2.1 Complete Integration Implementations
- **Status**: Only Notion partially implemented
- **Location**: `apps/automation-workers/src/integrations/`
- **Tasks**:
  - Complete `GoogleSheetsIntegration.ts` with Google Sheets API
  - Complete `SlackIntegration.ts` with webhook and bot API support
  - Complete `WhatsAppIntegration.ts` using Twilio/Meta Business API
  - Enhance `WebhookIntegration.ts` with signing and retries
  - Add rate limiting per integration to respect API limits

#### 2.2 OAuth & Authentication Flows
- **Status**: Missing - needs complete implementation  
- **Location**: `apps/api/src/auth/` (new directory)
- **Tasks**:
  - Implement OAuth 2.0 flows for Google Sheets, Notion, Slack
  - Create secure credential storage with encryption
  - Add refresh token handling and automatic renewal
  - Build integration setup wizard UI components
  - Implement webhook signature verification

#### 2.3 Automation Rule Engine & Templates
- **Status**: Missing - needs complete implementation
- **Location**: `packages/shared/src/templates/` (new)
- **Tasks**:
  - Create automation rule matching engine
  - Build template library for common use cases
  - Implement parameterized payload transformation
  - Add template marketplace integration points  
  - Support white-label customization capabilities

#### 2.4 Enhanced Worker Processing
- **Status**: Basic Bull queue setup, needs worker implementations
- **Location**: `apps/automation-workers/src/workers/AutomationWorker.ts`
- **Tasks**:
  - Complete worker implementation for processing geofence events
  - Add exponential backoff with jitter for failed webhooks
  - Implement dead letter queue handling and manual retry
  - Add worker scaling configuration and performance monitoring
  - Support webhook replay functionality from audit log

### Phase 3: Dashboard & UI (Priority 3)

#### 3.1 Mapbox Integration & Geofence Management
- **Status**: Basic Next.js setup, needs complete UI implementation
- **Location**: `apps/dashboard/src/`
- **Dependencies**: Need `MAPBOX_ACCESS_TOKEN` environment variable
- **Tasks**:
  - Integrate Mapbox GL JS for interactive map display
  - Build geofence creation UI (polygon and circle drawing tools)
  - Implement device location visualization with real-time updates
  - Add geofence editing, deletion, and status management
  - Create device management interface with metadata editing

#### 3.2 Automation Management Dashboard
- **Status**: Missing - needs complete implementation
- **Location**: `apps/dashboard/src/components/automations/`
- **Tasks**:
  - Build automation rule creation and editing interface
  - Create integration connection management (OAuth flows)
  - Add webhook testing and preview functionality  
  - Implement automation execution logs and debugging
  - Add template marketplace UI and custom template editor

#### 3.3 Analytics & Monitoring Dashboard
- **Status**: Missing - needs complete implementation
- **Location**: `apps/dashboard/src/components/analytics/`
- **Tasks**:
  - Create event history visualization and filtering
  - Build automation success/failure rate monitoring
  - Add device activity tracking and health status
  - Implement geofence heat maps and usage analytics
  - Create alerting system for failed automations

#### 3.4 Organization & User Management
- **Status**: Database schema exists, needs UI implementation
- **Location**: `apps/dashboard/src/components/organization/`
- **Tasks**:
  - Build user invitation and role management system
  - Create organization settings and billing integration
  - Add API key management for device authentication
  - Implement usage limits and quota enforcement
  - Add audit logging for administrative actions

### Phase 4: Production & Scaling (Priority 4)

#### 4.1 Performance & Optimization
- **Status**: Basic indexing exists, needs optimization
- **Tasks**:
  - Optimize PostgreSQL spatial indexes and query performance
  - Implement Kafka partitioning by device ID for parallel processing
  - Add connection pooling for external webhook destinations
  - Create caching layer for frequently accessed geofences
  - Add database query optimization and monitoring

#### 4.2 Testing & Quality Assurance
- **Status**: Test setup files exist, need implementation
- **Location**: All `tests/` and `*.test.ts` files
- **Tasks**:
  - Implement geospatial testing with PostGIS functions
  - Create integration testing with mock webhook endpoints
  - Add end-to-end testing with real integration sandboxes
  - Build load testing for high-frequency location updates
  - Add API contract testing and documentation

#### 4.3 DevOps & Deployment
- **Status**: Docker Compose exists, needs production setup
- **Tasks**:
  - Create production Docker configurations and Kubernetes manifests
  - Add health checks and monitoring for all services  
  - Implement log aggregation and distributed tracing
  - Create CI/CD pipelines with automated testing
  - Add backup and disaster recovery procedures

#### 4.4 Security & Compliance
- **Status**: Basic security middleware, needs enhancement
- **Tasks**:
  - Implement comprehensive API authentication and authorization
  - Add webhook signature verification and replay protection
  - Create data encryption for sensitive credentials
  - Add GDPR compliance features and data export
  - Implement security scanning and vulnerability monitoring

## Implementation Priority Matrix

### Immediate Focus (Week 1-2)
1. **MQTT Ingestion Service** - Critical for location data flow
2. **API Route Implementations** - Required for dashboard functionality  
3. **Dwell Time Processing** - Core geofence feature
4. **Database Seeding Scripts** - Needed for development/testing

### Short Term (Week 3-4)
1. **Integration Implementations** - Google Sheets, Slack, WhatsApp
2. **Basic Dashboard UI** - Mapbox integration and geofence management
3. **OAuth Flows** - Required for third-party integrations
4. **Automation Worker** - Complete processing pipeline

### Medium Term (Month 2)
1. **Advanced Dashboard Features** - Analytics, monitoring, user management
2. **Template System** - Automation marketplace and customization
3. **Testing Framework** - Comprehensive test coverage
4. **Performance Optimization** - Scaling and caching

### Long Term (Month 3+)
1. **Production Deployment** - Kubernetes, monitoring, CI/CD
2. **Security Enhancements** - Compliance, encryption, auditing
3. **Advanced Features** - White-label, advanced analytics
4. **Integration Expansion** - Additional third-party services

## Testing Strategy

### Geospatial Testing
- Use PostGIS spatial functions in test fixtures
- Mock GPS coordinates for predictable geofence transitions
- Test boundary conditions and GPS accuracy scenarios
- Validate dwell time calculations with time-shifted events

### Integration Testing
- Mock webhook endpoints for automation testing
- Test retry logic and dead letter queue handling
- Verify template rendering with various data payloads
- End-to-end tests with real integration sandboxes

### Load Testing
- Simulate high-frequency device location updates
- Test Kafka throughput with concurrent geofence calculations
- Validate webhook worker scaling under load
- Monitor PostGIS query performance with spatial indexes