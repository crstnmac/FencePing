import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { validateBody, requireOrganization } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';
import { generateApiKey, hashData } from '../utils/encryption.js';

const router = Router();

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional().default([]),
  expires_in_days: z.number().min(1).max(365).optional()
});

const UpdateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  scopes: z.array(z.string()).optional(),
  is_active: z.boolean().optional()
});

// List API keys for organization
router.get('/', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const organizationId = req.organizationId!;
    
    const query = `
      SELECT 
        id,
        name,
        scopes,
        last_used_at,
        expires_at,
        is_active,
        created_at,
        updated_at
      FROM api_keys 
      WHERE organization_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await client.query(query, [organizationId]);
    
    res.json({
      success: true,
      data: {
        apiKeys: result.rows.map(key => ({
          ...key,
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
// Create new API key
router.post('/', requireAuth, requireOrganization, validateBody(CreateApiKeySchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const organizationId = req.organizationId!;
    const { name, scopes, expires_in_days } = req.body;
    
    // Generate API key
    const { key, hash } = generateApiKey();
    
    // Calculate expiration date
    let expiresAt = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }
    
    // Available scopes for validation
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
    
    // Validate scopes
    const invalidScopes = scopes.filter((scope: string) => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid scopes: ${invalidScopes.join(', ')}`
      });
    }
    
    // Only organization owners can create keys with full access
    if (scopes.includes('*')) {
      // Additional check would be needed here for owner role
      // For now, we'll allow it if they have access to the organization
    }
    
    const query = `
      INSERT INTO api_keys (name, organization_id, key_hash, scopes, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, scopes, expires_at, created_at
    `;
    
    const result = await client.query(query, [
      name,
      organizationId,
      hash,
      scopes,
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
router.patch('/:keyId', requireAuth, requireOrganization, validateBody(UpdateApiKeySchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const organizationId = req.organizationId!;
    const { keyId } = req.params;
    const updates = req.body;
    
    // Validate scopes if provided
    if (updates.scopes) {
      const validScopes = [
        'devices:read', 'devices:write',
        'events:read', 'events:write',
        'geofences:read', 'geofences:write',
        'integrations:read',
        'automations:read',
        '*'
      ];
      
      const invalidScopes = updates.scopes.filter((scope: string) => !validScopes.includes(scope));
      if (invalidScopes.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid scopes: ${invalidScopes.join(', ')}`
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
    
    if (updates.scopes) {
      updateFields.push(`scopes = $${paramCount++}`);
      values.push(updates.scopes);
    }
    
    if (updates.is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(keyId, organizationId);
    
    const query = `
      UPDATE api_keys 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND organization_id = $${paramCount}
      RETURNING id, name, scopes, is_active, updated_at
    `;
    
    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        apiKey: result.rows[0]
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

// Delete API key
// Delete API key
router.delete('/:keyId', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const organizationId = req.organizationId!;
    const { keyId } = req.params;
    
    const query = `
      DELETE FROM api_keys 
      WHERE id = $1 AND organization_id = $2
      RETURNING id, name
    `;
    
    const result = await client.query(query, [keyId, organizationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    res.json({
      success: true,
      message: `API key '${result.rows[0].name}' deleted successfully`
    });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get API key usage statistics
// Get API key usage statistics
router.get('/:keyId/usage', requireAuth, requireOrganization, async (req, res) => {
  try {
    const client = await getDbClient();
    const organizationId = req.organizationId!;
    const { keyId } = req.params;
    
    const query = `
      SELECT 
        ak.id,
        ak.name,
        ak.last_used_at,
        ak.created_at,
        COUNT(DISTINCT DATE(e.timestamp)) as days_used,
        COUNT(e.id) as total_requests
      FROM api_keys ak
      LEFT JOIN events e ON e.metadata->>'api_key_id' = ak.id
      WHERE ak.id = $1 AND ak.organization_id = $2
      GROUP BY ak.id, ak.name, ak.last_used_at, ak.created_at
    `;
    
    const result = await client.query(query, [keyId, organizationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        usage: result.rows[0]
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
