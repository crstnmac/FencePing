import { Router } from 'express';
import { z } from 'zod';
import { query } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const WebhookConfigSchema = z.object({
  automationId: z.string().uuid(),
  url: z.string().url(),
  headers: z.record(z.string()).optional()
});

/* Removed schemas for non-webhook integrations */





// Get all integrations for organization
router.get('/', requireAuth, requireAccount, async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const queryText = `
      SELECT
        id,
        name,
        kind as type,
        config,
        enabled as is_active,
        created_at,
        updated_at
      FROM automations
      WHERE account_id = $1 AND kind = 'webhook' AND config IS NOT NULL AND config != '{}'::jsonb
      ORDER BY created_at DESC
    `;

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

    const result = await query(queryText, [accountId]);

    const integrations = result.rows.map((integration: any) => ({
      id: integration.id,
      name: integration.name,
      url: integration.config?.url || '',
      is_active: integration.is_active,
      headers: integration.config?.headers || {},
      automation_id: integration.id,
      created_at: integration.created_at,
      updated_at: integration.updated_at,
      status: integration.is_active ? 'active' : 'inactive'
    }));

    res.json({
      success: true,
      data: integrations,
      total: integrations.length
    });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create or update webhook integration for automation
router.post('/webhook', requireAuth, requireAccount, validateBody(WebhookConfigSchema), async (req, res) => {
  try {
    const { automationId, url, headers } = req.body;
    const config = { url, ...(headers && { headers }) };

    // Check if automation exists
    const checkQuery = `
      SELECT id FROM automations WHERE id = $1 AND account_id = $2
    `;
    const checkResult = await query(checkQuery, [automationId, req.accountId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Automation not found'
      });
    }

    const updateQuery = `
      UPDATE automations
      SET kind = 'webhook', config = $1::jsonb, updated_at = NOW()
      WHERE id = $2 AND account_id = $3
      RETURNING id, name, kind, config, enabled, created_at
    `;
    const result = await query(updateQuery, [JSON.stringify(config), automationId, req.accountId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Failed to update webhook'
      });
    }

    const updated = result.rows[0];
    res.json({
      success: true,
      data: {
        ...updated,
        webhookUrl: updated.config.url
      }
    });
  } catch (error) {
    console.error('Error creating/updating webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new integration
router.post('/', requireAuth, requireAccount, validateBody(WebhookConfigSchema), async (req, res) => {
  try {
    const { automationId, url, headers } = req.body;
    const config = { url, ...(headers && { headers }) };

    // Check if automation exists
    const checkQuery = `
      SELECT id FROM automations WHERE id = $1 AND account_id = $2
    `;
    const checkResult = await query(checkQuery, [automationId, req.accountId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Automation not found'
      });
    }

    const updateQuery = `
      UPDATE automations
      SET kind = 'webhook', config = $1::jsonb, updated_at = NOW()
      WHERE id = $2 AND account_id = $3
      RETURNING id, name, kind, config, enabled, created_at, updated_at
    `;
    const result = await query(updateQuery, [JSON.stringify(config), automationId, req.accountId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Failed to create integration'
      });
    }

    const updated = result.rows[0];
    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        url: updated.config.url,
        is_active: updated.enabled,
        headers: updated.config.headers || {},
        automation_id: updated.id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        status: updated.enabled ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error creating integration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get specific integration
router.get('/:integrationId', requireAuth, requireAccount, async (req, res) => {
  try {
    const queryText = `
      SELECT id, name, kind, config, enabled, created_at, updated_at
      FROM automations
      WHERE id = $1 AND account_id = $2 AND kind = 'webhook'
    `;
    const result = await query(queryText, [req.params.integrationId, req.accountId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    const integration = result.rows[0];
    res.json({
      success: true,
      data: {
        id: integration.id,
        name: integration.name,
        url: integration.config?.url || '',
        is_active: integration.enabled,
        headers: integration.config?.headers || {},
        automation_id: integration.id,
        created_at: integration.created_at,
        updated_at: integration.updated_at,
        status: integration.enabled ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error fetching integration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update integration
router.put('/:integrationId', requireAuth, requireAccount, async (req, res) => {
  try {
    const { url, headers, is_active } = req.body;
    const config = { url, ...(headers && { headers }) };

    const updateQuery = `
      UPDATE automations
      SET config = $1::jsonb, enabled = $2, updated_at = NOW()
      WHERE id = $3 AND account_id = $4 AND kind = 'webhook'
      RETURNING id, name, kind, config, enabled, created_at, updated_at
    `;
    const result = await query(updateQuery, [JSON.stringify(config), is_active, req.params.integrationId, req.accountId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    const updated = result.rows[0];
    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        url: updated.config.url,
        is_active: updated.enabled,
        headers: updated.config.headers || {},
        automation_id: updated.id,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
        status: updated.enabled ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


// Delete integration
router.delete('/:integrationId', requireAuth, requireAccount, async (req, res) => {
  try {
    // Check if automation is used in any rules
    const usageQuery = `
      SELECT COUNT(*) as rule_count
      FROM automation_rules
      WHERE automation_id = $1 AND account_id = $2
    `;
    const usageResult = await query(usageQuery, [req.params.integrationId, req.accountId]);
    const ruleCount = parseInt(usageResult.rows[0]?.rule_count || '0');

    if (ruleCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete integration. Automation is used by ${ruleCount} rule(s).`,
        details: {
          rule_count: ruleCount
        }
      });
    }

    const queryText = `
      UPDATE automations
      SET kind = null, config = '{}'::jsonb, updated_at = NOW()
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;
    const result = await query(queryText, [req.params.integrationId, req.accountId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    res.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Test integration
/* Removed test endpoint for integrations */

// Get integration types and their schemas
router.get('/types/schemas', async (_req, res) => {
  const schemas = {
    webhook: {
      name: 'Webhook',
      description: 'Send HTTP POST requests to webhook endpoints for automations',
      config_fields: [
        { name: 'url', type: 'url', required: true, description: 'Webhook URL' },
        { name: 'headers', type: 'object', required: false, description: 'Custom HTTP headers' }
      ],
      credential_fields: []
    }
  };

  res.json({
    success: true,
    data: schemas
  });
});

export { router as integrationRoutes };
