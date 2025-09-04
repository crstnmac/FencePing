import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function fixMigrations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    // Mark migrations 001-009 as executed since the tables exist
    const executedMigrations = [
      '001_initial_schema.sql',
      '002_dead_letter_queue.sql', 
      '003_add_user_password.sql',
      '004_add_settings_tables.sql',
      '005_align_with_specifications.sql',
      '006_add_performance_indexes.sql',
      '20250903T191055_007_add_missing_tables.sql',
      '008_device_pairing_enhancements.sql',
      '009_add_device_fields.sql'
    ];

    console.log('Marking existing migrations as executed...');
    for (const filename of executedMigrations) {
      try {
        await client.query('INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [filename]);
        console.log(`✅ Marked ${filename} as executed`);
      } catch (error) {
        console.log(`⚠️  Could not mark ${filename}:`, error);
      }
    }

    console.log('\nCurrent migrations status:');
    const result = await client.query('SELECT filename, executed_at FROM migrations ORDER BY executed_at');
    console.table(result.rows);
    
  } catch (e: any) {
    console.error('Error fixing migrations:', e.message);
  }
  
  await client.end();
}

fixMigrations().catch(console.error);