import { Router } from 'express';
import { z } from 'zod';
import { query } from '@geofence/db';
import { validateQuery, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const AnalyticsQuerySchema = z.object({
  range: z.enum(['24h', '7d', '30d', '90d']).default('7d')
});

// Get analytics data for dashboard
router.get('/', requireAuth, requireAccount, validateQuery(AnalyticsQuerySchema), async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const { range } = req.query as any;

    // For development, get the first available organization if no auth
    let accountId = req.accountId;

    if (!accountId) {
      const orgResult = await query('SELECT id FROM accounts ORDER BY created_at LIMIT 1');
      if (orgResult.rows.length > 0) {
        accountId = orgResult.rows[0].id;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No organization found'
        });
      }
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
    }

    // Device activity over time
    const deviceActivityQuery = `
      WITH date_series AS (
        SELECT generate_series($2::timestamp, $3::timestamp, '1 day'::interval) AS day
      ),
      daily_activity AS (
        SELECT 
          date_trunc('day', d.last_heartbeat) as day,
          COUNT(CASE WHEN d.status = 'online' THEN 1 END) as online,
          COUNT(CASE WHEN d.status = 'offline' THEN 1 END) as offline,
          COUNT(*) as total
        FROM devices d
        WHERE d.account_id = $1 
        AND d.last_heartbeat >= $2
        GROUP BY date_trunc('day', d.last_heartbeat)
      )
      SELECT 
        ds.day::date as date,
        COALESCE(da.online, 0) as online,
        COALESCE(da.offline, 0) as offline,
        COALESCE(da.total, 0) as total
      FROM date_series ds
      LEFT JOIN daily_activity da ON ds.day = da.day
      ORDER BY ds.day
    `;

    // Automation performance stats - simplified to avoid enum issues
    const automationStatsQuery = `
      SELECT 
        a.name,
        COUNT(ar.id) as total_rules,
        COUNT(CASE WHEN a.enabled = true THEN 1 END) as active_rules,
        COUNT(CASE WHEN a.created_at >= $2 THEN 1 END) as recent_automations,
        0 as success_count,
        0 as failed_count,
        0 as success_rate
      FROM automations a
      LEFT JOIN automation_rules ar ON ar.automation_id = a.id
      WHERE a.account_id = $1
      GROUP BY a.id, a.name, a.enabled
      HAVING COUNT(ar.id) > 0
      ORDER BY total_rules DESC
      LIMIT 10
    `;

    // Trend calculations (compare with previous period)
    const prevStartDate = new Date(startDate);
    const timeDiff = now.getTime() - startDate.getTime();
    prevStartDate.setTime(startDate.getTime() - timeDiff);

    const trendsQuery = `
      SELECT 
        'events' as metric,
        COUNT(CASE WHEN ge.ts >= $2 AND ge.ts < $3 THEN 1 END) as current_count,
        COUNT(CASE WHEN ge.ts >= $4 AND ge.ts < $2 THEN 1 END) as previous_count
      FROM geofence_events ge
      JOIN devices d ON ge.device_id = d.id
      WHERE d.account_id = $1
      
      UNION ALL
      
      SELECT 
        'devices' as metric,
        COUNT(CASE WHEN dev.created_at >= $2 AND dev.created_at < $3 THEN 1 END) as current_count,
        COUNT(CASE WHEN dev.created_at >= $4 AND dev.created_at < $2 THEN 1 END) as previous_count
      FROM devices dev
      WHERE dev.account_id = $1
      
      UNION ALL
      
      SELECT 
        'automations' as metric,
        COUNT(CASE WHEN auto.created_at >= $2 AND auto.created_at < $3 THEN 1 END) as current_count,
        COUNT(CASE WHEN auto.created_at >= $4 AND auto.created_at < $2 THEN 1 END) as previous_count
      FROM automations auto
      WHERE auto.account_id = $1
    `;

    const [deviceActivityResult, automationStatsResult, trendsResult] = await Promise.all([
      query(deviceActivityQuery, [accountId, startDate, now]),
      query(automationStatsQuery, [accountId, startDate]),
      query(trendsQuery, [accountId, startDate, now, prevStartDate])
    ]);

    // Process trends
    const trends: any = {};
    trendsResult.rows.forEach((row: any) => {
      const current = parseInt(row.current_count) || 0;
      const previous = parseInt(row.previous_count) || 0;

      let trendPercent = 0;
      if (previous > 0) {
        trendPercent = ((current - previous) / previous * 100);
      } else if (current > 0) {
        trendPercent = 100;
      }

      const sign = trendPercent >= 0 ? '+' : '';
      trends[`${row.metric}Trend`] = `${sign}${trendPercent.toFixed(1)}%`;
    });

    // Format device activity
    const deviceActivity = deviceActivityResult.rows.map((row: any) => ({
      date: row.date,
      online: parseInt(row.online),
      offline: parseInt(row.offline)
    }));

    // Format automation stats
    const automationStats = automationStatsResult.rows.map((row: any) => ({
      name: row.name,
      success: parseFloat(row.success_rate) || 0,
      failed: 100 - (parseFloat(row.success_rate) || 0),
      total: parseInt(row.total)
    }));

    res.json({
      success: true,
      data: {
        deviceActivity,
        automationStats,
        ...trends
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as analyticsRoutes };