-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create initial database user with necessary permissions
GRANT ALL PRIVILEGES ON DATABASE geofence TO geofence_user;
GRANT ALL ON SCHEMA public TO geofence_user;

-- Set up initial spatial reference systems if needed
-- Most common: WGS84 (SRID 4326) is already included by default

-- Topics to create in Kafka/Redpanda:
-- raw_events - MQTT location data after validation
-- gf_events - Geofence enter/exit/dwell events  
-- automations - Automation trigger events
-- dlq - Dead letter queue for failed messages