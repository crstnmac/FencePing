import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMigration(name: string) {
  if (!name) {
    console.error('❌ Please provide a migration name');
    console.log('Usage: npm run migrate:create <migration-name>');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
  const migrationsDir = path.join(__dirname, '../src/migrations');
  const filepath = path.join(migrationsDir, filename);

  // Ensure migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );
`;

  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const migrationName = process.argv[2];
  createMigration(migrationName);
}

export { createMigration };