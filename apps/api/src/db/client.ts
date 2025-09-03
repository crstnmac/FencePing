import { Client } from 'pg';
import { database, config } from '../config/index.js';

// Helper function to create a new Client with configuration
export const createDbClient = (): Client => {
  const client = new Client({
    connectionString: database.DATABASE_URL,
    // Connection timeouts - optimized for timeout handling
    connectionTimeoutMillis: 15000, // Connection timeout
    statement_timeout: 60000, // Increased query timeout for complex operations
    query_timeout: 45000, // Additional query timeout
    // Explicitly set SSL to false for local development
    ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  return client;
};

// Get a connected client (use for transactions)
export const getDbClient = async (retries = 2): Promise<Client> => {
  const client = createDbClient();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await client.connect();
      return client;
    } catch (error) {
      console.warn(`Failed to get database client (attempt ${attempt + 1}):`, error);
      if (attempt === retries) {
        console.error('All connection attempts exhausted');
        await client.end();
        throw error;
      }
      // Wait briefly before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Unable to connect to database');
};

// Execute a query using a single client connection (preferred for single queries)
export const query = async (text: string, params?: any[]): Promise<any> => {
  const client = createDbClient();
  const start = Date.now();
  try {
    await client.connect();
    const res = await client.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error('Query error', { text, duration, error: err });
    throw err;
  } finally {
    await client.end();
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
    await client.end();
  }
};

export const connectDb = async (retries = 5): Promise<void> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const client = createDbClient();
    try {
      // Test the connection with a timeout
      await client.connect();
      await client.query('SELECT 1'); // Simple health check
      console.log('Database client connection successful');
      await client.end();
      return;
    } catch (error) {
      console.warn(`Database connection failed (attempt ${attempt + 1}/${retries + 1}):`, error);
      await client.end();
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
  // No global pool to close - individual client connections are closed when done
  console.log('Database client usage updated - no global pool to close');
};
