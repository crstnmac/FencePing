-- Fix geofences table schema to match API expectations
-- Migration: 002_fix_geofences_schema.sql

-- Step 1: Add missing description column
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS description TEXT;

-- Step 2: Add updated_at column if it doesn't exist
ALTER TABLE geofences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 3: Rename columns to match API expectations
DO $$
BEGIN
    -- Rename geometry column from geom to geometry if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'geofences' AND column_name = 'geom') THEN
        ALTER TABLE geofences RENAME COLUMN geom TO geometry;
    END IF;
    
    -- Rename type column to geofence_type if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'geofences' AND column_name = 'type') THEN
        ALTER TABLE geofences RENAME COLUMN type TO geofence_type;
    END IF;
    
    -- Rename properties column to metadata if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'geofences' AND column_name = 'properties') THEN
        ALTER TABLE geofences RENAME COLUMN properties TO metadata;
    END IF;
    
    -- Rename active column to is_active if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'geofences' AND column_name = 'active') THEN
        ALTER TABLE geofences RENAME COLUMN active TO is_active;
    END IF;
END $$;

-- Step 4: Update indexes after column renames
DROP INDEX IF EXISTS idx_geofences_geom_gix;
CREATE INDEX IF NOT EXISTS idx_geofences_geometry_gix ON geofences USING GIST (geometry);

DROP INDEX IF EXISTS idx_geofences_active;
CREATE INDEX IF NOT EXISTS idx_geofences_is_active ON geofences (is_active) WHERE is_active = true;

DROP INDEX IF EXISTS idx_geofences_account_active;
CREATE INDEX IF NOT EXISTS idx_geofences_account_is_active ON geofences (account_id, is_active) WHERE is_active = true;

-- Step 5: Update constraints that reference old column names
ALTER TABLE geofences DROP CONSTRAINT IF EXISTS geofences_radius_check;
ALTER TABLE geofences ADD CONSTRAINT geofences_radius_check CHECK (
    (geofence_type = 'circle' AND radius_m IS NOT NULL) OR 
    (geofence_type IN ('polygon') AND radius_m IS NULL)
);

-- Step 6: Create trigger to update updated_at column
DROP TRIGGER IF EXISTS update_geofences_updated_at ON geofences;
CREATE TRIGGER update_geofences_updated_at
    BEFORE UPDATE ON geofences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Update default values to match API expectations
ALTER TABLE geofences ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE geofences ALTER COLUMN metadata SET DEFAULT '{}';