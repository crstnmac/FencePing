-- Add settings columns for users and accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';