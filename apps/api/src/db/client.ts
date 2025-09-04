import { Client, PoolClient, Pool } from 'pg';
import { database, config } from '../config/index.js';

// Create a connection pool for efficient connection reuse
let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: database.DATABASE_URL,
      max: 15, // Reduced max connections for better reuse
      min: 5, // Increased min connections for better availability
      idleTimeoutMillis: 60000, // Increased to 1 minute for better connection reuse
      connectionTimeoutMillis: 15000, // Reduced to 15 seconds for faster failure detection
      allowExitOnIdle: true,
      statement_timeout: 60000, // Query timeout
      query_timeout: 45000,
      keepAlive: true, // Enable TCP keep-alive
      keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10 seconds
      ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    // Handle pool events with improved logging
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

    pool.on('remove', (client: PoolClient) => {
      const poolStats = pool ? {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      } : {};
      console.log('📤 Client released from pool', {
        poolStats,
        timestamp: new Date().toISOString()
      });
    });

    // Add pool acquisition logging
    pool.on('acquire', (client: PoolClient) => {
      const poolStats = pool ? {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      } : {};
      if (pool && pool.waitingCount > 2) { // Log when connections are waiting
        console.log('⏳ Client acquired from pool (queue detected)', {
          poolStats,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  return pool;
};

// Helper function to get a client from the pool
export const createDbClient = async (): Promise<PoolClient> => {
  const poolInstance = getPool();
  return await poolInstance.connect();
};

// Get a connected client (use for transactions) with retry logic
export const getDbClient = async (retries = 3): Promise<PoolClient> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const client = await createDbClient();
      return client;
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to get database client from pool (attempt ${attempt + 1}/${retries + 1}):`, err.message);

      // Only reset pool on the last attempt to avoid unnecessary pool destruction
      if (attempt === retries) {
        console.error('Exhausted all retry attempts, resetting pool');
        if (pool) {
          await pool.end();
          pool = null;
        }
        throw new Error(`Unable to get database client after ${retries + 1} attempts: ${err.message}`);
      }

      // Wait before retry (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
      console.log(`Retrying database connection in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript requires it
  throw new Error('Unexpected end of retry loop');
};

// Execute a query using a client from the pool (preferred for single queries)
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = await getDbClient();
  const start = Date.now();
  try {
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error('Query error', { text, duration, error: err });
    throw err;
  } finally {
    // Return client to pool instead of ending connection
    client.release();
  }
};

// Execute a query with custom timeout (useful for device operations that might take longer)
export const queryWithTimeout = async (text: string, params?: any[], timeoutMs: number = 30000): Promise<any> => {
  const client = await getDbClient();
  const start = Date.now();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = ${timeoutMs}`);
    const res = await client.query(text, params);
    await client.query('COMMIT');

    const duration = Date.now() - start;
    console.log(`Executed query with ${timeoutMs}ms timeout`, { text, duration, rows: res.rowCount });

    // Reset statement timeout to default
    await client.query('SET LOCAL statement_timeout = DEFAULT');

    return res;
  } catch (err) {
    const duration = Date.now() - start;
    await client.query('ROLLBACK');
    console.error('Query with timeout error', { text, duration, timeout: timeoutMs, error: err });

    // Check if error is due to timeout
    if (err && typeof err === 'object' && 'message' in err && 'code' in err) {
      const error = err as { message: string; code: string };
      if (error.message?.includes('statement timeout') || error.code === '57014') {
        throw new Error(`Query timeout after ${timeoutMs}ms: ${text.substring(0, 100)}...`);
      }
    }

    throw err;
  } finally {
    // Return client to pool
    client.release();
  }
};

export const connectDb = async (retries = 5): Promise<void> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | null = null;
    try {
      client = await createDbClient();
      await client.query('SELECT 1'); // Simple health check
      console.log('Database client connection successful');

      // Return client to pool (don't end permanent clients)
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

      // Exponential backoff with jitter
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

// Health check function for database connectivity
export const healthCheckDb = async (): Promise<{ healthy: boolean; message: string; latency?: number }> => {
  const startTime = Date.now();
  try {
    const poolInstance = getPool();
    const client = await poolInstance.connect();

    // Simple query to test connectivity
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
