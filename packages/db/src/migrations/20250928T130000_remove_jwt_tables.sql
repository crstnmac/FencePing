-- Remove JWT-related tables and columns for better-auth migration

-- Drop JWT-related tables
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS user_sessions;