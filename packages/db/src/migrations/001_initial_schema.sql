-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  device_token VARCHAR(255) UNIQUE NOT NULL,
  last_seen TIMESTAMP WITH TIME ZONE,
  last_location GEOMETRY(POINT, 4326),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geofences table
CREATE TABLE geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  geometry GEOMETRY(GEOMETRY, 4326) NOT NULL,
  geofence_type VARCHAR(50) NOT NULL CHECK (geofence_type IN ('circle', 'polygon')),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integrations table
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL CHECK (type IN ('notion', 'google_sheets', 'slack', 'whatsapp', 'webhook')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}',
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Automation rules table
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  geofence_id UUID REFERENCES geofences(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('enter', 'exit', 'dwell')),
  dwell_time_minutes INTEGER DEFAULT 0,
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table (audit log)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
  location GEOMETRY(POINT, 4326),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Automation executions table
CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  response_data JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create spatial indexes
CREATE INDEX idx_devices_location ON devices USING GIST (last_location);
CREATE INDEX idx_geofences_geometry ON geofences USING GIST (geometry);
CREATE INDEX idx_events_location ON events USING GIST (location);
CREATE INDEX idx_events_timestamp ON events (timestamp DESC);
CREATE INDEX idx_events_device_id ON events (device_id);
CREATE INDEX idx_events_geofence_id ON events (geofence_id);

-- Create regular indexes
CREATE INDEX idx_devices_organization_id ON devices (organization_id);
CREATE INDEX idx_devices_token ON devices (device_token);
CREATE INDEX idx_geofences_organization_id ON geofences (organization_id);
CREATE INDEX idx_integrations_organization_id ON integrations (organization_id);
CREATE INDEX idx_automation_rules_organization_id ON automation_rules (organization_id);
CREATE INDEX idx_automation_rules_geofence_id ON automation_rules (geofence_id);
CREATE INDEX idx_automation_executions_status ON automation_executions (status);
CREATE INDEX idx_automation_executions_executed_at ON automation_executions (executed_at DESC);