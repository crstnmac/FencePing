-- Update existing api_keys table if it exists, or create if it doesn't
DO $$
BEGIN
    -- Check if table exists and update structure if needed
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'api_keys') THEN
        -- Update existing table structure to match expected schema
        
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'name') THEN
            ALTER TABLE api_keys ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'Unnamed Key';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'last_used_at') THEN
            ALTER TABLE api_keys ADD COLUMN last_used_at TIMESTAMPTZ;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'revoked_at') THEN
            ALTER TABLE api_keys ADD COLUMN revoked_at TIMESTAMPTZ;
        END IF;
        
        -- Update column types if needed
        ALTER TABLE api_keys ALTER COLUMN name TYPE TEXT;
        ALTER TABLE api_keys ALTER COLUMN api_key_hash TYPE TEXT;
        ALTER TABLE api_keys ALTER COLUMN key_prefix TYPE TEXT;
    ELSE
        -- Create table if it doesn't exist
        CREATE TABLE api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            created_by UUID NOT NULL REFERENCES users(id),
            name TEXT NOT NULL,
            api_key_hash TEXT NOT NULL,
            key_prefix TEXT NOT NULL,
            permissions JSONB NOT NULL DEFAULT '["read"]',
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_used_at TIMESTAMP WITH TIME ZONE,
            revoked_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN DEFAULT TRUE
        );
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_account_id ON api_keys(account_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked_at ON api_keys(revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;

-- Create or update trigger for updated_at
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();