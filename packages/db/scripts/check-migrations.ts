import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function checkMigrations() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  try {
    const result = await client.query('SELECT * FROM migrations ORDER BY id');
    console.log('Executed migrations:');
    console.table(result.rows);
  } catch (e: any) {
    console.log('Migrations table does not exist:', e.message);
  }
  
  await client.end();
}

checkMigrations().catch(console.error);