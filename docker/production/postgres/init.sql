-- Initialize PostGIS extension and geofence database
-- This script runs once when the database container is first created

-- Create PostGIS extension if not exists
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create the geofence user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'geofence') THEN
        CREATE USER geofence WITH PASSWORD 'geofence_dev_password';
        RAISE NOTICE 'Created user: geofence';
    ELSE
        RAISE NOTICE 'User geofence already exists';
    END IF;
END $$;

-- Grant necessary permissions to the geofence user
GRANT ALL PRIVILEGES ON DATABASE geofence TO geofence;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO geofence;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO geofence;
GRANT USAGE ON SCHEMA public TO geofence;

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
    RAISE NOTICE 'Geofence user setup completed';
END $$;