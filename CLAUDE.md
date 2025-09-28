# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GeoFence Webhooks is a location-based automation platform that connects MQTT device tracking to business workflows via webhooks to Notion, Google Sheets, Slack, and WhatsApp. The system processes location events through a Kafka stream to trigger automations when devices enter/exit/dwell within geofenced areas.

## Architecture

This is a **Turbo monorepo** with TypeScript, using npm workspaces. The system follows an event-driven architecture with these core components:

### Monorepo Structure
- **apps/api** - Express.js REST API server with Socket.IO (port 3001)
- **apps/dashboard** - Next.js frontend with **MapLibre GL JS** and **Terra Draw** (port 3000)
- **apps/automation-workers** - Background job processors using Bull queues
- **apps/geofence-engine** - Spatial event processing service
- **apps/mqtt-ingestion** - MQTT client service for device location ingestion
- **packages/db** - Database layer with PostgreSQL/PostGIS migrations and schemas
- **packages/shared** - Common TypeScript types, utilities, and Zod validation schemas

### Data Flow
1. **Ingestion Layer**: MQTT broker (EMQX) + REST API fallback
2. **Stream Processing**: Kafka topics for event routing and audit logging
3. **Geospatial Engine**: PostgreSQL + PostGIS for geofence calculations
4. **Automation Workers**: Webhook processors with retry/DLQ handling
5. **Dashboard**: Next.js frontend with **MapLibre GL JS** (not Mapbox) for geofence management

### Key Kafka Topics
- `raw_events`: Incoming device location data (7-day retention)
- `geofence_events`: Enter/exit/dwell events after processing (30-day retention)
- `automations`: Triggered webhook/notification events (30-day retention)
- `audit_log`: Immutable event history for replay (1-year retention)

### Database Schema Focus Areas
- PostGIS GEOMETRY columns for geofence polygons/circles
- GEOGRAPHY columns for device locations with spatial indexes (GIST)
- Event tables with ST_Contains/ST_DWithin spatial queries
- Dwell tracking via window functions with hysteresis logic
- Multi-tenant organization structure with user/device/integration tables

### Key Technologies
- **Authentication**: Better Auth framework (OAuth with Google, GitHub)
- **Frontend Maps**: MapLibre GL JS (open-source) with Terra Draw for interactive editing
- **Background Jobs**: Bull queues with Redis
- **Build System**: Turbo with 10 concurrent tasks, daemon mode, strict environment variables

## Current Implementation Status

### ✅ Fully Implemented
- Database schema with PostGIS spatial extensions and indexes
- Docker Compose infrastructure (PostgreSQL, Kafka, Redis, EMQX MQTT)
- Turbo monorepo build system with TypeScript compilation
- Better Auth integration with OAuth providers (Google, GitHub)
- API server structure with Express.js and Socket.IO
- Next.js dashboard with MapLibre GL JS and Terra Draw integration
- Basic frontend components and routing structure

### 🚧 Partially Implemented
- **API Routes**: Route files exist in `apps/api/src/routes/` but many endpoints need implementation
- **Geofence Engine**: Basic Kafka consumer setup exists, needs dwell time detection logic
- **Automation Workers**: Bull queue infrastructure exists, integration logic incomplete
- **Dashboard UI**: Component structure exists, interactive features need implementation
- **Better Auth Setup**: Configuration exists, OAuth flows need completion

### ❌ Missing/Incomplete
- **MQTT Ingestion Service**: Service structure exists but processing logic missing
- **Integration APIs**: Only basic webhook support, need Google Sheets/Slack/Notion/WhatsApp
- **Database Seeding**: Migration exists, seeding scripts incomplete
- **Testing Framework**: Test files exist but implementations missing
- **Production Deployment**: Missing Kubernetes manifests and CI/CD

### Key Files to Understand
- **Database**: `packages/db/src/migrations/` - Complete PostGIS schema
- **API Structure**: `apps/api/src/routes/` - Route definitions needing implementation
- **Frontend Components**: `apps/dashboard/src/components/` - UI components with MapLibre integration
- **Workers**: `apps/automation-workers/src/` - Bull queue setup and integration stubs
- **Shared Types**: `packages/shared/src/` - TypeScript interfaces and Zod schemas

## Development Commands

### Quick Start
```bash
# Start all infrastructure services
npm run docker:up

# Start all development services
npm run dev

# Alternative: start individual services
npm run dev:api          # API server (port 3001)
npm run dev:dashboard    # Dashboard (port 3000)
npm run dev:geofence-engine     # Geofence processor
npm run dev:automation-workers  # Webhook workers
npm run dev:mqtt-ingestion      # MQTT ingestion service
```

### Infrastructure Management
```bash
# Docker operations
npm run docker:up           # Start all infrastructure (postgres, kafka, mqtt, redis)
npm run docker:down         # Stop all services
npm run docker:logs         # View logs
npm run docker:dev          # Development stack
npm run docker:prod         # Production stack

# Database operations
npm run migrate             # Run PostgreSQL migrations
npm run migrate:create      # Create new migration
npm run seed:dev           # Seed development data
npm run backup:events      # Backup event data
npm run restore:events     # Restore event data
```

### Code Quality & Build
```bash
# Development workflow
npm run build              # Build all apps and packages
npm run lint              # ESLint across all packages
npm run lint:fix          # Auto-fix linting issues
npm run typecheck         # TypeScript validation
npm run format            # Prettier formatting
npm run format:check      # Check formatting

# Utilities
npm run clean             # Clean build artifacts
npm run reset             # Full reset and reinstall
npm run turbo:cache:clear # Clear Turbo cache
```

### Testing
```bash
# Note: Test implementations are incomplete (see roadmap)
npm test                  # Run unit tests
npm run test:integration  # Integration tests
npm run test:geospatial   # PostGIS-specific tests
npm run test:load         # Load testing
npm run test:automation-flow  # End-to-end automation testing
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
```env
# Core Infrastructure
DATABASE_URL="postgresql://geofence_user:geofence_pass@localhost:5432/geofence"
KAFKA_BROKERS=localhost:9092
MQTT_BROKER_URL=mqtt://localhost:1883
REDIS_URL=redis://localhost:6379

# API Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Authentication (Better Auth)
JWT_SECRET=your-secret-key-change-in-production-at-least-32-characters-long
JWT_EXPIRES_IN=7d
```

### Integration Credentials (Optional)
```env
# Google Sheets OAuth
GOOGLE_SHEETS_CLIENT_ID=
GOOGLE_SHEETS_CLIENT_SECRET=

# Notion OAuth
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# Slack OAuth
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=

# WhatsApp Business API
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_ACCESS_TOKEN=

# Twilio (Alternative WhatsApp)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Payment Processing (Optional)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Management UI Access (Development)
- **Dashboard**: http://localhost:3000
- **EMQX MQTT**: http://localhost:18083 (admin/emqx_dev_password)
- **Kafka UI**: http://localhost:8080 (if using --profile tools)
- **pgAdmin**: http://localhost:8081 (admin@geofence.local/geofence123) - Optional

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

## Important Development Notes

### Code Quality Requirements
**ALWAYS run these commands after making changes:**
```bash
npm run lint          # Run ESLint across all packages
npm run typecheck     # TypeScript validation across all packages
```

Individual packages also have their own lint/typecheck commands:
- `apps/api`: `eslint src/**/*.ts --fix` and `tsc --noEmit`
- `apps/dashboard`: `next lint --fix` and `tsc --noEmit`
- `apps/automation-workers`: `eslint src/**/*.ts --fix` and `tsc --noEmit`
- `apps/geofence-engine`: `eslint src/**/*.ts --fix` and `tsc --noEmit`
- `apps/mqtt-ingestion`: `eslint src --ext .ts --fix` and `tsc --noEmit`

### Node.js Requirements
- **Node.js**: ≥20.0.0
- **npm**: ≥10.0.0 (locked to npm@10.9.3)
- **Type**: ESM modules throughout the project

### MapLibre vs Mapbox
**Important**: This project uses **MapLibre GL JS** (open-source), NOT Mapbox GL JS. No Mapbox access token is required. The frontend mapping uses MapLibre with Terra Draw for interactive geofence editing.

### Better Auth Integration
The project uses Better Auth framework for authentication, which is different from NextAuth. Reference the Better Auth documentation for OAuth implementations and configuration.