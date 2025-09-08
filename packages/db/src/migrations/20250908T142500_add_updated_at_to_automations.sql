-- Add updated_at column to automations table
-- Migration: 20250908T142500_add_updated_at_to_automations.sql

-- Add updated_at column to automations table
ALTER TABLE automations 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to set updated_at = created_at
UPDATE automations 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Add trigger to automatically update updated_at on record changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automations table
CREATE TRIGGER update_automations_updated_at 
    BEFORE UPDATE ON automations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();