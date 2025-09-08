import { Router } from 'express';
import { z } from 'zod';
import { query as dbQuery } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { compareSync, hashSync } from 'bcryptjs';

const router = Router();

const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional()
});

const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
});

const OrganizationUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  timezone: z.string().optional(),
  date_format: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).optional(),
  time_format: z.enum(['12', '24']).optional(),
  distance_unit: z.enum(['metric', 'imperial']).optional(),
  location_retention_days: z.number().min(1).max(3650).optional(),
  event_retention_days: z.number().min(1).max(3650).optional(),
  default_map_region: z.enum(['auto', 'us', 'eu', 'asia', 'global']).optional(),
  coordinate_format: z.enum(['decimal', 'dms']).optional()
});

const NotificationUpdateSchema = z.object({
  emailGeofenceEvents: z.boolean().optional(),
  emailAutomationFailures: z.boolean().optional(),
  emailWeeklyReports: z.boolean().optional(),
  pushGeofenceEvents: z.boolean().optional(),
  pushAutomationFailures: z.boolean().optional()
});

// Profile routes
router.get('/profile', requireAuth, requireAccount, async (req, res) => {
  try {
    const userId = req.user!.id;

    const queryText = `
      SELECT
        u.id, u.name, u.email, u.phone, u.created_at, u.last_login_at,
        u.notification_preferences
      FROM users u
      WHERE u.id = $1
    `;

    const result = await dbQuery(queryText, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];
    const notificationPreferences = user.notification_preferences || {};

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        notification_preferences: notificationPreferences,
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.put('/profile', requireAuth, requireAccount, validateBody(ProfileUpdateSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const updates = req.body;

    // Check if email is being changed and validate uniqueness
    if (updates.email) {
      const existingUserQuery = 'SELECT id FROM users WHERE email = $1 AND id != $2';
      const existingUser = await dbQuery(existingUserQuery, [updates.email, userId]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Email already in use'
        });
      }
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (updates.name) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }

    if (updates.email) {
      updateFields.push(`email = $${paramCount++}`);
      values.push(updates.email);
    }

    if (updates.phone !== undefined) {
      updateFields.push(`phone = $${paramCount++}`);
      values.push(updates.phone || null);
    }

    values.push(userId);

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    updateFields.push('updated_at = NOW()');
    const queryText = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, phone, updated_at
    `;

    const result = await dbQuery(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.post('/profile/password', requireAuth, requireAccount, validateBody(PasswordChangeSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "New passwords don't match"
      });
    }

    // Get current password hash
    const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
    const userResult = await dbQuery(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const currentHash = userResult.rows[0].password_hash;

    if (!compareSync(currentPassword, currentHash)) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = process.env.NODE_ENV === 'production' ? 14 : 12;
    const newHash = hashSync(newPassword, saltRounds);

    // Update password
    const updateQuery = 'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id';
    const updateResult = await dbQuery(updateQuery, [newHash, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Failed to update password'
      });
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Organization routes
router.get('/organization', requireAuth, requireAccount, async (req, res) => {
  try {
    const userId = req.user!.id;

    const queryText = `
      SELECT
        a.id, a.name, a.settings
      FROM accounts a
      WHERE a.owner_id = $1
    `;

    const result = await dbQuery(queryText, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    const org = result.rows[0];
    let settings: any = {};
    try {
      settings = typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings || {};
    } catch (e) {
      settings = {};
    }

    res.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        timezone: settings.timezone || 'UTC',
        date_format: settings.date_format || 'MM/DD/YYYY',
        time_format: settings.time_format || '12',
        distance_unit: settings.distance_unit || 'metric',
        location_retention_days: settings.location_retention_days || 30,
        event_retention_days: settings.event_retention_days || 90,
        default_map_region: settings.default_map_region || 'auto',
        coordinate_format: settings.coordinate_format || 'decimal'
      }
    });
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.put('/organization', requireAuth, requireAccount, validateBody(OrganizationUpdateSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const accountId = req.accountId!;
    const updates = req.body;

    // Build settings object
    const settings: any = {};
    if (updates.timezone) settings.timezone = updates.timezone;
    if (updates.date_format) settings.date_format = updates.date_format;
    if (updates.time_format) settings.time_format = updates.time_format;
    if (updates.distance_unit) settings.distance_unit = updates.distance_unit;
    if (updates.location_retention_days !== undefined) settings.location_retention_days = updates.location_retention_days;
    if (updates.event_retention_days !== undefined) settings.event_retention_days = updates.event_retention_days;
    if (updates.default_map_region) settings.default_map_region = updates.default_map_region;
    if (updates.coordinate_format) settings.coordinate_format = updates.coordinate_format;

    let nameParam = null;
    let nameIndex = 1;
    if (updates.name) {
      nameParam = `$${nameIndex++}`;
    }

    const settingsJson = `$${nameIndex++}::jsonb`;

    const setClause = nameParam ? `name = ${nameParam}, settings = ${settingsJson}` : `settings = ${settingsJson}`;

    const queryText = `
      UPDATE accounts 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $${nameIndex++}
      RETURNING id, name, settings
    `;

    const values = [];
    if (updates.name) values.push(updates.name);
    values.push(JSON.stringify(settings), accountId);

    const result = await dbQuery(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    res.json({
      success: true,
      data: {
        organization: result.rows[0]
      },
      message: 'Organization updated successfully'
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Notifications routes
router.put('/notifications', requireAuth, requireAccount, validateBody(NotificationUpdateSchema), async (req, res) => {
  try {
    const userId = req.user!.id;
    const preferences = req.body;

    const queryText = `
      UPDATE users 
      SET notification_preferences = $1::jsonb, updated_at = NOW()
      WHERE id = $2
      RETURNING notification_preferences
    `;

    const result = await dbQuery(queryText, [preferences, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0].notification_preferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Sessions routes
router.get('/sessions', requireAuth, requireAccount, async (req, res) => {
  try {
    const userId = req.user!.id;
    const currentSessionId = req.user!.sessionId;

    const queryText = `
      SELECT 
        id,
        ip_address,
        user_agent,
        created_at,
        last_activity_at,
        expires_at,
        revoked_at
      FROM user_sessions 
      WHERE user_id = $1 AND revoked_at IS NULL
      ORDER BY last_activity_at DESC NULLS LAST
    `;

    const result = await dbQuery(queryText, [userId]);

    const sessions = result.rows.map((session: any) => ({
      ...session,
      isCurrent: session.id === currentSessionId
    }));

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.delete('/sessions/:sessionId', requireAuth, requireAccount, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;

    // Prevent revoking current session
    if (sessionId === req.user!.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot revoke current session'
      });
    }

    const queryText = `
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id
    `;

    const result = await dbQuery(queryText, [sessionId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already revoked'
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

router.post('/sessions/revoke-all', requireAuth, requireAccount, async (req, res) => {
  try {
    const userId = req.user!.id;
    const currentSessionId = req.user!.sessionId;

    const queryText = `
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL
      RETURNING id
    `;

    const result = await dbQuery(queryText, [userId, currentSessionId]);

    res.json({
      success: true,
      message: `Revoked ${result.rows.length} sessions successfully`,
      data: { revoked_count: result.rows.length }
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as settingsRoutes };
