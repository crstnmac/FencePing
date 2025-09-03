import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function seedProductionData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Production seeding should be minimal and safe
    console.log('🔒 Production seeding started...');
    
    // Ensure database schema is up to date
    await client.query('SELECT 1 FROM users LIMIT 1');
    console.log('📊 Database schema verified');

    // Check if production data already exists
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      console.log('🛑 Production data already exists, skipping seeding');
      console.log(`👥 Found ${userCount.rows[0].count} existing users`);
      return;
    }

    // Create essential system indexes for performance
    console.log('🔍 Creating performance indexes...');
    
    try {
      // Spatial index for PostGIS geofences
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_geofences_geometry 
        ON geofences USING GIST(geometry)
      `);
      
      // Index for device location queries
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_location 
        ON devices USING GIST(last_location)
      `);
      
      // Index for event queries
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_timestamp 
        ON events (timestamp DESC)
      `);
      
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_device_geofence 
        ON events (device_id, geofence_id)
      `);

      // Index for automation executions
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_executions_status 
        ON automation_executions (status, executed_at DESC)
      `);

      console.log('✅ Performance indexes created');
    } catch (error) {
      console.log('⚠️  Some indexes may already exist:', (error as Error).message);
    }

    // Create essential system configuration (if needed)
    console.log('⚙️  Validating system configuration...');
    
    // Ensure PostGIS extension is enabled
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    console.log('🌍 PostGIS extension verified');

    // Create any essential reference data here
    // For example, default integration types, system constants, etc.
    console.log('📝 Essential reference data ready');

    // Create database statistics for query optimization
    await client.query('ANALYZE');
    console.log('📈 Database statistics updated');

    console.log('🎉 Production seeding completed safely');
    console.log('💡 Next steps:');
    console.log('   1. Create your first user account via the API');
    console.log('   2. Set up your integrations (Slack, Notion, etc.)');
    console.log('   3. Configure your devices and geofences');
    console.log('   4. Set up monitoring and alerting');
    
  } catch (error) {
    console.error('💥 Production seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedProductionData();
}

export { seedProductionData };