-- Migration: 008_device_pairing_enhancements.sql
-- Created: 2025-09-04
-- Description: Comprehensive device pairing and authentication enhancements

-- Add device pairing enhancements to existing devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_secret_key VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pairing_code VARCHAR(20) UNIQUE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS pairing_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_paired BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_model VARCHAR(100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_firmware_version VARCHAR(50);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_os VARCHAR(100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS connection_type VARCHAR(20) CHECK (connection_type IN ('mqtt', 'websocket', 'http', 'bluetooth'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS mac_address MACADDR;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'connecting', 'error'));
ALTER TABLE devices ADD COLUMN IF NOT EXISTS health_metrics JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '{}';

-- Create accounts table if it doesn't exist (renamed from organizations in previous migration)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create device_sessions table for device authentication
CREATE TABLE IF NOT EXISTS device_sessions (
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

-- Create device_pairing_requests table for temporary pairing codes
CREATE TABLE IF NOT EXISTS device_pairing_requests (
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

-- Create device_users table for device-user associations
CREATE TABLE IF NOT EXISTS device_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID,
  permissions VARCHAR(20) DEFAULT 'read' CHECK (permissions IN ('owner', 'admin', 'write', 'read')),
  granted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(device_id, user_id)
);

-- Create device_certificates table for device certificate management
CREATE TABLE IF NOT EXISTS device_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  certificate_serial VARCHAR(255) NOT NULL UNIQUE,
  certificate_pem TEXT NOT NULL,
  private_key_pem TEXT NOT NULL, -- Encrypted
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create device_events table for device lifecycle events
CREATE TABLE IF NOT EXISTS device_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'paired', 'unpaired', 'online', 'offline', 'reconnected',
    'disconnected', 'error', 'firmware_update', 'config_change',
    'status_change', 'location_update', 'security_event'
  )),
  data JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create device_heartbeats table for heartbeat history
CREATE TABLE IF NOT EXISTS device_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  battery_level DECIMAL(5,2),
  connection_strength DECIMAL(5,2),
  uptime_seconds BIGINT,
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
DO $$
BEGIN
    -- Device sessions indexes
    CREATE INDEX IF NOT EXISTS idx_device_sessions_device_id ON device_sessions (device_id);
    CREATE INDEX IF NOT EXISTS idx_device_sessions_access_token ON device_sessions (access_token_hash);
    CREATE INDEX IF NOT EXISTS idx_device_sessions_refresh_token ON device_sessions (refresh_token_hash);
    CREATE INDEX IF NOT EXISTS idx_device_sessions_expires ON device_sessions (expires_at) WHERE is_revoked = false;

    -- Device pairing requests indexes
    CREATE INDEX IF NOT EXISTS idx_pairing_requests_code ON device_pairing_requests (pairing_code);
    CREATE INDEX IF NOT EXISTS idx_pairing_requests_expires ON device_pairing_requests (expires_at);
    CREATE INDEX IF NOT EXISTS idx_pairing_requests_account ON device_pairing_requests (account_id,expires_at DESC);

    -- Device users indexes
    CREATE INDEX IF NOT EXISTS idx_device_users_device ON device_users (device_id);
    CREATE INDEX IF NOT EXISTS idx_device_users_user ON device_users (user_id);
    CREATE INDEX IF NOT EXISTS idx_device_users_org ON device_users (organization_id);

    -- Device certificates indexes
    CREATE INDEX IF NOT EXISTS idx_device_certificates_device ON device_certificates (device_id);
    CREATE INDEX IF NOT EXISTS idx_device_certificates_serial ON device_certificates (certificate_serial);
    CREATE INDEX IF NOT EXISTS idx_device_certificates_expires ON device_certificates (expires_at);

    -- Device events indexes
    CREATE INDEX IF NOT EXISTS idx_device_events_device ON device_events (device_id);
    CREATE INDEX IF NOT EXISTS idx_device_events_type ON device_events (event_type);
    CREATE INDEX IF NOT EXISTS idx_device_events_created ON device_events (created_at DESC);

    -- Device heartbeats indexes
    CREATE INDEX IF NOT EXISTS idx_device_heartbeats_device ON device_heartbeats (device_id);
    CREATE INDEX IF NOT EXISTS idx_device_heartbeats_timestamp ON device_heartbeats (timestamp DESC);

    -- Enhanced device table indexes
    CREATE INDEX IF NOT EXISTS idx_devices_pairing_code ON devices (pairing_code) WHERE pairing_code IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices (account_id, status);
    CREATE INDEX IF NOT EXISTS idx_devices_last_heartbeat ON devices (account_id, last_heartbeat DESC) WHERE status = 'online';
END $$;

-- Create functions for device pairing and authentication
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

-- Function to generate unique device secret key
CREATE OR REPLACE FUNCTION generate_device_secret() RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to check device pairing expiry
CREATE OR REPLACE FUNCTION is_pairing_code_expired(pairing_code VARCHAR(20)) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM device_pairing_requests
        WHERE pairing_code = $1 AND expires_at < NOW() AND used_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get device permissions for user
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

-- Function to check device online status (within last 5 minutes heartbeat)
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

-- Updated trigger function to handle device status changes
CREATE OR REPLACE FUNCTION update_device_last_modified() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Log status changes
    IF OLD.status != NEW.status AND (OLD.status IS NOT NULL OR NEW.status IS NOT NULL) THEN
        INSERT INTO device_events (device_id, event_type, data)
        VALUES (NEW.id, 'status_change', jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for device status tracking
DROP TRIGGER IF EXISTS device_status_trigger ON devices;
CREATE TRIGGER device_status_trigger
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_device_last_modified();

-- Insert some sample data for testing (optional)
-- This would be used during development and testing
INSERT INTO accounts (id, name) VALUES
    ('550e8400-e29b-41d4-a716-446655440000', 'Test Account')
ON CONFLICT (id) DO NOTHING;

COMMIT;
