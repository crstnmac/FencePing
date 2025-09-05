import { Client, PoolClient, Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Create a connection pool for efficient connection reuse
let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 15,
      min: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 15000,
      allowExitOnIdle: true,
      statement_timeout: 60000,
      query_timeout: 45000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Handle pool events
    pool.on('connect', (client: PoolClient) => {
      const poolStats = pool ? {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      } : {};
      console.log('🔗 New client connected to database', {
        poolStats,
        timestamp: new Date().toISOString()
      });
    });

    pool.on('error', (err: Error, client: PoolClient) => {
      console.error('❌ Unexpected error on idle client', err.message);
    });
  }

  return pool;
};

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

// Get a client from the pool
export const getDbClient = async (retries = 3): Promise<PoolClient> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const poolInstance = getPool();
      const client = await poolInstance.connect();
      return client;
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to get database client from pool (attempt ${attempt + 1}/${retries + 1}):`, err.message);

      if (attempt === retries) {
        console.error('Exhausted all retry attempts, resetting pool');
        if (pool) {
          await pool.end();
          pool = null;
        }
        throw new Error(`Unable to get database client after ${retries + 1} attempts: ${err.message}`);
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`Retrying database connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unexpected end of retry loop');
};

// Execute a query using a client from the pool
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await getDbClient();
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    // console.log('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error('Query error', { text: text.substring(0, 100), duration, error: err });
    throw err;
  } finally {
    client.release();
  }
};

// Execute a query with custom timeout
export const queryWithTimeout = async (text: string, params?: any[], timeoutMs: number = 30000): Promise<any> => {
  const client = await getDbClient();
  const start = Date.now();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const res = await client.query(text, params);
    await client.query('COMMIT');

    const duration = Date.now() - start;
    // console.log(`Executed query with ${timeoutMs}ms timeout`, { text: text.substring(0, 100), duration, rows: res.rowCount });

    await client.query('SET LOCAL statement_timeout = DEFAULT');
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    await client.query('ROLLBACK');
    console.error('Query with timeout error', { text: text.substring(0, 100), duration, timeout: timeoutMs, error: err });

    if (err && typeof err === 'object' && 'message' in err && 'code' in err) {
      const error = err as { message: string; code: string };
      if (error.message?.includes('statement timeout') || error.code === '57014') {
        throw new Error(`Query timeout after ${timeoutMs}ms: ${text.substring(0, 100)}...`);
      }
    }

    throw err;
  } finally {
    client.release();
  }
};

export async function connectAndQuery<T = any>(queryText: string, params?: any[]): Promise<T[]> {
  const result = await query(queryText, params);
  return result.rows;
}

export const connectDb = async (retries = 5): Promise<void> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | null = null;
    try {
      client = await getDbClient();
      await client.query('SELECT 1');
      console.log('Database client connection successful');
      client.release();
      return;
    } catch (error) {
      console.warn(`Database connection failed (attempt ${attempt + 1}/${retries + 1}):`, error);

      if (client) {
        client.release();
      }

      if (attempt === retries) {
        console.error('Failed to connect to database after all retries');
        throw new Error('Unable to establish database connection');
      }

      const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(`Retrying database connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export const disconnectDb = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed successfully');
  }
};

export const healthCheckDb = async (): Promise<{ healthy: boolean; message: string; latency?: number }> => {
  const startTime = Date.now();
  try {
    const poolInstance = getPool();
    const client = await poolInstance.connect();

    await client.query('SELECT 1 as health_check');
    client.release();

    const latency = Date.now() - startTime;
    return {
      healthy: true,
      message: 'Database connection is healthy',
      latency
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const err = error as Error;
    console.error('Database health check failed:', err.message);

    return {
      healthy: false,
      message: `Database health check failed: ${err.message}`,
      latency
    };
  }
};