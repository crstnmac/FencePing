import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function seedDevelopmentData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    console.log('🌱 Seeding development data...');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');

    // Get all existing tables
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name NOT IN ('geography_columns', 'geometry_columns', 'spatial_ref_sys')
    `);
    const existingTables = tableCheck.rows.map(row => row.table_name);

    console.log(`📋 Found ${existingTables.length} tables:`, existingTables);

    // Truncate existing tables safely
    const tablesToSkip = ['geography_columns', 'geometry_columns', 'spatial_ref_sys'];
    const tablesToTruncate = existingTables.filter(table =>
      !tablesToSkip.includes(table) && !table.startsWith('pg_')
    );

    if (tablesToTruncate.length > 0) {
      console.log(`🔄 Truncating ${tablesToTruncate.length} tables`);
      await client.query(`TRUNCATE ${tablesToTruncate.join(', ')} RESTART IDENTITY CASCADE`);
    }

    // Create users
    console.log('👥 Creating users...');
    const userResult = await client.query(`
      INSERT INTO users (name, email, password_hash) VALUES
      ('John Doe', 'john@example.com', '$2b$10$dummy.hash.for.development.only'),
      ('Jane Smith', 'jane@example.com', '$2b$10$dummy.hash.for.development.only'),
      ('Alice Johnson', 'alice@example.com', '$2b$10$dummy.hash.for.development.only')
      RETURNING id, name, email
    `);
    const users = userResult.rows;
    console.log(`📊 Created ${users.length} users`);

    // Create accounts
    console.log('🏢 Creating accounts...');
    const orgResult = await client.query(`
      INSERT INTO accounts (name, owner_id) VALUES 
      ('Acme Corporation', $1),
      ('Beta Technologies', $2)
      RETURNING id, name, owner_id
    `, [users[0].id, users[1].id]);
    const accounts = orgResult.rows;
    console.log(`🏢 Created ${accounts.length} accounts`);

    // Create test geofences
    console.log('🗺️  Creating test geofences...');
    const geofenceResult = await client.query(`
      INSERT INTO geofences (name, description, account_id, geometry, geofence_type, metadata, radius_m) VALUES 
      ('Office Building', 'Main office building in San Francisco', $1, 
       ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.4194,37.7749],[-122.4184,37.7749],[-122.4184,37.7759],[-122.4194,37.7759],[-122.4194,37.7749]]]}'), 
       'polygon', '{}', NULL),
      ('Parking Lot', 'Employee parking area', $1,
       ST_Buffer(ST_SetSRID(ST_MakePoint(-122.4174, 37.7739), 4326)::geography, 50)::geometry,
       'circle', '{}', 50),
      ('Conference Center', 'Downtown conference facility', $2,
       ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.4094,37.7849],[-122.4074,37.7849],[-122.4074,37.7869],[-122.4094,37.7869],[-122.4094,37.7849]]]}'),
       'polygon', '{}', NULL)
      RETURNING id, name, geofence_type
    `, [accounts[0].id, accounts[1].id]);
    const geofences = geofenceResult.rows;
    console.log(`🗺️  Created ${geofences.length} geofences`);

    // Create test devices
    console.log('📱 Creating test devices...');
    const deviceResult = await client.query(`
      INSERT INTO devices (name, account_id, device_key, device_type, status, last_heartbeat, meta) VALUES 
      ('iPhone 15 Pro', $1, 'device_key_1', 'mobile', 'online', NOW(), 
       '{"longitude": -122.4194, "latitude": 37.7749, "accuracy": 5}'),
      ('Samsung Galaxy S24', $1, 'device_key_2', 'mobile', 'offline', NOW() - INTERVAL '1 hour',
       '{"longitude": -122.4174, "latitude": 37.7739, "accuracy": 8}'),
      ('GPS Tracker', $2, 'device_key_3', 'tracker', 'online', NOW(),
       '{"longitude": -122.4094, "latitude": 37.7849, "accuracy": 3}')
      RETURNING id, name, device_type, status
    `, [accounts[0].id, accounts[1].id]);
    const devices = deviceResult.rows;
    console.log(`📱 Created ${devices.length} devices`);

    // Summary
    console.log('\n🎉 Development seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🏢 Accounts: ${accounts.length}`);
    console.log(`   🗺️  Geofences: ${geofences.length}`);
    console.log(`   📱 Devices: ${devices.length}`);

    console.log('\n🧪 Accounts data available:');
    console.log('   • Test accounts with associated owners');
    console.log('   • Can now test events fetching with organization context');

  } catch (error) {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDevelopmentData();
}

export { seedDevelopmentData };
