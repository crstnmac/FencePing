import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function checkTables() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    const result = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables in database:');
    console.table(result.rows);
    
    // Check for specific tables we're interested in
    const tables = result.rows.map(row => row.table_name);
    console.log('\nChecking for specific tables:');
    console.log('device_groups:', tables.includes('device_groups') ? '✅' : '❌');
    console.log('device_tags:', tables.includes('device_tags') ? '✅' : '❌');
    console.log('device_commands:', tables.includes('device_commands') ? '✅' : '❌');
    console.log('rate_limiting:', tables.includes('rate_limiting') ? '✅' : '❌');
    
  } catch (e: any) {
    console.error('Error checking tables:', e.message);
  }
  
  await client.end();
}

checkTables().catch(console.error);