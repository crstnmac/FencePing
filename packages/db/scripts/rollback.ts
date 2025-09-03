import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function rollbackMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get the last executed migration
    const lastMigrationResult = await client.query(
      'SELECT filename FROM migrations ORDER BY id DESC LIMIT 1'
    );

    if (lastMigrationResult.rows.length === 0) {
      console.log('📭 No migrations to rollback');
      return;
    }

    const lastMigration = lastMigrationResult.rows[0].filename;
    console.log(`🔄 Rolling back migration: ${lastMigration}`);

    // Remove the migration record
    await client.query('DELETE FROM migrations WHERE filename = $1', [lastMigration]);
    console.log(`✅ Rollback completed for: ${lastMigration}`);
    console.log('⚠️  Note: SQL changes are not automatically reverted. You may need to manually revert schema changes.');

  } catch (error) {
    console.error('💥 Rollback failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rollbackMigration();
}

export { rollbackMigration };