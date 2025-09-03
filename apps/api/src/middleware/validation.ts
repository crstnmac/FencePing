import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid request data'
      });
    }
  };
};

export const validateQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters'
      });
    }
  };
};

export const requireOrganization = (req: Request, res: Response, next: NextFunction) => {
  // Account ID must come from authenticated user (set by auth middleware)
  if (req.accountId && req.user) {
    return next();
  }

  // No authenticated user or account ID
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Organization access denied.'
  });
};

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      accountId?: string;
    }
  }
}
