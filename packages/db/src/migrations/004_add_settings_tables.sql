-- Migration: Add settings and API keys tables
-- This migration adds support for user preferences, organization settings, and API key management

-- Add columns to users table for settings
DO $$
BEGIN
    -- Add notification preferences column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='notification_preferences') THEN
        ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{}';
    END IF;
    
    -- Add timezone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='timezone') THEN
        ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
    END IF;
    
    -- Add phone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
END $$;

-- Add columns to organizations table for settings
DO $$
BEGIN
    -- Add timezone column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='timezone') THEN
        ALTER TABLE organizations ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
    END IF;
    
    -- Add date format preference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='date_format') THEN
        ALTER TABLE organizations ADD COLUMN date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY';
    END IF;
    
    -- Add time format preference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='time_format') THEN
        ALTER TABLE organizations ADD COLUMN time_format VARCHAR(5) DEFAULT '12';
    END IF;
    
    -- Add distance unit preference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='distance_unit') THEN
        ALTER TABLE organizations ADD COLUMN distance_unit VARCHAR(10) DEFAULT 'metric';
    END IF;
    
    -- Add data retention setting
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='data_retention_days') THEN
        ALTER TABLE organizations ADD COLUMN data_retention_days INTEGER DEFAULT 365;
    END IF;
    
    -- Add updated_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='updated_at') THEN
        ALTER TABLE organizations ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Add updated_at column to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
        ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- First few characters for display
    permissions JSONB NOT NULL DEFAULT '["read"]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for API keys after table is created
DO $$
BEGIN
    -- Wait for table creation, then add indexes
    PERFORM pg_sleep(0.1);
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_api_keys_organization_id') THEN
            CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_api_keys_active') THEN
            CREATE INDEX idx_api_keys_active ON api_keys(organization_id, is_active) WHERE is_active = TRUE;
        END IF;
        
        -- Only create hash index if column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'api_key_hash') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_api_keys_hash') THEN
                CREATE INDEX idx_api_keys_hash ON api_keys(api_key_hash);
            END IF;
        END IF;
    END IF;
END $$;

-- Add last_activity_at column to user_sessions table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_sessions' AND column_name='last_activity_at') THEN
        ALTER TABLE user_sessions ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers if they don't exist
DO $$
BEGIN
    -- Users table trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
        CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- Organizations table trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_updated_at') THEN
        CREATE TRIGGER update_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    -- API keys table trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_api_keys_updated_at') THEN
        CREATE TRIGGER update_api_keys_updated_at
        BEFORE UPDATE ON api_keys
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Insert default notification preferences for existing users
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