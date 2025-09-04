-- GeoFence Webhooks Database Schema
-- This is a comprehensive initialization script that combines all schema elements
-- Created: 2025-09-04

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create custom types
CREATE TYPE geofence_type AS ENUM ('circle', 'polygon');
CREATE TYPE gf_event_type AS ENUM ('enter', 'exit', 'dwell');
CREATE TYPE automation_kind AS ENUM ('notion', 'sheets', 'slack', 'webhook', 'whatsapp');
CREATE TYPE delivery_status AS ENUM ('pending', 'success', 'failed');

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  notification_preferences JSONB DEFAULT '{}',
  timezone VARCHAR(50) DEFAULT 'UTC',
  phone VARCHAR(20),
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT check_password_hash_not_empty CHECK (password_hash <> '')
);

-- Accounts table (renamed from organizations)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  timezone VARCHAR(50) DEFAULT 'UTC',
  date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  time_format VARCHAR(5) DEFAULT '12',
  distance_unit VARCHAR(10) DEFAULT 'metric',
  data_retention_days INTEGER DEFAULT 365,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Groups table
CREATE TABLE device_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  color VARCHAR(7) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'device',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(account_id, name)
);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  device_key VARCHAR(255) UNIQUE NOT NULL,
  device_type VARCHAR(50),
  device_model VARCHAR(100),
  device_firmware_version VARCHAR(50),
  device_os VARCHAR(100),
  connection_type VARCHAR(20) CHECK (connection_type IN ('mqtt', 'websocket', 'http', 'bluetooth')),
  ip_address INET,
  mac_address MACADDR,
  group_id UUID REFERENCES device_groups(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}',
  
  -- Device pairing and authentication
  device_secret_key VARCHAR(255),
  pairing_code VARCHAR(20) UNIQUE,
  pairing_expires_at TIMESTAMP WITH TIME ZONE,
  is_paired BOOLEAN DEFAULT false,
  
  -- Device status and monitoring
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'connecting', 'error')),
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  health_metrics JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geofences table
CREATE TABLE geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  geom GEOMETRY(GEOMETRY, 4326) NOT NULL,
  type geofence_type NOT NULL,
  radius_m INTEGER,
  properties JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT geofences_radius_check CHECK (
    (type = 'circle' AND radius_m IS NOT NULL) OR 
    (type = 'polygon' AND radius_m IS NULL)
  )
);

-- Location Events table
CREATE TABLE location_events (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  loc GEOGRAPHY(POINT, 4326) NOT NULL,
  speed_mps REAL,
  accuracy_m REAL,
  battery_pct REAL,
  payload JSONB NOT NULL DEFAULT '{}'
);

-- Geofence Events table
CREATE TABLE geofence_events (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  type gf_event_type NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  dwell_seconds INTEGER,
  event_hash TEXT NOT NULL,
  UNIQUE (account_id, event_hash)
);

-- Automations table (renamed from integrations)
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind automation_kind NOT NULL,
  config JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automation Rules table
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  geofence_id UUID NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  on_events gf_event_type[] NOT NULL DEFAULT ARRAY['enter']::gf_event_type[],
  min_dwell_seconds INTEGER DEFAULT 0,
  device_filter JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true
);

-- Deliveries table (renamed from automation_executions)
CREATE TABLE deliveries (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  gevent_id BIGINT NOT NULL REFERENCES geofence_events(id) ON DELETE CASCADE,
  status delivery_status NOT NULL DEFAULT 'pending',
  attempt INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dead Letter Queue for failed jobs
CREATE TABLE dead_letter_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type VARCHAR(50) NOT NULL DEFAULT 'webhook',
  job_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  failed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status VARCHAR(20) NOT NULL DEFAULT 'failed' CHECK (status IN ('failed', 'replayed', 'permanent_failure')),
  replayed_at TIMESTAMP WITH TIME ZONE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Sessions table for JWT token management
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  permissions JSONB NOT NULL DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Device Sessions table for device authentication
CREATE TABLE device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  access_token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  refresh_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_revoked BOOLEAN DEFAULT false,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Pairing Requests table
CREATE TABLE device_pairing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pairing_code VARCHAR(20) NOT NULL UNIQUE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  organization_id UUID,
  device_metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Users table for device-user associations
CREATE TABLE device_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID,
  permissions VARCHAR(20) DEFAULT 'read' CHECK (permissions IN ('owner', 'admin', 'write', 'read')),
  granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(device_id, user_id)
);

-- Device Certificates table
CREATE TABLE device_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  certificate_serial VARCHAR(255) NOT NULL UNIQUE,
  certificate_pem TEXT NOT NULL,
  private_key_pem TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Events table for device lifecycle events
CREATE TABLE device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'paired', 'unpaired', 'online', 'offline', 'reconnected',
    'disconnected', 'error', 'firmware_update', 'config_change',
    'status_change', 'location_update', 'security_event',
    'command_sent', 'command_completed', 'command_failed'
  )),
  data JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device Heartbeats table
CREATE TABLE device_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  battery_level DECIMAL(5,2),
  connection_strength DECIMAL(5,2),
  uptime_seconds BIGINT,
  metadata JSONB DEFAULT '{}'
);

-- Device Commands table
CREATE TABLE device_commands (
  id VARCHAR(32) PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  command VARCHAR(50) NOT NULL CHECK (command IN (
    'restart', 'update_config', 'ping', 'get_status', 'update_firmware', 'factory_reset'
  )),
  parameters JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'acknowledged', 'completed', 'failed', 'timeout'
  )),
  response JSONB DEFAULT '{}',
  error_message TEXT,
  timeout_seconds INTEGER DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Device Tags table for flexible tagging
CREATE TABLE device_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tag VARCHAR(100) NOT NULL,
  value VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(device_id, tag)
);

-- Rate Limit Log table for database-backed rate limiting
CREATE TABLE rate_limit_log (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial indexes (devices table has no location column)
CREATE INDEX idx_geofences_geom_gix ON geofences USING GIST (geom);
CREATE INDEX idx_location_events_loc_gix ON location_events USING GIST (loc);

-- Create regular indexes for performance
-- Users table indexes
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_created_at ON users (created_at DESC);

-- Accounts table indexes
CREATE INDEX idx_accounts_created_at ON accounts (created_at DESC);

-- Devices table indexes
CREATE INDEX idx_devices_account_id ON devices (account_id);
CREATE INDEX idx_devices_device_key ON devices (device_key);
CREATE INDEX idx_devices_created_at ON devices (created_at DESC);
CREATE INDEX idx_devices_account_created ON devices (account_id, created_at DESC);
CREATE INDEX idx_devices_pairing_code ON devices (pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX idx_devices_status ON devices (account_id, status);
CREATE INDEX idx_devices_last_heartbeat ON devices (account_id, last_heartbeat DESC) WHERE status = 'online';
CREATE INDEX idx_devices_group_id ON devices (group_id) WHERE group_id IS NOT NULL;

-- Device Groups table indexes
CREATE INDEX idx_device_groups_account_id ON device_groups (account_id);

-- Geofences table indexes
CREATE INDEX idx_geofences_account_id ON geofences (account_id);
CREATE INDEX idx_geofences_active ON geofences (active) WHERE active = true;
CREATE INDEX idx_geofences_type ON geofences (type);
CREATE INDEX idx_geofences_account_active ON geofences (account_id, active) WHERE active = true;

-- Location Events table indexes
CREATE INDEX location_events_account_ts_idx ON location_events (account_id, ts DESC);
CREATE INDEX idx_location_events_device_ts ON location_events (device_id, ts DESC);

-- Geofence Events table indexes
CREATE INDEX ge_idx ON geofence_events (account_id, device_id, ts DESC);
CREATE INDEX idx_geofence_events_device_ts ON geofence_events (device_id, ts DESC);

-- Automations table indexes
CREATE INDEX idx_automations_account_id ON automations (account_id);
CREATE INDEX idx_automations_kind ON automations (kind);
CREATE INDEX idx_automations_enabled ON automations (enabled) WHERE enabled = true;

-- Automation Rules table indexes
CREATE INDEX idx_automation_rules_account_id ON automation_rules (account_id);
CREATE INDEX idx_automation_rules_automation_id ON automation_rules (automation_id);
CREATE INDEX idx_automation_rules_enabled ON automation_rules (enabled) WHERE enabled = true;
CREATE INDEX idx_automation_rules_geofence_id ON automation_rules (geofence_id);

-- Deliveries table indexes
CREATE INDEX deliveries_status_idx ON deliveries (status, next_attempt_at);

-- Dead Letter Queue indexes
CREATE INDEX idx_dead_letter_queue_status ON dead_letter_queue(status);
CREATE INDEX idx_dead_letter_queue_failed_at ON dead_letter_queue(failed_at);
CREATE INDEX idx_dead_letter_queue_account_id ON dead_letter_queue(account_id);
CREATE INDEX idx_dead_letter_queue_job_type ON dead_letter_queue(job_type);
CREATE INDEX idx_dead_letter_queue_replay ON dead_letter_queue(status, failed_at) WHERE status = 'failed';

-- User Sessions indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
CREATE INDEX idx_user_sessions_revoked_at ON user_sessions (revoked_at);

-- API Keys indexes
CREATE INDEX idx_api_keys_account_id ON api_keys (account_id);
CREATE INDEX idx_api_keys_active ON api_keys (account_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_hash ON api_keys (api_key_hash);

-- Device Sessions indexes
CREATE INDEX idx_device_sessions_device_id ON device_sessions (device_id);
CREATE INDEX idx_device_sessions_access_token ON device_sessions (access_token_hash);
CREATE INDEX idx_device_sessions_refresh_token ON device_sessions (refresh_token_hash);
CREATE INDEX idx_device_sessions_expires ON device_sessions (expires_at) WHERE is_revoked = false;

-- Device Pairing Requests indexes
CREATE INDEX idx_pairing_requests_code ON device_pairing_requests (pairing_code);
CREATE INDEX idx_pairing_requests_expires ON device_pairing_requests (expires_at);
CREATE INDEX idx_pairing_requests_account ON device_pairing_requests (account_id, expires_at DESC);

-- Device Users indexes
CREATE INDEX idx_device_users_device ON device_users (device_id);
CREATE INDEX idx_device_users_user ON device_users (user_id);
CREATE INDEX idx_device_users_org ON device_users (organization_id);

-- Device Certificates indexes
CREATE INDEX idx_device_certificates_device ON device_certificates (device_id);
CREATE INDEX idx_device_certificates_serial ON device_certificates (certificate_serial);
CREATE INDEX idx_device_certificates_expires ON device_certificates (expires_at);

-- Device Events indexes
CREATE INDEX idx_device_events_device ON device_events (device_id);
CREATE INDEX idx_device_events_type ON device_events (event_type);
CREATE INDEX idx_device_events_created ON device_events (created_at DESC);

-- Device Heartbeats indexes
CREATE INDEX idx_device_heartbeats_device ON device_heartbeats (device_id);
CREATE INDEX idx_device_heartbeats_timestamp ON device_heartbeats (timestamp DESC);

-- Device Commands indexes
CREATE INDEX idx_device_commands_device_id ON device_commands (device_id);
CREATE INDEX idx_device_commands_status ON device_commands (status);
CREATE INDEX idx_device_commands_created ON device_commands (created_at DESC);

-- Device Tags indexes
CREATE INDEX idx_device_tags_device_id ON device_tags (device_id);
CREATE INDEX idx_device_tags_tag ON device_tags (tag);
CREATE INDEX idx_device_tags_tag_value ON device_tags (tag, value);

-- Rate Limit Log indexes
CREATE INDEX idx_rate_limit_log_key_time ON rate_limit_log (key, created_at);
CREATE INDEX idx_rate_limit_log_created_at ON rate_limit_log (created_at);

-- Create helper functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update triggers for updated_at columns
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Device pairing and utility functions
CREATE OR REPLACE FUNCTION generate_pairing_code() RETURNS VARCHAR(20) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
BEGIN
    FOR i IN 1..10 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_device_secret() RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_pairing_code_expired(pairing_code VARCHAR(20)) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM device_pairing_requests
        WHERE pairing_code = $1 AND expires_at < NOW() AND used_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_device_permissions(device_uuid UUID, user_uuid UUID) RETURNS VARCHAR(20) AS $$
DECLARE
    result VARCHAR(20);
BEGIN
    SELECT permissions INTO result
    FROM device_users
    WHERE device_id = device_uuid AND user_id = user_uuid;
    
    RETURN COALESCE(result, 'none');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_device_online(device_uuid UUID) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM devices
        WHERE id = device_uuid
        AND last_heartbeat > (NOW() - INTERVAL '5 minutes')
        AND status = 'online'
    );
END;
$$ LANGUAGE plpgsql;

-- Device status tracking trigger function
CREATE OR REPLACE FUNCTION update_device_last_modified() RETURNS TRIGGER AS $$
BEGIN
    -- Log status changes
    IF OLD.status != NEW.status AND (OLD.status IS NOT NULL OR NEW.status IS NOT NULL) THEN
        INSERT INTO device_events (device_id, event_type, data)
        VALUES (NEW.id, 'status_change', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for device status tracking
CREATE TRIGGER device_status_trigger
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_device_last_modified();

-- Dead Letter Queue functions
CREATE OR REPLACE FUNCTION move_to_dlq_on_max_retries() 
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a failed delivery that has reached max retries
    IF NEW.status = 'failed' AND NEW.attempt >= 3 AND OLD.status != 'failed' THEN
        -- Insert into dead letter queue
        INSERT INTO dead_letter_queue (
            job_type,
            job_data,
            error_message,
            failed_at,
            retry_count,
            max_retries,
            account_id
        ) VALUES (
            'webhook',
            jsonb_build_object(
                'delivery_id', NEW.id,
                'automation_id', NEW.automation_id,
                'rule_id', NEW.rule_id,
                'gevent_id', NEW.gevent_id
            ),
            COALESCE(NEW.last_error, 'Max retries exceeded'),
            NEW.updated_at,
            NEW.attempt,
            3,
            NEW.account_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic DLQ insertion
CREATE TRIGGER trigger_move_to_dlq
    AFTER UPDATE ON deliveries
    FOR EACH ROW
    EXECUTE FUNCTION move_to_dlq_on_max_retries();

-- Utility functions for maintenance
CREATE OR REPLACE FUNCTION cleanup_old_dlq_records(older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM dead_letter_queue 
    WHERE failed_at < NOW() - (older_than_days || ' days')::INTERVAL
    AND status IN ('replayed', 'permanent_failure');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_dlq_stats(acct_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_failed INTEGER,
    total_replayed INTEGER,
    total_permanent_failures INTEGER,
    oldest_failure TIMESTAMP WITH TIME ZONE,
    newest_failure TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as total_failed,
        COUNT(*) FILTER (WHERE status = 'replayed')::INTEGER as total_replayed,
        COUNT(*) FILTER (WHERE status = 'permanent_failure')::INTEGER as total_permanent_failures,
        MIN(failed_at) as oldest_failure,
        MAX(failed_at) as newest_failure
    FROM dead_letter_queue 
    WHERE (acct_id IS NULL OR account_id = acct_id);
END;
$$ LANGUAGE plpgsql;

-- Set up default notification preferences for users
UPDATE users 
SET notification_preferences = '{
    "email_notifications": true,
    "push_notifications": true,
    "geofence_alerts": true,
    "automation_alerts": true,
    "weekly_reports": false,
    "system_updates": true
}'::jsonb
WHERE notification_preferences = '{}'::jsonb OR notification_preferences IS NULL;

-- Insert test account for development
INSERT INTO accounts (id, name) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Test Account')
ON CONFLICT (id) DO NOTHING;

-- Insert default device groups for existing accounts
INSERT INTO device_groups (id, name, description, account_id) 
SELECT 
  gen_random_uuid(),
  'Default',
  'Default group for ungrouped devices',
  accounts.id
FROM accounts
WHERE NOT EXISTS (
  SELECT 1 FROM device_groups 
  WHERE device_groups.account_id = accounts.id 
  AND device_groups.name = 'Default'
);

-- Add table comments for documentation
COMMENT ON TABLE dead_letter_queue IS 'Stores failed webhook jobs for manual review and replay';
COMMENT ON COLUMN dead_letter_queue.job_type IS 'Type of job that failed (webhook, notification, etc.)';
COMMENT ON COLUMN dead_letter_queue.job_data IS 'Original job data for replay purposes';
COMMENT ON COLUMN dead_letter_queue.error_message IS 'Error message from the failed execution';
COMMENT ON COLUMN dead_letter_queue.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN dead_letter_queue.status IS 'Current status: failed, replayed, or permanent_failure';

COMMENT ON FUNCTION move_to_dlq_on_max_retries() IS 'Automatically moves failed jobs to DLQ after max retries';
COMMENT ON FUNCTION cleanup_old_dlq_records(INTEGER) IS 'Removes old DLQ records for maintenance';
COMMENT ON FUNCTION get_dlq_stats(UUID) IS 'Returns DLQ statistics for monitoring';