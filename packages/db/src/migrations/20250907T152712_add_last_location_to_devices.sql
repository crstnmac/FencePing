-- Migration: add_last_location_to_devices
-- Created: 2025-09-07T15:27:12.991Z

-- Add last_location column to devices table
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_location geometry(Point, 4326);

-- Create spatial index for last_location
CREATE INDEX IF NOT EXISTS idx_devices_last_location_gix ON devices USING GIST (last_location);
