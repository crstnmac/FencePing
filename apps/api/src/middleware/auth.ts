import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth as authConfig } from '../../auth.js';
import { ensureUserUUID, validateUUID } from '../utils/uuid.js';

export interface BetterAuthUser {
  id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  image?: string;
}

export interface BetterAuthSession {
  id: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface ApiKeyAuth {
  id: string;
  accountId: string;
  permissions: string[];
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify session with better-auth
    const session = await authConfig.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session || !session.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session',
      });
    }

    // Convert Better Auth user ID to UUID format for database compatibility
    const userUUID = ensureUserUUID(session.user.id);

    // Add user info to request object
    req.user = {
      id: userUUID,
      email: session.user.email,
      accountId: userUUID, // For now, use user UUID as account ID
      sessionId: session.session.id,
    };

    req.accountId = userUUID;

    next();
  } catch (error) {
    console.error('Better-auth session verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session',
    });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try to get session with better-auth (non-blocking)
    const session = await authConfig.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session && session.user) {
      // Convert Better Auth user ID to UUID format for database compatibility
      const userUUID = ensureUserUUID(session.user.id);

      req.user = {
        id: userUUID,
        email: session.user.email,
        accountId: userUUID,
        sessionId: session.session.id,
      };
      req.accountId = userUUID;
    }
  } catch (error) {
    // Invalid session, continue without user info
  }

  next();
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        accountId: string;
        sessionId: string;
      };
      apiKey?: ApiKeyAuth;
      accountId?: string;
    }
  }
}
