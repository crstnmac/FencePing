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

    // Create organizations
    console.log('🏢 Creating organizations...');
    const orgResult = await client.query(`
      INSERT INTO organizations (name, owner_id) VALUES 
      ('Acme Corporation', $1),
      ('Beta Technologies', $2)
      RETURNING id, name, owner_id
    `, [users[0].id, users[1].id]);
    const organizations = orgResult.rows;
    console.log(`🏢 Created ${organizations.length} organizations`);

    // Summary
    console.log('\n🎉 Development seeding completed successfully!');
    console.log('📊 Summary:');
    console.log(`   👥 Users: ${users.length}`);
    console.log(`   🏢 Organizations: ${organizations.length}`);

    console.log('\n🧪 Organizations data available:');
    console.log('   • Test organizations with associated owners');
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
