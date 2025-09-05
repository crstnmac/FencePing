import { Request, Response, NextFunction } from 'express';
import { query } from '@geofence/db';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore: RateLimitStore = {};

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}

// Clean up expired entries every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Generic rate limiting middleware
 */
export const rateLimit = (config: RateLimitConfig) => {
  const {
    windowMs,
    max,
    keyGenerator = (req: Request) => req.ip,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Clean up expired entries occasionally
    if (Math.random() < 0.01) {
      cleanupExpiredEntries();
    }

    // Get or create rate limit entry
    if (!rateLimitStore[key] || rateLimitStore[key]?.resetTime < now) {
      rateLimitStore[key] = {
        count: 0,
        resetTime
      };
    }

    const entry = rateLimitStore[key]!;

    // Check if limit exceeded
    if (entry.count >= max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }

    // Track response to conditionally increment counter
    const originalSend = res.send;
    let responseSent = false;

    res.send = function(data: any) {
      if (!responseSent) {
        responseSent = true;
        const shouldSkip = 
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (!shouldSkip) {
          entry.count++;
        }
      }
      return originalSend.call(this, data);
    };

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': Math.max(0, max - entry.count - 1).toString(),
      'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
    });

    next();
  };
};

/**
 * Device-specific rate limiting based on device ID
 */
export const deviceRateLimit = (config: Omit<RateLimitConfig, 'keyGenerator'>) => {
  return rateLimit({
    ...config,
    keyGenerator: (req: Request) => {
      // Use device ID from params or authenticated device
      const deviceId = req.params.deviceId || (req as any).device?.id || req.ip;
      return `device:${deviceId}`;
    }
  });
};

/**
 * Account-based rate limiting
 */
export const accountRateLimit = (config: Omit<RateLimitConfig, 'keyGenerator'>) => {
  return rateLimit({
    ...config,
    keyGenerator: (req: Request) => {
      const accountId = (req as any).accountId || req.ip;
      return `account:${accountId}`;
    }
  });
};

/**
 * Database-backed rate limiting for persistent limits
 */
interface DatabaseRateLimitConfig extends RateLimitConfig {
  tableName?: string;
}

export const databaseRateLimit = (config: DatabaseRateLimitConfig) => {
  const {
    windowMs,
    max,
    keyGenerator = (req: Request) => req.ip,
    tableName = 'rate_limit_log'
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const now = new Date();
      const windowStart = new Date(now.getTime() - windowMs);

      // Clean up old entries (optional optimization)
      if (Math.random() < 0.01) {
        await query(
          `DELETE FROM ${tableName} WHERE created_at < NOW() - INTERVAL '1 hour'`
        );
      }

      // Count recent requests
      const countResult = await query(
        `SELECT COUNT(*) as count FROM ${tableName} 
         WHERE key = $1 AND created_at > $2`,
        [key, windowStart.toISOString()]
      );

      const currentCount = parseInt(countResult.rows[0].count);

      if (currentCount >= max) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      // Log this request
      await query(
        `INSERT INTO ${tableName} (key, created_at) VALUES ($1, NOW())`,
        [key]
      );

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': Math.max(0, max - currentCount - 1).toString(),
        'X-RateLimit-Reset': Math.ceil((now.getTime() + windowMs) / 1000).toString()
      });

      next();
    } catch (error) {
      console.error('Database rate limiting error:', error);
      // On error, allow request to proceed (fail open)
      next();
    }
  };
};

// Predefined rate limiting configurations
export const rateLimitPresets = {
  // Very strict - for sensitive operations
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 requests per 15 minutes
  },
  
  // Moderate - for API endpoints
  moderate: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per 15 minutes
  },
  
  // Lenient - for high-frequency operations like location updates
  locationUpdates: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute (1 per second)
    skipFailedRequests: true // Don't count failed requests
  },
  
  // Device commands
  deviceCommands: {
    windowMs: 60 * 1000, // 1 minute
    max: 10 // 10 commands per minute
  },
  
  // Pairing requests
  pairing: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3 // 3 pairing attempts per 5 minutes
  }
};