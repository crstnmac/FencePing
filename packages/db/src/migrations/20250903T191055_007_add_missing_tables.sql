-- Migration: 007_add_missing_tables
-- Created: 2025-09-03T19:10:55.453Z

-- Organizations table (if not exists)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table (if not exists)
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
  location GEOMETRY(POINT, 4326),
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Integrations table (if not exists)
CREATE TABLE IF NOT EXISTS integrations (
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

-- Automation executions table (if not exists)
CREATE TABLE IF NOT EXISTS automation_executions (
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

-- Add indexes for better performance (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_events_location') THEN
        CREATE INDEX idx_events_location ON events USING GIST (location);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_events_timestamp') THEN
        CREATE INDEX idx_events_timestamp ON events (timestamp DESC);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_events_device_id') THEN
        CREATE INDEX idx_events_device_id ON events (device_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_events_geofence_id') THEN
        CREATE INDEX idx_events_geofence_id ON events (geofence_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_integrations_organization_id') THEN
        CREATE INDEX idx_integrations_organization_id ON integrations (organization_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_automation_executions_status') THEN
        CREATE INDEX idx_automation_executions_status ON automation_executions (status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_automation_executions_executed_at') THEN
        CREATE INDEX idx_automation_executions_executed_at ON automation_executions (executed_at DESC);
    END IF;
END $$;
