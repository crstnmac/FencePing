import { Router } from 'express';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { validateBody } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const DeviceGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), // Hex color
  icon: z.string().max(50).optional(),
  metadata: z.record(z.any()).optional()
});

// Get all device groups
router.get('/', requireAuth, async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `SELECT dg.*, COUNT(d.id) as device_count
       FROM device_groups dg
       LEFT JOIN devices d ON dg.id = d.group_id AND d.account_id = $1
       WHERE dg.account_id = $1
       GROUP BY dg.id, dg.name, dg.description, dg.color, dg.icon, dg.metadata, dg.created_at, dg.updated_at
       ORDER BY dg.name`,
      [req.accountId]
    );
    
    res.json({
      success: true,
      data: result.rows.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        color: group.color,
        icon: group.icon,
        metadata: group.metadata,
        deviceCount: parseInt(group.device_count),
        createdAt: group.created_at,
        updatedAt: group.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching device groups:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create device group
router.post('/', requireAuth, validateBody(DeviceGroupSchema), async (req, res) => {
  try {
    const client = await getDbClient();
    const result = await client.query(
      `INSERT INTO device_groups (name, description, account_id, color, icon, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, color, icon, metadata, created_at, updated_at`,
      [
        req.body.name,
        req.body.description,
        req.accountId,
        req.body.color || '#3B82F6',
        req.body.icon || 'device',
        JSON.stringify(req.body.metadata || {})
      ]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: 'Group name already exists'
      });
    }
    console.error('Error creating device group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update device group
router.put('/:groupId', requireAuth, validateBody(DeviceGroupSchema.partial()), async (req, res) => {
  try {
    const client = await getDbClient();
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (req.body.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.name);
    }
    
    if (req.body.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(req.body.description);
    }
    
    if (req.body.color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(req.body.color);
    }
    
    if (req.body.icon !== undefined) {
      updates.push(`icon = $${paramCount++}`);
      values.push(req.body.icon);
    }
    
    if (req.body.metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(req.body.metadata));
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.params.groupId, req.accountId);
    
    const result = await client.query(
      `UPDATE device_groups
       SET ${updates.join(', ')}
       WHERE id = $${paramCount} AND account_id = $${paramCount + 1}
       RETURNING id, name, description, color, icon, metadata, updated_at`,
      values
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Device group not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: 'Group name already exists'
      });
    }
    console.error('Error updating device group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete device group
router.delete('/:groupId', requireAuth, async (req, res) => {
  const client = await getDbClient();

  try {
    
    // First, get the default group to move devices to
    const defaultGroupResult = await client.query(
      `SELECT id FROM device_groups WHERE account_id = $1 AND name = 'Default'`,
      [req.accountId]
    );
    
    if (defaultGroupResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Default group not found'
      });
    }
    
    const defaultGroupId = defaultGroupResult.rows[0].id;
    
    await client.query('BEGIN');
    
    // Move devices to default group
    await client.query(
      `UPDATE devices SET group_id = $1 WHERE group_id = $2 AND account_id = $3`,
      [defaultGroupId, req.params.groupId, req.accountId]
    );
    
    // Delete the group
    const result = await client.query(
      `DELETE FROM device_groups WHERE id = $1 AND account_id = $2 AND name != 'Default'
       RETURNING name`,
      [req.params.groupId, req.accountId]
    );
    
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Device group not found or cannot delete default group'
      });
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Device group '${result.rows[0].name}' deleted successfully`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting device group:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;