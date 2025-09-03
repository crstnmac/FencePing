-- Add missing password_hash column to users table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
        ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '';
    END IF;
END $$;

-- Add constraint to ensure non-empty password hash for new users (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='check_password_hash_not_empty') THEN
        ALTER TABLE users ADD CONSTRAINT check_password_hash_not_empty CHECK (password_hash <> '');
    END IF;
END $$;

-- Add indexes for improved performance (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_users_email') THEN
        CREATE INDEX idx_users_email ON users (email);
    END IF;
END $$;

-- Add unique constraint on integration type per organization (if not exists)
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS unique_org_integration_type;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='unique_org_integration_type') THEN
        ALTER TABLE integrations ADD CONSTRAINT unique_org_integration_type UNIQUE (organization_id, type);
    END IF;
END $$;

-- Add audit columns to critical tables for security tracking (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login_at') THEN
        ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='login_attempts') THEN
        ALTER TABLE users ADD COLUMN login_attempts INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='locked_until') THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Add security metadata to integrations for OAuth token encryption (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='integrations' AND column_name='security_metadata') THEN
        ALTER TABLE integrations ADD COLUMN security_metadata JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add session management table for JWT token blacklisting (if not exists)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for user_sessions (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_user_sessions_user_id') THEN
        CREATE INDEX idx_user_sessions_user_id ON user_sessions (user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_user_sessions_token_hash') THEN
        CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_user_sessions_expires_at') THEN
        CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_user_sessions_revoked_at') THEN
        CREATE INDEX idx_user_sessions_revoked_at ON user_sessions (revoked_at);
    END IF;
END $$;

-- Add API key management for device authentication (if not exists)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for api_keys (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_api_keys_organization_id') THEN
        CREATE INDEX idx_api_keys_organization_id ON api_keys (organization_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_api_keys_key_hash') THEN
        CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_api_keys_is_active') THEN
        CREATE INDEX idx_api_keys_is_active ON api_keys (is_active);
    END IF;
END $$;