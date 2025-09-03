import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

interface BackupOptions {
  includeEvents?: boolean;
  includeAutomationExecutions?: boolean;
  outputDir?: string;
  format?: 'json' | 'sql';
  organizationId?: string;
}

class DatabaseBackup {
  private client: Client;
  private options: BackupOptions;

  constructor(options: BackupOptions = {}) {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    this.options = {
      includeEvents: true,
      includeAutomationExecutions: false, // Large tables
      outputDir: path.join(__dirname, '../../../backups'),
      format: 'json',
      ...options
    };
  }

  async backup(): Promise<string> {
    try {
      await this.client.connect();
      console.log('✅ Connected to database for backup');

      // Create backup directory
      await fs.mkdir(this.options.outputDir!, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.options.outputDir!, `backup-${timestamp}`);
      await fs.mkdir(backupDir);

      console.log(`📦 Starting backup to: ${backupDir}`);

      // Core tables to backup (order matters for referential integrity)
      const tables = [
        'organizations',
        'users', 
        'devices',
        'geofences',
        'integrations',
        'automations',
        ...(this.options.includeEvents ? ['events'] : []),
        ...(this.options.includeAutomationExecutions ? ['automation_executions'] : [])
      ];

      const backupInfo: any = {
        timestamp: new Date().toISOString(),
        format: this.options.format,
        tables: {},
        organizationId: this.options.organizationId,
        version: '1.0.0'
      };

      for (const table of tables) {
        console.log(`📋 Backing up table: ${table}`);
        
        let query = `SELECT * FROM ${table}`;
        const params: any[] = [];

        // Filter by organization if specified
        if (this.options.organizationId && this.hasOrganizationColumn(table)) {
          query += ` WHERE organization_id = $1`;
          params.push(this.options.organizationId);
        }

        // Add ordering for consistent backups
        if (table === 'events') {
          query += ` ORDER BY timestamp DESC`;
        } else {
          query += ` ORDER BY created_at DESC`;
        }

        const result = await this.client.query(query, params);
        
        backupInfo.tables[table] = {
          rowCount: result.rows.length,
          columns: result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID }))
        };

        // Write table data
        const tableFile = path.join(backupDir, `${table}.json`);
        await fs.writeFile(tableFile, JSON.stringify(result.rows, null, 2));
        
        console.log(`  ✅ Backed up ${result.rows.length} rows`);
      }

      // Create backup metadata
      const metadataFile = path.join(backupDir, 'backup-info.json');
      await fs.writeFile(metadataFile, JSON.stringify(backupInfo, null, 2));

      // Create restore script
      const restoreScript = this.generateRestoreScript(backupInfo);
      const restoreFile = path.join(backupDir, 'restore.ts');
      await fs.writeFile(restoreFile, restoreScript);

      console.log('📄 Created backup metadata and restore script');
      console.log(`🎉 Backup completed successfully: ${backupDir}`);
      
      return backupDir;

    } catch (error) {
      console.error('💥 Backup failed:', error);
      throw error;
    } finally {
      await this.client.end();
    }
  }

  private hasOrganizationColumn(table: string): boolean {
    // Tables that have organization_id column for filtering
    const orgTables = ['users', 'devices', 'geofences', 'integrations', 'automations', 'events', 'automation_executions'];
    return orgTables.includes(table);
  }

  private generateRestoreScript(backupInfo: any): string {
    return `// Generated restore script
import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function restore() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to database for restore');
    
    // Backup created: ${backupInfo.timestamp}
    // Organization: ${backupInfo.organizationId || 'All'}
    // Tables: ${Object.keys(backupInfo.tables).join(', ')}
    
    const tables = ${JSON.stringify(Object.keys(backupInfo.tables))};
    
    for (const table of tables) {
      console.log(\`🔄 Restoring table: \${table}\`);
      
      const dataFile = path.join(__dirname, \`\${table}.json\`);
      const data = JSON.parse(await fs.readFile(dataFile, 'utf-8'));
      
      for (const row of data) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map((_, i) => \`$\${i + 1}\`).join(', ');
        
        const query = \`
          INSERT INTO \${table} (\${columns.join(', ')})
          VALUES (\${placeholders})
          ON CONFLICT (id) DO UPDATE SET
          \${columns.filter(c => c !== 'id').map(c => \`\${c} = EXCLUDED.\${c}\`).join(', ')}
        \`;
        
        await client.query(query, values);
      }
      
      console.log(\`  ✅ Restored \${data.length} rows\`);
    }
    
    console.log('🎉 Restore completed successfully');
    
  } catch (error) {
    console.error('💥 Restore failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  restore();
}

export { restore };
`;
  }
}

async function createBackup(options: BackupOptions = {}) {
  const backup = new DatabaseBackup(options);
  return await backup.backup();
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options: BackupOptions = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--no-events':
        options.includeEvents = false;
        break;
      case '--include-executions':
        options.includeAutomationExecutions = true;
        break;
      case '--organization':
        options.organizationId = args[++i];
        break;
      case '--output':
        options.outputDir = args[++i];
        break;
      case '--help':
        console.log(`
Database Backup Tool

Usage: npm run backup [options]

Options:
  --no-events            Skip events table (reduces backup size)
  --include-executions   Include automation executions (large table)
  --organization <id>    Backup only specific organization
  --output <dir>         Output directory for backup files
  --help                 Show this help message

Examples:
  npm run backup                              # Full backup
  npm run backup --no-events                 # Skip events
  npm run backup --organization abc123       # Organization only
  npm run backup --output ./my-backups       # Custom output directory
        `);
        process.exit(0);
    }
  }
  
  createBackup(options).catch(console.error);
}

export { DatabaseBackup, createBackup };
export type { BackupOptions };