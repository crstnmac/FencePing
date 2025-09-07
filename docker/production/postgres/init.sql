-- Initialize PostGIS extension and geofence database
-- This script runs once when the database container is first created

-- Create PostGIS extension if not exists
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create basic schema structure for geofence application
-- Note: Full schema will be created by migration scripts

-- Create a health check function
CREATE OR REPLACE FUNCTION health_check() RETURNS text AS $$
BEGIN
    RETURN 'Database is healthy at ' || NOW()::text;
END;
$$ LANGUAGE plpgsql;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostGIS extensions installed successfully';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'User: %', current_user;
    RAISE NOTICE 'PostGIS Version: %', postgis_version();
END $$;