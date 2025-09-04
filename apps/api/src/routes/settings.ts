import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { hashSync, compareSync } from 'bcryptjs';
import { generateSecureToken } from '../utils/encryption.js';
import { config } from '../config/index.js';

const router = Router();

// Validation schemas
const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  timezone: z.string().optional(),
  phone: z.string().optional()
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128)
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  timezone: z.string(),
  date_format: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']),
  time_format: z.enum(['12', '24']),
  distance_unit: z.enum(['metric', 'imperial']),
  data_retention_days: z.number().min(30).max(2555) // ~7 years max
});

const NotificationPreferencesSchema = z.object({
  email_notifications: z.boolean(),
  push_notifications: z.boolean(),
  geofence_alerts: z.boolean(),
  automation_alerts: z.boolean(),
  weekly_reports: z.boolean(),
  system_updates: z.boolean()
});

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).min(1),
  expires_at: z.string().datetime().optional()
});

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  const client = await getDbClient();

  try {
    const userId = req.user!.id;

    const query = `
      SELECT
        u.id,
        u.name,
        u.email,
        u.timezone,
        u.phone,
        u.created_at,
        u.last_login_at,
        u.notification_preferences
      FROM users u
      WHERE u.id = $1
    `;

    const result = await client.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        timezone: user.timezone,
        phone: user.phone,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        notification_preferences: user.notification_preferences || {
          email_notifications: true,
          push_notifications: true,
          geofence_alerts: true,
          automation_alerts: true,
          weekly_reports: false,
          system_updates: true
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Update user profile
router.put('/profile', requireAuth, validateBody(UpdateProfileSchema), async (req, res) => {
  const client = await getDbClient();

  try {
    const userId = req.user!.id;
    const { name, email, timezone, phone } = req.body;

    // Check if email is already taken by another user
    if (email !== req.user!.email) {
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Email address is already in use'
        });
      }
    }

    const query = `
      UPDATE users
      SET name = $1, email = $2, timezone = $3, phone = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING id, name, email, timezone, phone, updated_at
    `;

    const result = await client.query(query, [name, email, timezone, phone, userId]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Change password
router.post('/profile/password', requireAuth, validateBody(ChangePasswordSchema), async (req, res) => {
  const client = await getDbClient();

  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const userQuery = await client.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    // Verify current password
    if (!compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = config.NODE_ENV === 'production' ? 14 : 12;
    const newPasswordHash = hashSync(newPassword, saltRounds);

    // Update password and revoke all sessions except current
    await client.query('BEGIN');

    try {
      // Update password
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Revoke all other sessions except current
      await client.query(
        'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id != $2',
        [userId, req.user!.sessionId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Password updated successfully. All other sessions have been revoked.'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
});

// Get organization settings
router.get('/organization', requireAuth, requireAccount, async (req, res) => {
  try {
    const client = await getDbClient();
    const accountId = req.accountId!;

    const query = `
      SELECT 
        o.id,
        o.name,
        o.timezone,
        o.date_format,
        o.time_format,
        o.distance_unit,
        o.data_retention_days,
        o.created_at,
        o.updated_at,
        COUNT(u.id) as member_count
      FROM accounts o
      LEFT JOIN users u ON u.id = o.owner_id
      WHERE o.id = $1
      GROUP BY o.id
    `;

    const result = await client.query(query, [accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Organization not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching organization settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update organization settings
router.put('/organization', requireAuth, requireAccount, validateBody(UpdateOrganizationSchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const accountId = req.accountId!;
    const { name, timezone, date_format, time_format, distance_unit, data_retention_days } = req.body;

    // Check if user is owner
    const ownerCheck = await client.query(
      'SELECT owner_id FROM accounts WHERE id = $1',
      [accountId]
    );

    if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].owner_id !== req.user!.id) {
      return res.status(403).json({
        success: false,
        error: 'Only organization owners can update settings'
      });
    }

    const query = `
      UPDATE accounts 
      SET 
        name = $1,
        timezone = $2,
        date_format = $3,
        time_format = $4,
        distance_unit = $5,
        data_retention_days = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;

    const result = await client.query(query, [
      name, timezone, date_format, time_format, distance_unit, data_retention_days, accountId
    ]);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating organization settings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update notification preferences
router.put('/notifications', requireAuth, validateBody(NotificationPreferencesSchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const userId = req.user!.id;
    const preferences = req.body;

    const query = `
      UPDATE users 
      SET notification_preferences = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING notification_preferences
    `;

    const result = await client.query(query, [JSON.stringify(preferences), userId]);

    res.json({
      success: true,
      data: result.rows[0].notification_preferences
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get API keys
router.get('/api-keys', requireAuth, requireAccount, async (req, res) => {
  try {
    const client = await getDbClient();
    const accountId = req.accountId!;

    const query = `
      SELECT 
        id,
        name,
        key_prefix,
        permissions,
        last_used_at,
        expires_at,
        created_at,
        is_active
      FROM api_keys
      WHERE account_id = $1 AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;

    const result = await client.query(query, [accountId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create API key
router.post('/api-keys', requireAuth, requireAccount, validateBody(CreateApiKeySchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const accountId = req.accountId!;
    const userId = req.user!.id;
    const { name, permissions, expires_at } = req.body;

    // Generate API key
    const apiKey = `gf_${generateSecureToken(32)}`;
    const keyPrefix = apiKey.substring(0, 12) + '...';

    const query = `
      INSERT INTO api_keys (
        account_id,
        created_by,
        name,
        api_key_hash,
        key_prefix,
        permissions,
        expires_at,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, key_prefix, permissions, expires_at, created_at, is_active
    `;

    // Hash the API key for storage
    const keyHash = hashSync(apiKey, 12);

    const result = await client.query(query, [
      accountId,
      userId,
      name,
      keyHash,
      keyPrefix,
      JSON.stringify(permissions),
      expires_at ? new Date(expires_at) : null,
      true
    ]);

    // Return the full API key only once
    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        api_key: apiKey // Only shown once during creation
      },
      message: 'API key created successfully. Make sure to copy it now as it won\'t be shown again.'
    });

  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Revoke API key
router.delete('/api-keys/:keyId', requireAuth, requireAccount, async (req, res) => {
  try {
    const client = await getDbClient();
    const accountId = req.accountId!;
    const { keyId } = req.params;

    const query = `
      UPDATE api_keys 
      SET revoked_at = NOW(), is_active = false
      WHERE id = $1 AND account_id = $2 AND revoked_at IS NULL
      RETURNING id
    `;

    const result = await client.query(query, [keyId, accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    res.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get active sessions
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const userId = req.user!.id;

    const query = `
      SELECT 
        id,
        ip_address,
        user_agent,
        created_at,
        expires_at,
        last_activity_at,
        CASE WHEN id = $2 THEN true ELSE false END as is_current
      FROM user_sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY last_activity_at DESC NULLS LAST, created_at DESC
    `;

    const result = await client.query(query, [userId, req.user!.sessionId]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Revoke session
router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const userId = req.user!.id;
    const { sessionId } = req.params;

    // Prevent revoking current session
    if (sessionId === req.user!.sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot revoke current session. Use logout instead.'
      });
    }

    const query = `
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
      RETURNING id
    `;

    const result = await client.query(query, [sessionId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Revoke all other sessions
router.post('/sessions/revoke-all', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const userId = req.user!.id;

    const query = `
      UPDATE user_sessions 
      SET revoked_at = NOW()
      WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL
      RETURNING count(*)
    `;

    const result = await client.query(query, [userId, req.user!.sessionId]);

    res.json({
      success: true,
      message: 'All other sessions revoked successfully'
    });

  } catch (error) {
    console.error('Error revoking all sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as settingsRoutes };
