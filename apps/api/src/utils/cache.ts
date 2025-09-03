import Redis from 'ioredis';
import { config } from '../config/index.js';

let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    redisClient.on('error', (err: any) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis client connected');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis client ready');
    });

    redisClient.on('close', () => {
      console.log('🛑 Redis client disconnected');
    });
  }
  return redisClient;
};

export const connectRedis = async (): Promise<void> => {
  const client = getRedisClient();
  if (!client.status || client.status === 'close') {
    await client.connect();
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient && redisClient.status === 'ready') {
    await redisClient.quit();
    redisClient = null;
  }
};

// Cache utility functions
export class Cache {
  private static instance: Cache;
  private client: Redis;

  private constructor() {
    this.client = getRedisClient();
  }

  public static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  // Set a key-value pair with optional TTL (in seconds)
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      console.error('Cache set error:', error);
      // Don't throw - cache failures shouldn't break the app
    }
  }

  // Get a value by key
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Delete a key
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Set multiple key-value pairs
  async mset(data: Record<string, any>): Promise<void> {
    try {
      const serializedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        serializedData[key] = JSON.stringify(value);
      }
      await this.client.mset(serializedData);
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  // Get multiple values
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(keys);
      return values.map((value: string | null) => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Set expiration time for a key
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  // Get TTL for a key
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('Cache ttl error:', error);
      return -1;
    }
  }

  // Clear all cache
  async flushAll(): Promise<void> {
    try {
      await this.client.flushall();
    } catch (error) {
      console.error('Cache flushAll error:', error);
    }
  }

  // Cache with automatic key generation
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const data = await fetcher();
      await this.set(key, data, ttl);
      return data;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // Fallback to fetcher if cache fails
      return await fetcher();
    }
  }
}

// Export singleton instance
export const cache = Cache.getInstance();

// Cache key generators
export const CacheKeys = {
  // Device cache keys
  device: (id: string) => `device:${id}`,
  devicesByAccount: (accountId: string) => `devices:account:${accountId}`,
  deviceCount: (accountId: string) => `device_count:account:${accountId}`,

  // User cache keys
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email}`,

  // Geofence cache keys
  geofence: (id: string) => `geofence:${id}`,
  geofencesByAccount: (accountId: string) => `geofences:account:${accountId}`,
  activeGeofencesByAccount: (accountId: string) => `geofences:active:account:${accountId}`,

  // Account cache keys
  account: (id: string) => `account:${id}`,

  // Automation cache keys
  automation: (id: string) => `automation:${id}`,
  automationsByAccount: (accountId: string) => `automations:account:${accountId}`,
  enabledAutomationsByAccount: (accountId: string) => `automations:enabled:account:${accountId}`,
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 5 * 60,     // 5 minutes
  MEDIUM: 15 * 60,   // 15 minutes
  LONG: 60 * 60,     // 1 hour
  DAY: 24 * 60 * 60, // 1 day
};
