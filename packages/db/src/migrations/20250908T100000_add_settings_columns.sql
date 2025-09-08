-- Add settings columns for users and accounts
-- Note: phone column already exists in users table from init script, but with VARCHAR(20) type
-- Update phone column type if needed
DO $$
BEGIN
    -- Check if phone column exists and update type if different
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'phone' AND data_type = 'character varying') THEN
        ALTER TABLE users ALTER COLUMN phone TYPE TEXT;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone TEXT;
    END IF;
    
    -- notification_preferences already exists in init script, ensure it has proper default
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' AND column_name = 'notification_preferences') THEN
        -- Update default value for existing column
        ALTER TABLE users ALTER COLUMN notification_preferences SET DEFAULT '{}';
    ELSE
        ALTER TABLE users ADD COLUMN notification_preferences JSONB DEFAULT '{}';
    END IF;
END $$;

-- Add settings column to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';