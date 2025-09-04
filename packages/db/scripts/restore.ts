import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

interface RestoreOptions {
  backupDir: string;
  skipTables?: string[];
  onlyTables?: string[];
  organizationId?: string;
  dryRun?: boolean;
  skipConflicts?: boolean;
}

class DatabaseRestore {
  private client: Client;
  private options: RestoreOptions;

  constructor(options: RestoreOptions) {
    this.client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    this.options = options;
  }

  async restore(): Promise<void> {
    try {
      await this.client.connect();
      console.log('✅ Connected to database for restore');

      // Verify backup directory and metadata
      const backupInfo = await this.loadBackupInfo();
      console.log(`📦 Restoring backup from: ${backupInfo.timestamp}`);
      console.log(`📋 Tables to restore: ${Object.keys(backupInfo.tables).join(', ')}`);

      if (this.options.dryRun) {
        console.log('🔍 DRY RUN MODE - No data will be modified');
      }

      // Disable foreign key checks during restore
      if (!this.options.dryRun) {
        await this.client.query('SET session_replication_role = replica');
        console.log('⚠️  Temporarily disabled foreign key constraints');
      }

      // Restore tables in correct order (referential integrity)
      const tables = this.getRestoreOrder(Object.keys(backupInfo.tables));

      for (const table of tables) {
        if (this.shouldSkipTable(table)) {
          console.log(`⏭️  Skipping table: ${table}`);
          continue;
        }

        await this.restoreTable(table, backupInfo.tables[table]);
      }

      // Re-enable foreign key checks
      if (!this.options.dryRun) {
        await this.client.query('SET session_replication_role = DEFAULT');
        console.log('✅ Re-enabled foreign key constraints');

        // Update sequences to prevent ID conflicts
        await this.updateSequences();
      }

      console.log('🎉 Restore completed successfully');

    } catch (error) {
      console.error('💥 Restore failed:', error);
      
      // Try to re-enable foreign key constraints on error
      try {
        await this.client.query('SET session_replication_role = DEFAULT');
      } catch (fkError) {
        console.error('⚠️  Failed to re-enable foreign key constraints:', fkError);
      }
      
      throw error;
    } finally {
      await this.client.end();
    }
  }

  private async loadBackupInfo(): Promise<any> {
    const metadataFile = path.join(this.options.backupDir, 'backup-info.json');
    try {
      const content = await fs.readFile(metadataFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load backup metadata: ${error}`);
    }
  }

  private shouldSkipTable(table: string): boolean {
    if (this.options.onlyTables && !this.options.onlyTables.includes(table)) {
      return true;
    }
    if (this.options.skipTables && this.options.skipTables.includes(table)) {
      return true;
    }
    return false;
  }

  private getRestoreOrder(tables: string[]): string[] {
    // Define restore order to respect foreign key constraints
    const orderedTables = [
      'accounts',
      'users',
      'devices', 
      'geofences',
      'integrations',
      'automations',
      'events',
      'automation_executions'
    ];

    // Return tables in correct order, only including tables that exist in backup
    return orderedTables.filter(table => tables.includes(table))
      .concat(tables.filter(table => !orderedTables.includes(table)));
  }

  private async restoreTable(table: string, tableInfo: any): Promise<void> {
    console.log(`🔄 Restoring table: ${table} (${tableInfo.rowCount} rows)`);

    // Load table data
    const dataFile = path.join(this.options.backupDir, `${table}.json`);
    let data: any[];
    
    try {
      const content = await fs.readFile(dataFile, 'utf-8');
      data = JSON.parse(content);
    } catch (error) {
      console.log(`  ⚠️  No data file found for table ${table}, skipping`);
      return;
    }

    if (data.length === 0) {
      console.log(`  ℹ️  Table ${table} has no data to restore`);
      return;
    }

    // Filter by organization if specified
    if (this.options.organizationId && this.hasAccountColumn(table)) {
      data = data.filter(row => row.account_id === this.options.organizationId);
      console.log(`  🔍 Filtered to organization: ${data.length} rows`);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const row of data) {
      if (this.options.dryRun) {
        console.log(`  🔍 Would restore row with ID: ${row.id}`);
        continue;
      }

      try {
        const columns = Object.keys(row).filter(key => row[key] !== null);
        const values = columns.map(key => row[key]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

        // Try insert with conflict resolution
        const conflictAction = this.options.skipConflicts ? 'DO NOTHING' : 
          `DO UPDATE SET ${columns.filter(c => c !== 'id' && c !== 'created_at')
            .map(c => `${c} = EXCLUDED.${c}`).join(', ')}`;

        const query = `
          INSERT INTO ${table} (${columns.join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) ${conflictAction}
        `;

        const result = await this.client.query(query, values);
        
        if (result.rowCount && result.rowCount > 0) {
          insertedCount++;
        } else if (!this.options.skipConflicts) {
          updatedCount++;
        } else {
          skippedCount++;
        }

      } catch (error) {
        console.log(`  ⚠️  Failed to restore row ${row.id}:`, (error as Error).message);
        skippedCount++;
      }
    }

    console.log(`  ✅ Restored table ${table}: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`);
  }

  private hasAccountColumn(table: string): boolean {
    const orgTables = ['users', 'devices', 'geofences', 'integrations', 'automations', 'events', 'automation_executions'];
    return orgTables.includes(table);
  }

  private async updateSequences(): Promise<void> {
    console.log('🔢 Updating sequence values...');
    
    const sequences = [
      'users_id_seq',
      'accounts_id_seq', 
      'devices_id_seq',
      'geofences_id_seq',
      'integrations_id_seq',
      'automations_id_seq',
      'events_id_seq',
      'automation_executions_id_seq'
    ];

    for (const sequence of sequences) {
      try {
        const table = sequence.replace('_id_seq', '');
        const result = await this.client.query(`SELECT MAX(id) FROM ${table}`);
        const maxId = result.rows[0].max;
        
        if (maxId) {
          await this.client.query(`SELECT setval('${sequence}', ${maxId})`);
          console.log(`  ✅ Updated ${sequence} to ${maxId}`);
        }
      } catch (error) {
        console.log(`  ⚠️  Failed to update sequence ${sequence}:`, (error as Error).message);
      }
    }
  }
}

async function restoreFromBackup(options: RestoreOptions): Promise<void> {
  const restore = new DatabaseRestore(options);
  return await restore.restore();
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Database Restore Tool

Usage: npm run restore <backup-directory> [options]

Options:
  --skip-tables <tables>     Skip specific tables (comma-separated)
  --only-tables <tables>     Restore only specific tables (comma-separated)
  --organization <id>        Restore only specific organization data
  --dry-run                  Preview restore without making changes
  --skip-conflicts           Skip conflicting rows instead of updating
  --help                     Show this help message

Examples:
  npm run restore ./backups/backup-2024-01-15
  npm run restore ./backups/backup-2024-01-15 --dry-run
  npm run restore ./backups/backup-2024-01-15 --skip-tables events
  npm run restore ./backups/backup-2024-01-15 --only-tables users,devices
  npm run restore ./backups/backup-2024-01-15 --organization abc123
    `);
    process.exit(1);
  }

  const options: RestoreOptions = {
    backupDir: args[0]
  };
  
  // Parse command line arguments
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--skip-tables':
        options.skipTables = args[++i].split(',').map(t => t.trim());
        break;
      case '--only-tables':
        options.onlyTables = args[++i].split(',').map(t => t.trim());
        break;
      case '--organization':
        options.organizationId = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--skip-conflicts':
        options.skipConflicts = true;
        break;
      case '--help':
        process.exit(0);
    }
  }
  
  restoreFromBackup(options).catch(console.error);
}

export { DatabaseRestore, restoreFromBackup };
export type { RestoreOptions };