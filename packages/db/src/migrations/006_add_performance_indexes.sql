-- Migration: 006_add_performance_indexes.sql
-- Add database indexes for improved query performance

-- Check if tables exist before creating indexes
DO $$
BEGIN
    -- Indexes for devices table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'devices') THEN
        CREATE INDEX IF NOT EXISTS idx_devices_account_id ON devices (account_id);
        CREATE INDEX IF NOT EXISTS idx_devices_device_key ON devices (device_key);
        CREATE INDEX IF NOT EXISTS idx_devices_created_at ON devices (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_devices_account_created ON devices (account_id, created_at DESC);
    END IF;

    -- Indexes for accounts table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts (created_at DESC);
    END IF;

    -- Indexes for users table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);
    END IF;

    -- Indexes for geofences table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geofences') THEN
        CREATE INDEX IF NOT EXISTS idx_geofences_account_id ON geofences (account_id);
        CREATE INDEX IF NOT EXISTS idx_geofences_active ON geofences (active) WHERE active = true;
        CREATE INDEX IF NOT EXISTS idx_geofences_type ON geofences (type);
        CREATE INDEX IF NOT EXISTS idx_geofences_geom_gix ON geofences USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_geofences_account_active ON geofences (account_id, active) WHERE active = true;
    END IF;

    -- Indexes for location_events table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'location_events') THEN
        CREATE INDEX IF NOT EXISTS location_events_account_ts_idx ON location_events (account_id, ts DESC);
        CREATE INDEX IF NOT EXISTS location_events_loc_gix ON location_events USING GIST (loc);
        CREATE INDEX IF NOT EXISTS idx_location_events_device_ts ON location_events (device_id, ts DESC);
    END IF;

    -- Indexes for geofence_events table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geofence_events') THEN
        CREATE INDEX IF NOT EXISTS ge_idx ON geofence_events (account_id, device_id, ts DESC);
        CREATE INDEX IF NOT EXISTS idx_geofence_events_device_ts ON geofence_events (device_id, ts DESC);
    END IF;

    -- Indexes for automations table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automations') THEN
        CREATE INDEX IF NOT EXISTS idx_automations_account_id ON automations (account_id);
        CREATE INDEX IF NOT EXISTS idx_automations_kind ON automations (kind);
        CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations (enabled) WHERE enabled = true;
    END IF;

    -- Indexes for automation_rules table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_rules') THEN
        CREATE INDEX IF NOT EXISTS idx_automation_rules_account_id ON automation_rules (account_id);
        CREATE INDEX IF NOT EXISTS idx_automation_rules_automation_id ON automation_rules (automation_id);
        CREATE INDEX IF NOT EXISTS idx_automation_rules_enabled ON automation_rules (enabled) WHERE enabled = true;
    END IF;

    -- Indexes for deliveries table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deliveries') THEN
        CREATE INDEX IF NOT EXISTS deliveries_status_idx ON deliveries (status, next_attempt_at);
    END IF;
END $$;
