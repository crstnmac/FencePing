import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Warning for production
    if (process.env.NODE_ENV === 'production') {
      console.error('🚫 Database reset is not allowed in production!');
      process.exit(1);
    }

    console.log('⚠️  This will DROP ALL TABLES and DATA!');
    console.log('🔄 Resetting database...');

    // Drop all tables (adjust based on your actual schema)
    await client.query('DROP SCHEMA public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    
    // Grant permissions
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    
    console.log('🗑️  All tables dropped');
    console.log('✨ Database reset completed');
    console.log('📝 Run migrations to recreate schema: npm run migrate');

  } catch (error) {
    console.error('💥 Database reset failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase();
}

export { resetDatabase };