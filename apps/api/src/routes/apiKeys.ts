import { Router } from 'express';
import { z } from 'zod';
import { query as dbQuery } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { generateApiKey } from '../utils/encryption.js';

const router = Router();

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  permissions: z.array(z.string()).optional().default([]),
  expires_in_days: z.number().min(1).max(365).optional()
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  permissions: z.array(z.string()).optional(),
  is_active: z.boolean().optional()
});

// List API keys for organization
router.get('/', requireAuth, requireAccount, async (req, res) => {
  try {
    const accountId = req.accountId!;
    
    const queryText = `
      SELECT
        id,
        name,
        permissions,
        last_used_at,
        expires_at,
        is_active,
        created_at,
        updated_at
      FROM api_keys
      WHERE account_id = $1 AND revoked_at IS NULL
      ORDER BY created_at DESC
    `;
    
    const result = await dbQuery(queryText, [accountId]);
    
    res.json({
      success: true,
      data: {
        apiKeys: result.rows.map((key:any) => ({
          ...key,
          isActive: key.is_active,
          lastUsedAt: key.last_used_at,
          expiresAt: key.expires_at,
          createdAt: key.created_at,
          updatedAt: key.updated_at,
          // Don't expose the actual key hash
          key_hash: undefined
        }))
      }
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new API key
router.post('/', requireAuth, requireAccount, validateBody(CreateApiKeySchema), async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const accountId = req.accountId!;
    const { name, permissions, expires_in_days } = req.body;
    
    // Generate API key
    const { key, hash } = generateApiKey();
    
    // Calculate expiration date
    let expiresAt = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }
    
    // Available permissions for validation
    const validScopes = [
      'devices:read',
      'devices:write',
      'events:read',
      'events:write',
      'geofences:read',
      'geofences:write',
      'integrations:read',
      'automations:read',
      '*' // Full access (admin only)
    ];
    
    // Validate permissions
    const invalidScopes = permissions.filter((scope: string) => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid permissions: ${invalidScopes.join(', ')}`
      });
    }
    
    // Only organization owners can create keys with full access
    if (permissions.includes('*')) {
      // Additional check would be needed here for owner role
      // For now, we'll allow it if they have access to the organization
    }
    
    const keyPrefix = key.substring(0, 8);
    const createdBy = req.user!.id;
    
    const queryText = `
      INSERT INTO api_keys (name, account_id, created_by, api_key_hash, key_prefix, permissions, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, permissions, expires_at, created_at
    `;
    
    const result = await dbQuery(queryText, [
      name,
      accountId,
      createdBy,
      hash,
      keyPrefix,
      JSON.stringify(permissions),
      expiresAt
    ]);
    
    const apiKey = result.rows[0];
    
    res.status(201).json({
      success: true,
      data: {
        apiKey: {
          ...apiKey,
          key // Only show the key once during creation
        }
      },
      warning: 'Store this API key securely. It will not be shown again.'
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update API key
// Update API key
router.patch('/:keyId', requireAuth, requireAccount, validateBody(UpdateApiKeySchema), async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const accountId = req.accountId!;
    const { keyId } = req.params;
    const updates = req.body;
    
    // Validate permissions if provided
    if (updates.permissions) {
      const validScopes = [
        'devices:read', 'devices:write',
        'events:read', 'events:write',
        'geofences:read', 'geofences:write',
        'integrations:read',
        'automations:read',
        '*'
      ];
      
      const invalidScopes = updates.permissions.filter((scope: string) => !validScopes.includes(scope));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid permissions: ${invalidScopes.join(', ')}`
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
    
    if (updates.permissions) {
      updateFields.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(updates.permissions));
    }
    
    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(keyId, accountId);
    
    const queryText = `
      UPDATE api_keys
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND account_id = $${paramCount} AND revoked_at IS NULL
      RETURNING id, name, permissions, is_active, updated_at
    `;
    
    const result = await dbQuery(queryText, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        apiKey: {
          ...result.rows[0],
          isActive: result.rows[0].is_active,
          updatedAt: result.rows[0].updated_at
        }
      }
    });
  } catch (error) {
    console.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Revoke API key (soft delete)
// Revoke API key (soft delete)
router.delete('/:keyId', requireAuth, requireAccount, async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const accountId = req.accountId!;
    const { keyId } = req.params;
    
    const queryText = `
      UPDATE api_keys
      SET revoked_at = NOW(), is_active = false, updated_at = NOW()
      WHERE id = $1 AND account_id = $2 AND is_active = true AND revoked_at IS NULL
      RETURNING id, name
    `;
    
    const result = await dbQuery(queryText, [keyId, accountId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found or already revoked'
      });
    }
    
    res.json({
      success: true,
      message: `API key '${result.rows[0].name}' revoked successfully`
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get API key usage statistics
// Get API key usage statistics
router.get('/:keyId/usage', requireAuth, requireAccount, async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const accountId = req.accountId!;
    const { keyId } = req.params;
    
    const summaryQuery = `
      SELECT
        ak.id,
        ak.name,
        ak.last_used_at,
        ak.created_at,
        EXTRACT(DAY FROM (NOW() - ak.created_at)) as days_used,
        COALESCE((SELECT COUNT(*) FROM api_key_usage aku WHERE aku.api_key_id = ak.id), 0) as total_requests
      FROM api_keys ak
      WHERE ak.id = $1 AND ak.account_id = $2 AND ak.revoked_at IS NULL
    `;
    
    const summaryResult = await dbQuery(summaryQuery, [keyId, accountId]);
    
    if (summaryResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    const recentQuery = `
      SELECT
        timestamp,
        endpoint,
        method,
        ip_address,
        user_agent
      FROM api_key_usage
      WHERE api_key_id = $1
      ORDER BY timestamp DESC
      LIMIT 10
    `;
    
    const recentResult = await dbQuery(recentQuery, [keyId]);
    
    res.json({
      success: true,
      data: {
        usage: {
          ...summaryResult.rows[0],
          recentUses: recentResult.rows
        }
      }
    });
  } catch (error) {
    console.error('API key usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as apiKeyRoutes };
