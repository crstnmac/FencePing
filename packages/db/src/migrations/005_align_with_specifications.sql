-- Migration: 005_align_with_specifications.sql
-- Align database schema with project specifications while preserving existing data

-- Rename organizations to accounts for consistency with specifications
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations')
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        ALTER TABLE organizations RENAME TO accounts;

        -- Update constraint names that reference the old table name (only if they exist)
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_organization_id_fkey') THEN
            ALTER TABLE users RENAME CONSTRAINT users_organization_id_fkey TO users_account_id_fkey;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'devices_organization_id_fkey') THEN
            ALTER TABLE devices RENAME CONSTRAINT devices_organization_id_fkey TO devices_account_id_fkey;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'geofences_organization_id_fkey') THEN
            ALTER TABLE geofences RENAME CONSTRAINT geofences_organization_id_fkey TO geofences_account_id_fkey;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'integrations_organization_id_fkey') THEN
            ALTER TABLE integrations RENAME CONSTRAINT integrations_organization_id_fkey TO integrations_account_id_fkey;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'automation_rules_organization_id_fkey') THEN
            ALTER TABLE automation_rules RENAME CONSTRAINT automation_rules_organization_id_fkey TO automation_rules_account_id_fkey;
        END IF;

        -- Rename columns to match specifications (only if they exist)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='account_id') THEN
            ALTER TABLE users RENAME COLUMN organization_id TO account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='organization_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='account_id') THEN
            ALTER TABLE devices RENAME COLUMN organization_id TO account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='organization_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='account_id') THEN
            ALTER TABLE geofences RENAME COLUMN organization_id TO account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='integrations' AND column_name='organization_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='integrations' AND column_name='account_id') THEN
            ALTER TABLE integrations RENAME COLUMN organization_id TO account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='organization_id')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='account_id') THEN
            ALTER TABLE automation_rules RENAME COLUMN organization_id TO account_id;
        END IF;

        -- Rename indexes (only if they exist)
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_devices_organization_id') THEN
            ALTER INDEX idx_devices_organization_id RENAME TO idx_devices_account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_geofences_organization_id') THEN
            ALTER INDEX idx_geofences_organization_id RENAME TO idx_geofences_account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_integrations_organization_id') THEN
            ALTER INDEX idx_integrations_organization_id RENAME TO idx_integrations_account_id;
        END IF;
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_organization_id') THEN
            ALTER INDEX idx_automation_rules_organization_id RENAME TO idx_automation_rules_account_id;
        END IF;
    END IF;
END $$;

-- Add plan column to accounts if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='plan') THEN
        ALTER TABLE accounts ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
    END IF;
END $$;

-- Update devices table to match specifications
DO $$
BEGIN
    -- Rename device_token to device_key
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='device_token')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='device_key') THEN
        ALTER TABLE devices RENAME COLUMN device_token TO device_key;
        -- Rename index only if it exists
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_devices_token') THEN
            ALTER INDEX idx_devices_token RENAME TO idx_devices_key;
        END IF;
    END IF;
    
    -- Add meta column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='meta') THEN
        ALTER TABLE devices ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    -- Remove columns that don't match specifications
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='description') THEN
        ALTER TABLE devices DROP COLUMN description;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='last_seen') THEN
        ALTER TABLE devices DROP COLUMN last_seen;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='last_location') THEN
        ALTER TABLE devices DROP COLUMN last_location;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='is_active') THEN
        ALTER TABLE devices DROP COLUMN is_active;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='devices' AND column_name='updated_at') THEN
        ALTER TABLE devices DROP COLUMN updated_at;
    END IF;
END $$;

-- Update geofences table to match specifications
DO $$
BEGIN
    -- Create geofence_type enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'geofence_type') THEN
        CREATE TYPE geofence_type AS ENUM ('circle', 'polygon');
    END IF;
    
    -- Rename geometry to geom
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='geometry')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='geom') THEN
        ALTER TABLE geofences RENAME COLUMN geometry TO geom;
        -- Rename index only if it exists
        IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_geofences_geometry') THEN
            ALTER INDEX idx_geofences_geometry RENAME TO idx_geofences_geom;
        END IF;
    END IF;
    
    -- Add type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='type') THEN
        ALTER TABLE geofences ADD COLUMN type geofence_type;
        -- Set default type based on existing geofence_type column
        UPDATE geofences SET type = geofence_type::geofence_type WHERE geofence_type IS NOT NULL;
        -- Drop old geofence_type column
        ALTER TABLE geofences DROP COLUMN IF EXISTS geofence_type;
        -- Make type NOT NULL after setting values
        ALTER TABLE geofences ALTER COLUMN type SET NOT NULL;
    END IF;
    
    -- Add radius_m column for circles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='radius_m') THEN
        ALTER TABLE geofences ADD COLUMN radius_m INTEGER;
    END IF;
    
    -- Rename metadata to properties
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='metadata')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='properties') THEN
        ALTER TABLE geofences RENAME COLUMN metadata TO properties;
    END IF;
    
    -- Rename is_active to active
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='is_active')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='active') THEN
        ALTER TABLE geofences RENAME COLUMN is_active TO active;
    END IF;
    
    -- Remove columns that don't match specifications
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='description') THEN
        ALTER TABLE geofences DROP COLUMN description;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='geofences' AND column_name='updated_at') THEN
        ALTER TABLE geofences DROP COLUMN updated_at;
    END IF;
    
    -- Update existing data to satisfy the constraint before adding it
    -- Set radius_m to NULL for polygon geofences
    UPDATE geofences SET radius_m = NULL WHERE type = 'polygon' AND radius_m IS NOT NULL;
    -- Set a default radius for circle geofences that don't have one
    UPDATE geofences SET radius_m = 100 WHERE type = 'circle' AND radius_m IS NULL;

    -- Add check constraint for circle/polygon validation
    ALTER TABLE geofences DROP CONSTRAINT IF EXISTS geofences_radius_check;
    ALTER TABLE geofences ADD CONSTRAINT geofences_radius_check
        CHECK ((type = 'circle' AND radius_m IS NOT NULL) OR (type = 'polygon' AND radius_m IS NULL));
END $$;

-- Create location_events table to match specifications
CREATE TABLE IF NOT EXISTS location_events (
    id BIGSERIAL PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL,
    loc GEOGRAPHY(POINT, 4326) NOT NULL,
    speed_mps REAL,
    accuracy_m REAL,
    battery_pct REAL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Create indexes for location_events
CREATE INDEX IF NOT EXISTS location_events_account_ts_idx ON location_events (account_id, ts DESC);
CREATE INDEX IF NOT EXISTS location_events_loc_gix ON location_events USING GIST (loc);

-- Create geofence_events table to match specifications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gf_event_type') THEN
        CREATE TYPE gf_event_type AS ENUM ('enter', 'exit', 'dwell');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS geofence_events (
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

CREATE INDEX IF NOT EXISTS ge_idx ON geofence_events (account_id, device_id, ts DESC);

-- Update integrations table to match automations specifications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'automation_kind') THEN
        CREATE TYPE automation_kind AS ENUM ('notion', 'sheets', 'slack', 'webhook', 'whatsapp');
    END IF;
END $$;

-- Rename integrations to automations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
        -- Create new automations table
        CREATE TABLE IF NOT EXISTS automations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            kind automation_kind NOT NULL,
            config JSONB NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        -- Migrate data from integrations to automations
        INSERT INTO automations (id, account_id, name, kind, config, enabled, created_at)
        SELECT 
            id, 
            account_id, 
            name, 
            CASE 
                WHEN type = 'google_sheets' THEN 'sheets'::automation_kind
                ELSE type::automation_kind
            END,
            COALESCE(config, '{}'::jsonb),
            COALESCE(is_active, true),
            COALESCE(created_at, now())
        FROM integrations
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Update automation_rules table to match specifications
DO $$
BEGIN
    -- Rename integration_id to automation_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='integration_id')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='automation_id') THEN
        ALTER TABLE automation_rules RENAME COLUMN integration_id TO automation_id;
    END IF;
    
    -- Add on_events column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='on_events') THEN
        ALTER TABLE automation_rules ADD COLUMN on_events gf_event_type[] NOT NULL DEFAULT ARRAY['enter']::gf_event_type[];
        -- Populate on_events based on existing trigger_type
        UPDATE automation_rules SET on_events = ARRAY[trigger_type::gf_event_type] WHERE trigger_type IS NOT NULL;
    END IF;
    
    -- Rename dwell_time_minutes to min_dwell_seconds
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='dwell_time_minutes')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='min_dwell_seconds') THEN
        ALTER TABLE automation_rules RENAME COLUMN dwell_time_minutes TO min_dwell_seconds;
        -- Convert minutes to seconds
        UPDATE automation_rules SET min_dwell_seconds = min_dwell_seconds * 60 WHERE min_dwell_seconds IS NOT NULL;
    END IF;
    
    -- Add device_filter column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='device_filter') THEN
        ALTER TABLE automation_rules ADD COLUMN device_filter JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    -- Rename is_active to enabled
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='is_active')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='enabled') THEN
        ALTER TABLE automation_rules RENAME COLUMN is_active TO enabled;
    END IF;
    
    -- Remove columns that don't match specifications
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='description') THEN
        ALTER TABLE automation_rules DROP COLUMN description;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='trigger_type') THEN
        ALTER TABLE automation_rules DROP COLUMN trigger_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='action_config') THEN
        ALTER TABLE automation_rules DROP COLUMN action_config;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='created_at') THEN
        ALTER TABLE automation_rules DROP COLUMN created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='automation_rules' AND column_name='updated_at') THEN
        ALTER TABLE automation_rules DROP COLUMN updated_at;
    END IF;
END $$;

-- Create deliveries table to match specifications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE delivery_status AS ENUM ('pending', 'success', 'failed');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS deliveries (
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

CREATE INDEX IF NOT EXISTS deliveries_status_idx ON deliveries (status, next_attempt_at);

-- Clean up old tables after migration
-- Note: Only drop if we successfully created the new tables
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automations') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
        -- Update foreign key references in automation_rules
        UPDATE automation_rules 
        SET automation_id = a.id 
        FROM automations a, integrations i 
        WHERE automation_rules.automation_id = i.id AND a.id = i.id;
        
        -- Drop the old integrations table
        DROP TABLE integrations CASCADE;
    END IF;
    
    -- Drop old events table if it exists (replaced by location_events and geofence_events)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') THEN
        DROP TABLE events CASCADE;
    END IF;
    
    -- Drop old automation_executions table (replaced by deliveries)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'automation_executions') THEN
        DROP TABLE automation_executions CASCADE;
    END IF;
END $$;
