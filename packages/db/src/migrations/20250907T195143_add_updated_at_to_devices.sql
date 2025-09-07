-- Add updated_at column to devices table
ALTER TABLE devices ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
