-- Drop existing constraint
ALTER TABLE devices DROP CONSTRAINT devices_connection_type_check;

-- Add new constraint with wifi
ALTER TABLE devices ADD CONSTRAINT devices_connection_type_check CHECK (connection_type IN ('mqtt', 'websocket', 'http', 'bluetooth', 'wifi'));
