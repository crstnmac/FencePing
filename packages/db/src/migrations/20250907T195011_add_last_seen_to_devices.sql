-- Add last_seen column to devices table
ALTER TABLE devices ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW();
