import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '@geofence/db';
import { auth } from '../config/index.js';

const JWT_SECRET = auth.JWT_SECRET;

export interface JWTPayload {
  userId: string;
  email: string;
  accountId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      // Check if session exists and is not revoked
      const sessionQuery = `
        SELECT id, revoked_at, expires_at
        FROM user_sessions 
        WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL
      `;
      const sessionResult = await query(sessionQuery, [tokenHash, decoded.userId]);
      
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Session not found or revoked'
        });
      }

      const session = sessionResult.rows[0];
      
      // Check if session has expired
      if (new Date() > new Date(session.expires_at)) {
        await query(
          'UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1',
          [session.id]
        );
        return res.status(401).json({
          success: false,
          error: 'Session expired'
        });
      }

      // Check if user account is locked
      const userQuery = `
        SELECT locked_until FROM users WHERE id = $1
      `;
      const userResult = await query(userQuery, [decoded.userId]);
      
      if (userResult.rows.length > 0 && userResult.rows[0].locked_until) {
        if (new Date() < new Date(userResult.rows[0].locked_until)) {
          return res.status(401).json({
            success: false,
            error: 'Account temporarily locked'
          });
        }
      }

      // Add user info to request object
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        accountId: decoded.accountId,
        sessionId: session.id
      };

      req.accountId = decoded.accountId;
      // Note: accountId should be set separately when accounts are implemented
      
      next();
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      // Check session validity (same as requireAuth but non-blocking)
      const sessionQuery = `
        SELECT id, revoked_at, expires_at
        FROM user_sessions 
        WHERE token_hash = $1 AND user_id = $2 AND revoked_at IS NULL
      `;
      const sessionResult = await query(sessionQuery, [tokenHash, decoded.userId]);
      
      if (sessionResult.rows.length > 0) {
        const session = sessionResult.rows[0];
        
        if (new Date() <= new Date(session.expires_at)) {
          req.user = {
            id: decoded.userId,
            email: decoded.email,
            accountId: decoded.accountId,
            sessionId: session.id
          };
          req.accountId = decoded.accountId;
          // Note: accountId should be set separately when accounts are implemented
        }
      }
    } catch (jwtError) {
      // Invalid token, continue without user info
    }
    
    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next();
  }
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
      accountId?: string;
    }
  }
}
