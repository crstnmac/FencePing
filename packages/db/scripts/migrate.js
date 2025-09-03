const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Get list of already executed migrations
    const executedResult = await client.query('SELECT filename FROM migrations ORDER BY id');
    const executedMigrations = new Set(executedResult.rows.map(row => row.filename));

    // Read migration files
    const migrationsDir = path.join(__dirname, '../src/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    for (const filename of migrationFiles) {
      if (executedMigrations.has(filename)) {
        console.log(`Skipping already executed migration: ${filename}`);
        continue;
      }

      console.log(`Executing migration: ${filename}`);
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`✓ Migration ${filename} executed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`✗ Migration ${filename} failed:`, error.message);
        throw error;
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };