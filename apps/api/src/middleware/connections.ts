import { Request, Response, NextFunction } from 'express';

interface ConnectionTracker {
  [key: string]: {
    acquired: Date;
    released?: Date;
    traceId: string;
  };
}

// Simple in-memory tracking for connection leaks (in production, use Redis/cache)
const connectionTracker: ConnectionTracker = {};

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = new Date();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  Object.keys(connectionTracker).forEach(traceId => {
    const connection = connectionTracker[traceId];
    if (!connection.released && (now.getTime() - connection.acquired.getTime()) > maxAge) {
      console.warn('⚠️ Potential connection leak detected', {
        traceId,
        acquiredAt: connection.acquired,
        durationMs: now.getTime() - connection.acquired.getTime(),
        route: traceId.split('_')[0],
        method: traceId.split('_')[0],
        path: traceId.split('_')[1],
        timestamp: now.toISOString()
      });
      delete connectionTracker[traceId];
    }
  });
}, 5 * 60 * 1000); // 5 minutes

export const trackConnectionUsage = (req: Request, res: Response, next: NextFunction) => {
  const traceId = `${req.method}_${req.path}_${Date.now()}_${Math.random()}`;
  res.locals.connectionTraceId = traceId;

  connectionTracker[traceId] = {
    acquired: new Date(),
    traceId
  };

  // Log when request completes
  res.on('finish', () => {
    if (connectionTracker[traceId]) {
      connectionTracker[traceId].released = new Date();
      const duration = connectionTracker[traceId].released.getTime() - connectionTracker[traceId].acquired.getTime();

      // Only log slow queries (>1 second)
      if (duration > 1000) {
        console.log('🐌 Slow database request detected', {
          traceId,
          method: req.method,
          path: req.path,
          durationMs: duration,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString()
        });
      }
    }
  });

  next();
};

// Admin endpoint to check connection pool status
export const getConnectionPoolStatus = async (req: Request, res: Response) => {
  try {
    const { getPool } = await import('@geofence/db');
    const pool = getPool();

    const stats = {
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingConnections: pool.waitingCount,
      poolSize: {
        min: 5, // Updated from config
        max: 15 // Updated from config
      },
      activeRequests: Object.keys(connectionTracker).filter(key =>
        !connectionTracker[key].released
      ).length,
      pendingTraces: Object.keys(connectionTracker).map(key => ({
        traceId: key,
        acquired: connectionTracker[key].acquired,
        released: connectionTracker[key].released,
        duration: connectionTracker[key].released
          ? connectionTracker[key].released.getTime() - connectionTracker[key].acquired.getTime()
          : Date.now() - connectionTracker[key].acquired.getTime()
      })).slice(0, 10) // Show last 10
    };

    // Warn if pool is near capacity (80% utilization)
    if (pool.totalCount >= 15 * 0.8) {
      console.warn('🚨 Database connection pool approaching capacity', {
        currentConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingConnections: pool.waitingCount,
        timestamp: new Date().toISOString()
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching pool status:', error);
    res.status(500).json({ error: 'Failed to fetch pool status' });
  }
};

// Cleanup function for graceful shutdown
export const cleanupConnectionTracker = () => {
  const activeConnections = Object.keys(connectionTracker).filter(key =>
    !connectionTracker[key].released
  );

  if (activeConnections.length > 0) {
    console.warn('🧹 Cleaning up active database connections', {
      count: activeConnections.length,
      traces: activeConnections
    });
  }

  Object.keys(connectionTracker).forEach(traceId => {
    delete connectionTracker[traceId];
  });
};
