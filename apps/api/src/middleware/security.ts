import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { query } from '@geofence/db';
import { hashData } from '../utils/encryption.js';
import { urls } from '../config/index.js';

// Global rate limiting maps
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const apiKeyCounts = new Map<string, { count: number; resetTime: number }>();

/**
 * General rate limiting middleware
 */
export function rateLimit(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.ip || 'unknown';
    const now = Date.now();
    const windowData = requestCounts.get(identifier);

    if (!windowData || now > windowData.resetTime) {
      requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (windowData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((windowData.resetTime - now) / 1000)
      });
    }

    windowData.count++;
    next();
  };
}

/**
 * Security headers middleware using helmet
 */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow cross-origin requests for API
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  });
}

/**
 * API key authentication middleware for device/external access
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required'
      });
    }

    // Rate limiting for API key requests
    const keyHash = hashData(apiKey);
    const now = Date.now();
    const keyUsage = apiKeyCounts.get(keyHash);

    if (keyUsage && keyUsage.count > 1000 && now < keyUsage.resetTime) { // 1000 requests per hour
      return res.status(429).json({
        success: false,
        error: 'API key rate limit exceeded',
        retryAfter: Math.ceil((keyUsage.resetTime - now) / 1000)
      });
    }

    // Find API key in database
    const queryText = `
      SELECT ak.id, ak.account_id, ak.scopes, ak.is_active, ak.expires_at,
             o.name as organization_name
      FROM api_keys ak
      JOIN accounts o ON ak.account_id = o.id
      WHERE ak.key_hash = $1 AND ak.is_active = true
    `;

    const result = await query(queryText, [keyHash]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    const apiKeyData = result.rows[0];

    // Check if API key has expired
    if (apiKeyData.expires_at && new Date() > new Date(apiKeyData.expires_at)) {
      return res.status(401).json({
        success: false,
        error: 'API key expired'
      });
    }

    // Update rate limiting counter
    if (!keyUsage || now > keyUsage.resetTime) {
      apiKeyCounts.set(keyHash, { count: 1, resetTime: now + 60 * 60 * 1000 }); // 1 hour
    } else {
      keyUsage.count++;
    }

    // Update last used timestamp
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [apiKeyData.id]
    );

    // Add API key info to request
    req.apiKey = {
      id: apiKeyData.id,
      accountId: apiKeyData.account_id,
      scopes: apiKeyData.scopes || []
    };
    req.accountId = apiKeyData.account_id;

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * Check if API key has required scope
 */
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key authentication required'
      });
    }

    if (!req.apiKey.scopes.includes(scope) && !req.apiKey.scopes.includes('*')) {
      return res.status(403).json({
        success: false,
        error: `Required scope: ${scope}`
      });
    }

    next();
  };
}

/**
 * Block suspicious requests based on patterns
 */
export function blockSuspiciousRequests() {
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /\/etc\/passwd/,  // File access attempts
    /eval\(/,  // Code injection
  ];

  return (req: Request, res: Response, next: NextFunction) => {
    const url = req.url.toLowerCase();
    const body = JSON.stringify(req.body).toLowerCase();

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body)) {
        console.warn(`Suspicious request blocked: ${req.ip} - ${req.method} ${req.url}`);
        return res.status(400).json({
          success: false,
          error: 'Bad request'
        });
      }
    }

    next();
  };
}

/**
 * CORS middleware with security considerations
 */
export function secureCors() {
  const { ALLOWED_ORIGINS } = urls;

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Organization-ID');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400'); // 24 hours

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  };
}

/**
 * Request logging for security monitoring
 */
export function securityLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    // Log security-relevant events
    if (req.path.includes('auth') || req.headers['x-api-key']) {
      console.log(`Security: ${req.method} ${req.path} - ${req.ip} - ${req.headers['user-agent']}`);
    }

    res.on('finish', () => {
      const duration = Date.now() - start;

      // Log slow requests or error responses
      if (duration > 5000 || res.statusCode >= 400) {
        console.log(`Response: ${res.statusCode} - ${duration}ms - ${req.method} ${req.path} - ${req.ip}`);
      }
    });

    next();
  };
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        accountId: string;
        scopes: string[];
      };
    }
  }
}
