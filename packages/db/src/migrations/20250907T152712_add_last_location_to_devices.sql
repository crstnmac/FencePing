-- Migration: add_last_location_to_devices
-- Created: 2025-09-07T15:27:12.991Z

-- Add your migration SQL here

ALTER TABLE devices ADD COLUMN last_location geometry(Point, 4326);
