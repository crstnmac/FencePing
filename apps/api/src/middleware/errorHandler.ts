import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  error: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  console.error(`Error ${statusCode}: ${message}`, error.stack);

  res.status(statusCode).json({
    error: {
      message,
      code: error.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
};