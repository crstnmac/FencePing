import { Router } from 'express';
import { z } from 'zod';
import { query as dbQuery } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const CreateAutomationSchema = z.object({
  name: z.string().min(1).max(255),
  kind: z.enum(['notion', 'sheets', 'slack', 'webhook', 'whatsapp']),
  config: z.object({
    // Notion config
    database_id: z.string().optional(),
    properties: z.record(z.unknown()).optional(),
    // Slack config  
    channel: z.string().optional(),
    webhook_url: z.string().url().optional(),
    // Sheets config
    spreadsheet_id: z.string().optional(),
    range: z.string().optional(),
    // WhatsApp config
    phone_number: z.string().optional(),
    // Generic webhook config
    url: z.string().url().optional(),
    headers: z.record(z.string()).optional(),
    template: z.string().optional()
  }),
  enabled: z.boolean().default(true)
});

const CreateAutomationRuleSchema = z.object({
  name: z.string().min(1).max(255),
  geofence_id: z.string().uuid(),
  automation_id: z.string().uuid(),
  device_id: z.string().uuid().optional(),
  on_events: z.array(z.enum(['enter', 'exit', 'dwell'])).default(['enter']),
  min_dwell_seconds: z.number().int().min(0).default(0),
  device_filter: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true)
});

const UpdateAutomationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  kind: z.enum(['notion', 'sheets', 'slack', 'webhook', 'whatsapp']).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional()
});

const UpdateAutomationRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  geofence_id: z.string().uuid().optional(),
  device_id: z.string().uuid().optional(),
  on_events: z.array(z.enum(['enter', 'exit', 'dwell'])).optional(),
  min_dwell_seconds: z.number().int().min(0).optional(),
  device_filter: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional()
});

// Get all automations for organization
router.get('/', requireAuth, requireAccount, async (req, res) => {
  try {    
    const queryText = `
      SELECT 
        id,
        name,
        kind,
        config,
        enabled,
        created_at
      FROM automations 
      WHERE account_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await dbQuery(queryText, [req.accountId]);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
    
  } catch (error) {
    console.error('Error fetching automations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new automation
router.post('/', requireAuth, requireAccount, validateBody(CreateAutomationSchema), async (req, res) => {
  // Using query() function for automatic connection management

  try {
    await dbQuery('BEGIN');

    const { name, kind, config, enabled } = req.body;

    const queryText = `
      INSERT INTO automations (account_id, name, kind, config, enabled, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, kind, config, enabled, created_at
    `;

    const result = await dbQuery(queryText, [
      req.accountId,
      name,
      kind,
      JSON.stringify(config),
      enabled
    ]);

    await dbQuery('COMMIT');

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error creating automation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create automation'
    });
  } finally {  }
});

// Get specific automation
router.get('/:automationId', requireAuth, requireAccount, async (req, res) => {
  try {
    // Using query() function for automatic connection management
    
    const queryText = `
      SELECT 
        a.id,
        a.name,
        a.kind,
        a.config,
        a.enabled,
        a.created_at,
        COUNT(ar.id) as rule_count
      FROM automations a
      LEFT JOIN automation_rules ar ON a.id = ar.automation_id
      WHERE a.id = $1 AND a.account_id = $2
      GROUP BY a.id, a.name, a.kind, a.config, a.enabled, a.created_at
    `;
    
    const result = await dbQuery(queryText, [req.params.automationId, req.accountId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Automation not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error fetching automation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update automation
router.put('/:automationId', requireAuth, requireAccount, validateBody(UpdateAutomationSchema), async (req, res) => {
  // Using query() function for automatic connection management

  try {
    await dbQuery('BEGIN');

    const updates = req.body;

    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'config') {
        setClause.push(`${key} = $${paramCount}`);
        values.push(JSON.stringify(value));
      } else {
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
      }
      paramCount++;
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(req.params.automationId, req.accountId);

    const queryText = `
      UPDATE automations
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount} AND account_id = $${paramCount + 1}
      RETURNING id, name, kind, config, enabled, created_at
    `;

    const result = await dbQuery(queryText, values);

    if (result.rows.length === 0) {
      await dbQuery('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Automation not found'
      });
    }

    await dbQuery('COMMIT');

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error updating automation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update automation'
    });
  } finally {  }
});

// Delete automation
router.delete('/:automationId', requireAuth, requireAccount, async (req, res) => {
  // Using query() function for automatic connection management

  try {
    await dbQuery('BEGIN');

    const queryText = `
      DELETE FROM automations
      WHERE id = $1 AND account_id = $2
      RETURNING id
    `;

    const result = await dbQuery(queryText, [req.params.automationId, req.accountId]);

    if (result.rows.length === 0) {
      await dbQuery('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Automation not found'
      });
    }

    await dbQuery('COMMIT');

    res.json({
      success: true,
      message: 'Automation deleted successfully'
    });

  } catch (error) {
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error deleting automation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete automation'
    });
  } finally {  }
});

// Automation Rules Management

// Get automation rules for a specific automation
router.get('/:automationId/rules', requireAuth, requireAccount, async (req, res) => {
  try {
    // Using query() function for automatic connection management
    
    const queryText = `
      SELECT 
        ar.id,
        ar.name,
        ar.geofence_id,
        ar.device_id,
        ar.on_events,
        ar.min_dwell_seconds,
        ar.device_filter,
        ar.enabled,
        g.name as geofence_name,
        d.name as device_name
      FROM automation_rules ar
      LEFT JOIN geofences g ON ar.geofence_id = g.id
      LEFT JOIN devices d ON ar.device_id = d.id
      WHERE ar.automation_id = $1 
        AND ar.account_id = $2
      ORDER BY ar.name
    `;
    
    const result = await dbQuery(queryText, [req.params.automationId, req.accountId]);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch automation rules'
    });
  }
});

// Create automation rule
router.post('/:automationId/rules', requireAuth, requireAccount, validateBody(CreateAutomationRuleSchema), async (req, res) => {
  // Using query() function for automatic connection management

  try {
    await dbQuery('BEGIN');

    const { name, geofence_id, device_id, on_events, min_dwell_seconds, device_filter, enabled } = req.body;

    // Verify automation exists and belongs to user
    const automationCheck = await query(
      'SELECT id FROM automations WHERE id = $1 AND account_id = $2',
      [req.params.automationId, req.accountId]
    );

    if (automationCheck.rows.length === 0) {
      await dbQuery('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Automation not found'
      });
    }

    const queryText = `
      INSERT INTO automation_rules (
        name, account_id, geofence_id, device_id, automation_id,
        on_events, min_dwell_seconds, device_filter, enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, geofence_id, device_id, on_events, min_dwell_seconds, device_filter, enabled
    `;

    const result = await dbQuery(queryText, [
      name,
      req.accountId,
      geofence_id,
      device_id,
      req.params.automationId,
      on_events,
      min_dwell_seconds,
      JSON.stringify(device_filter),
      enabled
    ]);

    await dbQuery('COMMIT');

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error creating automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create automation rule'
    });
  } finally {  }
});

// Update automation rule
router.put('/:automationId/rules/:ruleId', requireAuth, requireAccount, validateBody(UpdateAutomationRuleSchema), async (req, res) => {
  // Using query() function for automatic connection management

  try {
    await dbQuery('BEGIN');

    const updates = req.body;

    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'device_filter') {
        setClause.push(`${key} = $${paramCount}`);
        values.push(JSON.stringify(value));
      } else {
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
      }
      paramCount++;
    }

    if (setClause.length === 0) {
      await dbQuery('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(req.params.ruleId, req.params.automationId, req.accountId);

    const queryText = `
      UPDATE automation_rules
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount} AND automation_id = $${paramCount + 1} AND account_id = $${paramCount + 2}
      RETURNING id, name, geofence_id, device_id, on_events, min_dwell_seconds, device_filter, enabled
    `;

    const result = await dbQuery(queryText, values);

    if (result.rows.length === 0) {
      await dbQuery('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Automation rule not found'
      });
    }

    await dbQuery('COMMIT');

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error updating automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update automation rule'
    });
  } finally {  }
});

// Delete automation rule
router.delete('/:automationId/rules/:ruleId', requireAuth, requireAccount, async (req, res) => {
  // Using query() function for automatic connection management

  try {
    await dbQuery('BEGIN');

    const queryText = `
      DELETE FROM automation_rules
      WHERE id = $1 AND automation_id = $2 AND account_id = $3
      RETURNING id
    `;

    const result = await dbQuery(queryText, [
      req.params.ruleId,
      req.params.automationId,
      req.accountId
    ]);

    if (result.rows.length === 0) {
      await dbQuery('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Automation rule not found'
      });
    }

    await dbQuery('COMMIT');

    res.json({
      success: true,
      message: 'Automation rule deleted successfully'
    });

  } catch (error) {
    try {
      await dbQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }
    console.error('Error deleting automation rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete automation rule'
    });
  } finally {  }
});

export { router as automationRoutes };
