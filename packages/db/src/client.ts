import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function createDbClient(): Client {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

export async function connectAndQuery<T = any>(queryText: string, params?: any[]): Promise<T[]> {
  const client = createDbClient();
  try {
    await client.connect();
    const result = await client.query(queryText, params);
    return result.rows;
  } finally {
    await client.end();
  }
}