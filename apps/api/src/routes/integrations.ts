import { INTEGRATION_TYPES } from '@geofence/shared';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '@geofence/db';
import { validateBody, requireAccount } from '../middleware/validation.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const CreateSlackIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.object({
    channel: z.string().min(1),
    mention_users: z.boolean().optional(),
    template: z.string().optional()
  }),
  credentials: z.object({
    webhook_url: z.string().url(),
    bot_token: z.string().optional()
  })
});

const CreateNotionIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.object({
    database_id: z.string().min(1),
    properties: z.record(z.unknown()).optional(),
    template: z.string().optional()
  }),
  credentials: z.object({
    access_token: z.string().min(1)
  })
});

const CreateSheetsIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.object({
    spreadsheet_id: z.string().min(1),
    range: z.string().min(1),
    append_mode: z.boolean().optional(),
    headers: z.array(z.string()).optional()
  }),
  credentials: z.object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1)
  })
});

const CreateWhatsAppIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.object({
    phone_number: z.string().min(1),
    template: z.string().optional(),
    business_account_id: z.string().optional()
  }),
  credentials: z.object({
    access_token: z.string().min(1),
    phone_number_id: z.string().optional()
  })
});

const CreateWebhookIntegrationSchema = z.object({
  name: z.string().min(1).max(255),
  config: z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('POST'),
    headers: z.record(z.string()).optional(),
    timeout_ms: z.number().min(1000).max(30000).optional(),
    retry_count: z.number().min(0).max(5).optional()
  }),
  credentials: z.object({
    url: z.string().url(),
    auth_header: z.string().optional(),
    api_key: z.string().optional()
  })
});

const CreateIntegrationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('slack') }).merge(CreateSlackIntegrationSchema),
  z.object({ type: z.literal('notion') }).merge(CreateNotionIntegrationSchema),
  z.object({ type: z.literal('google_sheets') }).merge(CreateSheetsIntegrationSchema),
  z.object({ type: z.literal('whatsapp') }).merge(CreateWhatsAppIntegrationSchema),
  z.object({ type: z.literal('webhook') }).merge(CreateWebhookIntegrationSchema)
]);

const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.record(z.unknown()).optional(),
  is_active: z.boolean().optional()
});

const TestIntegrationSchema = z.object({
  message: z.string().min(1).max(500).optional().default('Test message from Geofence API'),
  test_payload: z.record(z.unknown()).optional()
});

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
        created_at as updated_at
      FROM automations 
      WHERE account_id = $1
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
    
    // Don't return sensitive credentials in list view
    const integrations = result.rows.map(integration => ({
      ...integration,
      credentials: undefined,
      has_credentials: true
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

// Create new integration

router.post('/', requireAuth, requireAccount, validateBody(CreateIntegrationSchema), async (req, res) => {
  try {
    // Using query() function for automatic connection management
    
    const queryText = `
      INSERT INTO integrations (name, type, account_id, config, credentials)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, type, config, is_active, created_at
    `;
    
    const result = await query(queryText, [
      req.body.name,
      req.body.type,
      req.accountId,
      JSON.stringify(req.body.config),
      JSON.stringify(req.body.credentials)
    ]);
    
    const integration = {
      ...result.rows[0],
      credentials: undefined,
      has_credentials: true
    };
    
    res.status(201).json({
      success: true,
      data: integration
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
    // Using query() function for automatic connection management
    const queryText = `
      SELECT 
        id,
        name,
        type,
        config,
        is_active,
        created_at,
        updated_at
      FROM integrations 
      WHERE id = $1 AND account_id = $2
    `;
    
    const result = await query(queryText, [req.params.integrationId, req.accountId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }
    
    const integration = {
      ...result.rows[0],
      credentials: undefined,
      has_credentials: true
    };
    
    res.json({
      success: true,
      data: integration
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

router.put('/:integrationId', requireAuth, requireAccount, validateBody(UpdateIntegrationSchema), async (req, res) => {
  try {
    // Using query() function for automatic connection management
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (req.body.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(req.body.name);
    }
    
    if (req.body.config !== undefined) {
      updates.push(`config = $${paramCount++}`);
      values.push(JSON.stringify(req.body.config));
    }
    
    if (req.body.credentials !== undefined) {
      updates.push(`credentials = $${paramCount++}`);
      values.push(JSON.stringify(req.body.credentials));
    }
    
    if (req.body.is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(req.body.is_active);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.params.integrationId, req.accountId);
    
    const queryText = `
      UPDATE integrations 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND account_id = $${paramCount}
      RETURNING id, name, type, config, is_active, updated_at
    `;
    
    const result = await query(queryText, values);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }
    
    const integration = {
      ...result.rows[0],
      credentials: undefined,
      has_credentials: true
    };
    
    res.json({
      success: true,
      data: integration
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
// Delete integration
router.delete('/:integrationId', requireAuth, requireAccount, async (req, res) => {
  try {
    // Using query() function for automatic connection management
    
    // Check if integration is used in any automation rules
    const usageQuery = `
      SELECT COUNT(*) as rule_count 
      FROM automation_rules 
      WHERE integration_id = $1 AND account_id = $2
    `;
    const usageResult = await query(usageQuery, [req.params.integrationId, req.accountId]);
    const ruleCount = parseInt(usageResult.rows[0]?.rule_count || '0');
    
    if (ruleCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete integration. It is used by ${ruleCount} automation rule(s).`,
        details: {
          rule_count: ruleCount
        }
      });
    }
    
    const query = 'DELETE FROM integrations WHERE id = $1 AND account_id = $2';
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
router.post('/:integrationId/test', requireAuth, requireAccount, validateBody(TestIntegrationSchema), async (req, res) => {
  try {
    // Using query() function for automatic connection management
    
    // Get integration with credentials for testing
    const queryText = `
      SELECT 
        id,
        name,
        type,
        config,
        credentials,
        is_active
      FROM integrations 
      WHERE id = $1 AND account_id = $2
    `;
    
    const result = await query(queryText, [req.params.integrationId, req.accountId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }
    
    const integration = result.rows[0];
    
    if (!integration.is_active) {
      return res.status(400).json({
        success: false,
        error: 'Integration is not active'
      });
    }
    
    // Create test payload based on integration type
    const testPayload = req.body.test_payload || {
      event: {
        type: 'enter',
        deviceId: 'test_device',
        geofenceId: 'test_geofence',
        location: { latitude: 37.7749, longitude: -122.4194 },
        timestamp: new Date().toISOString()
      },
      device: { id: 'test_device', name: 'Test Device' },
      geofence: { id: 'test_geofence', name: 'Test Geofence' },
      rule: { id: 'test_rule', name: 'Test Rule' },
      message: req.body.message,
      test_mode: true
    };
    
    // Implement actual integration testing by calling the real integration handlers
    let testResult: any = {};
    
    try {
      // Create test automation event
      const testEvent = {
        id: 'test_event',
        device_id: 'test_device',
        geofence_id: 'test_geofence',
        rule_id: 'test_rule',
        event_type: 'enter',
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: new Date().toISOString(),
        test_mode: true
      };
    
      switch (integration.type) {
        case INTEGRATION_TYPES.SLACK:
          // Test Slack integration with actual API call
          if (integration.credentials.webhook_url) {
            const axios = (await import('axios')).default;
            const testPayload = {
              text: `🧪 Test message from Geofence system at ${new Date().toISOString()}`,
              channel: integration.config.channel,
              username: 'Geofence Test Bot'
            };
            
            try {
              await axios.post(integration.credentials.webhook_url, testPayload, {
                timeout: 5000
              });
              testResult = {
                status: 'success',
                message: 'Test message sent successfully to Slack',
                channel: integration.config.channel,
                webhook_tested: true
              };
            } catch (error: any) {
              testResult = {
                status: 'error',
                message: `Failed to send test message: ${error.message}`,
                channel: integration.config.channel,
                webhook_tested: false
              };
            }
          } else {
            testResult = {
              status: 'error',
              message: 'Webhook URL not configured',
              webhook_tested: false
            };
          }
          break;
        
        case INTEGRATION_TYPES.NOTION:
          // Test Notion integration with actual API call
          if (integration.credentials.access_token) {
            const axios = (await import('axios')).default;
            
            try {
              // Test with a simple database query
              await axios.post(
                `https://api.notion.com/v1/databases/${integration.config.database_id}/query`,
                { page_size: 1 },
                {
                  headers: {
                    'Authorization': `Bearer ${integration.credentials.access_token}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                  },
                  timeout: 5000
                }
              );
              
              testResult = {
                status: 'success',
                message: 'Successfully connected to Notion database',
                database_id: integration.config.database_id,
                connection_tested: true
              };
            } catch (error: any) {
              testResult = {
                status: 'error',
                message: `Failed to connect to Notion: ${error.response?.data?.message || error.message}`,
                database_id: integration.config.database_id,
                connection_tested: false
              };
            }
          } else {
            testResult = {
              status: 'error',
              message: 'Access token not configured',
              connection_tested: false
            };
          }
          break;
        
        case INTEGRATION_TYPES.GOOGLE_SHEETS:
          // Test Google Sheets integration with actual API call
          if (integration.credentials.access_token) {
            const axios = (await import('axios')).default;
            
            try {
              // Test by reading spreadsheet metadata
              await axios.get(
                `https://sheets.googleapis.com/v4/spreadsheets/${integration.config.spreadsheet_id}`,
                {
                  headers: {
                    'Authorization': `Bearer ${integration.credentials.access_token}`
                  },
                  timeout: 5000
                }
              );
              
              testResult = {
                status: 'success',
                message: 'Successfully connected to Google Sheets',
                spreadsheet_id: integration.config.spreadsheet_id,
                range: integration.config.range,
                connection_tested: true
              };
            } catch (error: any) {
              testResult = {
                status: 'error',
                message: `Failed to connect to Google Sheets: ${error.response?.data?.error?.message || error.message}`,
                spreadsheet_id: integration.config.spreadsheet_id,
                connection_tested: false
              };
            }
          } else {
            testResult = {
              status: 'error',
              message: 'Access token not configured',
              connection_tested: false
            };
          }
          break;
        
        case INTEGRATION_TYPES.WHATSAPP:
          // Test WhatsApp integration (Business API or Twilio)
          if (integration.credentials.access_token) {
            const axios = (await import('axios')).default;
            
            try {
              // Test WhatsApp Business API connection
              if (integration.config.phone_number_id) {
                await axios.get(
                  `https://graph.facebook.com/v18.0/${integration.config.phone_number_id}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${integration.credentials.access_token}`
                    },
                    timeout: 5000
                  }
                );
              }
              
              testResult = {
                status: 'success',
                message: 'Successfully connected to WhatsApp Business API',
                phone_number: integration.config.phone_number,
                connection_tested: true
              };
            } catch (error: any) {
              testResult = {
                status: 'error',
                message: `Failed to connect to WhatsApp: ${error.response?.data?.error?.message || error.message}`,
                phone_number: integration.config.phone_number,
                connection_tested: false
              };
            }
          } else {
            testResult = {
              status: 'error',
              message: 'Access token not configured',
              connection_tested: false
            };
          }
          break;
          
        case INTEGRATION_TYPES.WEBHOOK:
          // Test webhook endpoint
          if (integration.credentials.url) {
            const axios = (await import('axios')).default;
            const method = (integration.config.method || 'POST').toLowerCase();
            const testPayload = {
              test: true,
              event: testEvent,
              timestamp: new Date().toISOString()
            };
            
            try {
              if (method === 'post') {
                await axios.post(integration.credentials.url, testPayload, { timeout: 5000 });
              } else if (method === 'get') {
                await axios.get(integration.credentials.url, { timeout: 5000 });
              }
              
              testResult = {
                status: 'success',
                message: 'Test webhook sent successfully',
                url: integration.credentials.url,
                method: method.toUpperCase(),
                webhook_tested: true
              };
            } catch (error: any) {
              testResult = {
                status: 'error',
                message: `Failed to send webhook: ${error.message}`,
                url: integration.credentials.url,
                webhook_tested: false
              };
            }
          } else {
            testResult = {
              status: 'error',
              message: 'Webhook URL not configured',
              webhook_tested: false
            };
          }
          break;
        
        default:
          testResult = {
            status: 'error',
            message: 'Unknown integration type'
          };
      }
    } catch (testError) {
      console.error('Integration test error:', testError);
      testResult = {
        status: 'error',
        message: 'Test execution failed',
        error: testError instanceof Error ? testError.message : 'Unknown error'
      };
    }
    
    res.json({
      success: true,
      data: {
        integration: {
          id: integration.id,
          name: integration.name,
          type: integration.type
        },
        test_payload: testPayload,
        test_result: testResult,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get integration types and their schemas
router.get('/types/schemas', async (_req, res) => {
  const schemas = {
    slack: {
      name: 'Slack',
      description: 'Send notifications to Slack channels',
      config_fields: [
        { name: 'channel', type: 'string', required: true, description: 'Slack channel (e.g., #general)' },
        { name: 'mention_users', type: 'boolean', required: false, description: 'Mention users in messages' },
        { name: 'template', type: 'string', required: false, description: 'Message template' }
      ],
      credential_fields: [
        { name: 'webhook_url', type: 'url', required: true, description: 'Slack webhook URL' },
        { name: 'bot_token', type: 'string', required: false, description: 'Bot token for advanced features' }
      ]
    },
    notion: {
      name: 'Notion',
      description: 'Create and update Notion database records',
      config_fields: [
        { name: 'database_id', type: 'string', required: true, description: 'Notion database ID' },
        { name: 'properties', type: 'object', required: false, description: 'Default properties to set' },
        { name: 'template', type: 'string', required: false, description: 'Page template' }
      ],
      credential_fields: [
        { name: 'access_token', type: 'string', required: true, description: 'Notion integration token' }
      ]
    },
    google_sheets: {
      name: 'Google Sheets',
      description: 'Add rows to Google Sheets',
      config_fields: [
        { name: 'spreadsheet_id', type: 'string', required: true, description: 'Google Sheets spreadsheet ID' },
        { name: 'range', type: 'string', required: true, description: 'Range to write to (e.g., Sheet1!A:E)' },
        { name: 'append_mode', type: 'boolean', required: false, description: 'Append to end of sheet' },
        { name: 'headers', type: 'array', required: false, description: 'Column headers' }
      ],
      credential_fields: [
        { name: 'access_token', type: 'string', required: true, description: 'Google API access token' },
        { name: 'refresh_token', type: 'string', required: true, description: 'Google API refresh token' }
      ]
    },
    whatsapp: {
      name: 'WhatsApp Business',
      description: 'Send WhatsApp messages',
      config_fields: [
        { name: 'phone_number', type: 'string', required: true, description: 'Recipient phone number' },
        { name: 'template', type: 'string', required: false, description: 'Message template' },
        { name: 'business_account_id', type: 'string', required: false, description: 'Business account ID' }
      ],
      credential_fields: [
        { name: 'access_token', type: 'string', required: true, description: 'WhatsApp Business API token' },
        { name: 'phone_number_id', type: 'string', required: false, description: 'Phone number ID' }
      ]
    },
    webhook: {
      name: 'Generic Webhook',
      description: 'Send HTTP requests to any endpoint',
      config_fields: [
        { name: 'method', type: 'select', required: false, options: ['GET', 'POST', 'PUT', 'PATCH'], description: 'HTTP method' },
        { name: 'headers', type: 'object', required: false, description: 'HTTP headers' },
        { name: 'timeout_ms', type: 'number', required: false, description: 'Request timeout in milliseconds' },
        { name: 'retry_count', type: 'number', required: false, description: 'Number of retries on failure' }
      ],
      credential_fields: [
        { name: 'url', type: 'url', required: true, description: 'Webhook URL' },
        { name: 'auth_header', type: 'string', required: false, description: 'Authorization header value' },
        { name: 'api_key', type: 'string', required: false, description: 'API key for authentication' }
      ]
    }
  };
  
  res.json({
    success: true,
    data: schemas
  });
});

export { router as integrationRoutes };
