#!/usr/bin/env node

/**
 * End-to-End Automation Flow Test Script
 * 
 * This script tests the complete geofence automation pipeline:
 * 1. Creates test account, device, geofence, and automation
 * 2. Publishes simulated GPS location to MQTT
 * 3. Validates geofence event detection
 * 4. Verifies webhook delivery
 * 
 * Usage: node test-automation-flow.js
 */

import { Pool } from 'pg';
import mqtt from 'mqtt';
import axios from 'axios';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const config = {
  database: {
    connectionString: process.env.DATABASE_URL || 'postgresql://geofence_user:geofence_pass@localhost:5432/geofence'
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD
  },
  api: {
    baseUrl: process.env.API_URL || 'http://localhost:3001',
  }
};

// Test webhook server configuration
const WEBHOOK_TEST_PORT = 3099;
let testWebhookServer = null;
let receivedWebhooks = [];

class AutomationFlowTester {
  constructor() {
    this.dbPool = new Pool({
      connectionString: config.database.connectionString,
      max: 5
    });
    this.testData = {};
  }

  async initialize() {
    console.log('🚀 Initializing end-to-end automation flow test...\n');
    
    // Test database connection
    try {
      await this.dbPool.query('SELECT NOW()');
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      throw error;
    }

    // Start test webhook server
    await this.startTestWebhookServer();
  }

  async startTestWebhookServer() {
    const express = require('express');
    const app = express();
    
    app.use(express.json());
    
    app.post('/test-webhook', (req, res) => {
      console.log('🎯 Webhook received:', JSON.stringify(req.body, null, 2));
      console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
      
      receivedWebhooks.push({
        timestamp: new Date().toISOString(),
        body: req.body,
        headers: req.headers
      });
      
      res.status(200).json({ success: true, message: 'Webhook received successfully' });
    });

    return new Promise((resolve) => {
      testWebhookServer = app.listen(WEBHOOK_TEST_PORT, () => {
        console.log(`✅ Test webhook server started on port ${WEBHOOK_TEST_PORT}`);
        resolve();
      });
    });
  }

  async setupTestData() {
    console.log('\n📝 Setting up test data...');

    // 1. Create test account
    const accountResult = await this.dbPool.query(`
      INSERT INTO accounts (id, name, email, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, email
    `, [uuidv4(), 'Test Account', 'test@example.com']);
    
    this.testData.account = accountResult.rows[0];
    console.log(`✅ Created test account: ${this.testData.account.name} (${this.testData.account.id})`);

    // 2. Create test device
    const deviceKey = this.generateDeviceKey();
    const deviceResult = await this.dbPool.query(`
      INSERT INTO devices (id, account_id, name, device_key, is_paired, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, name, device_key
    `, [uuidv4(), this.testData.account.id, 'Test ESP32 Device', deviceKey, true]);
    
    this.testData.device = deviceResult.rows[0];
    console.log(`✅ Created test device: ${this.testData.device.name} (${this.testData.device.id})`);

    // 3. Create test geofence (around San Francisco coordinates)
    const geofenceResult = await this.dbPool.query(`
      INSERT INTO geofences (id, account_id, name, type, geom, active, created_at)
      VALUES ($1, $2, $3, $4, ST_Buffer(ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)::geometry, $8, NOW())
      RETURNING id, name, type
    `, [
      uuidv4(), 
      this.testData.account.id, 
      'Test Office Geofence',
      'circle',
      -122.4194, // San Francisco longitude
      37.7749,   // San Francisco latitude  
      100,       // 100 meter radius
      true
    ]);
    
    this.testData.geofence = geofenceResult.rows[0];
    console.log(`✅ Created test geofence: ${this.testData.geofence.name} (${this.testData.geofence.id})`);

    // 4. Create test automation (webhook to our test server)
    const automationResult = await this.dbPool.query(`
      INSERT INTO automations (id, account_id, name, kind, config, enabled, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, name, kind
    `, [
      uuidv4(),
      this.testData.account.id,
      'Test Webhook Automation',
      'webhook',
      JSON.stringify({
        url: `http://localhost:${WEBHOOK_TEST_PORT}/test-webhook`,
        headers: { 'X-Test-Header': 'automation-test' },
        template: JSON.stringify({
          message: 'Device {{device}} {{event}} geofence {{geofence}} at {{timestamp}}',
          event: {
            type: '{{event}}',
            device: '{{device}}',
            geofence: '{{geofence}}',
            timestamp: '{{timestamp}}'
          }
        })
      }),
      true
    ]);
    
    this.testData.automation = automationResult.rows[0];
    console.log(`✅ Created test automation: ${this.testData.automation.name} (${this.testData.automation.id})`);

    // 5. Create automation rule
    const ruleResult = await this.dbPool.query(`
      INSERT INTO automation_rules (id, account_id, automation_id, geofence_id, device_id, on_events, min_dwell_seconds, enabled, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      uuidv4(),
      this.testData.account.id,
      this.testData.automation.id,
      this.testData.geofence.id,
      this.testData.device.id,
      ['enter', 'exit'], // Trigger on enter and exit events
      0, // No dwell time required
      true
    ]);
    
    this.testData.rule = ruleResult.rows[0];
    console.log(`✅ Created automation rule: ${this.testData.rule.id}`);

    console.log('\n📊 Test data summary:');
    console.log(`   Account: ${this.testData.account.name} (${this.testData.account.id})`);
    console.log(`   Device: ${this.testData.device.name} (${this.testData.device.device_key})`);
    console.log(`   Geofence: ${this.testData.geofence.name} (${this.testData.geofence.id})`);
    console.log(`   Automation: ${this.testData.automation.name} (${this.testData.automation.id})`);
  }

  generateDeviceKey() {
    return Array.from({ length: 16 }, () => Math.random().toString(36).charAt(2)).join('').toUpperCase();
  }

  async testMqttLocationPublishing() {
    console.log('\n📡 Testing MQTT location publishing...');

    return new Promise((resolve, reject) => {
      const client = mqtt.connect(config.mqtt.brokerUrl, {
        username: config.mqtt.username,
        password: config.mqtt.password,
        clientId: `test-client-${Date.now()}`
      });

      client.on('connect', async () => {
        console.log('✅ Connected to MQTT broker');

        // Test coordinates: Start outside geofence, then enter it
        const testLocations = [
          {
            description: 'Outside geofence',
            lat: 37.7849, // ~1km north of geofence center
            lon: -122.4194,
            expectEvent: false
          },
          {
            description: 'Inside geofence (should trigger ENTER)',
            lat: 37.7749, // Geofence center
            lon: -122.4194,
            expectEvent: 'enter'
          },
          {
            description: 'Still inside geofence',
            lat: 37.7748,
            lon: -122.4195,
            expectEvent: false
          },
          {
            description: 'Outside geofence (should trigger EXIT)', 
            lat: 37.7849, // Back outside
            lon: -122.4194,
            expectEvent: 'exit'
          }
        ];

        for (let i = 0; i < testLocations.length; i++) {
          const location = testLocations[i];
          console.log(`\n📍 Publishing test location ${i + 1}/${testLocations.length}: ${location.description}`);
          
          const locationPayload = {
            v: 1,
            ts: new Date().toISOString(),
            lat: location.lat,
            lon: location.lon,
            speedMps: 0,
            accuracyM: 10,
            batteryPct: 85,
            attrs: { test: true }
          };

          // Sign the payload
          const { sig, ...payloadWithoutSig } = locationPayload;
          const sortedPayload = JSON.stringify(payloadWithoutSig, Object.keys(payloadWithoutSig).sort());
          const signature = createHmac('sha256', this.testData.device.device_key)
            .update(sortedPayload)
            .digest('hex');
          
          locationPayload.sig = signature;

          const topic = `geofence/${this.testData.account.id}/${this.testData.device.device_key}`;
          
          await new Promise((publishResolve) => {
            client.publish(topic, JSON.stringify(locationPayload), { qos: 1 }, (err) => {
              if (err) {
                console.error(`❌ Failed to publish to ${topic}:`, err.message);
              } else {
                console.log(`✅ Published location to ${topic}`);
                console.log(`   Coordinates: ${location.lat}, ${location.lon}`);
                console.log(`   Expected event: ${location.expectEvent || 'none'}`);
              }
              publishResolve();
            });
          });

          // Wait between publishes to allow processing
          if (i < testLocations.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }

        client.end();
        console.log('✅ MQTT location publishing test completed');
        resolve();
      });

      client.on('error', (error) => {
        console.error('❌ MQTT connection error:', error.message);
        reject(error);
      });

      setTimeout(() => {
        reject(new Error('MQTT publishing test timeout'));
      }, 60000); // 60 second timeout
    });
  }

  async validateGeofenceEvents() {
    console.log('\n🔍 Validating geofence events...');
    
    // Wait a bit for processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    const eventsResult = await this.dbPool.query(`
      SELECT ge.id, ge.type, ge.ts, d.name as device_name, g.name as geofence_name
      FROM geofence_events ge
      JOIN devices d ON ge.device_id = d.id
      JOIN geofences g ON ge.geofence_id = g.id
      WHERE ge.device_id = $1 
        AND ge.geofence_id = $2
        AND ge.ts > NOW() - INTERVAL '5 minutes'
      ORDER BY ge.ts ASC
    `, [this.testData.device.id, this.testData.geofence.id]);

    console.log(`📊 Found ${eventsResult.rows.length} geofence events:`);
    eventsResult.rows.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.type.toUpperCase()} - ${event.device_name} -> ${event.geofence_name} at ${event.ts}`);
    });

    // Validate expected events
    const enterEvents = eventsResult.rows.filter(e => e.type === 'enter');
    const exitEvents = eventsResult.rows.filter(e => e.type === 'exit');

    if (enterEvents.length > 0) {
      console.log('✅ ENTER event detected successfully');
    } else {
      console.log('⚠️  No ENTER events found - check geofence processing');
    }

    if (exitEvents.length > 0) {
      console.log('✅ EXIT event detected successfully');
    } else {
      console.log('⚠️  No EXIT events found - check geofence processing');
    }

    return eventsResult.rows;
  }

  async validateWebhookDeliveries() {
    console.log('\n🎯 Validating webhook deliveries...');
    
    // Wait a bit for webhook processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check database for delivery records
    const deliveriesResult = await this.dbPool.query(`
      SELECT d.id, d.status, d.attempt, d.last_error, d.created_at,
             a.name as automation_name, ge.type as event_type
      FROM deliveries d
      JOIN automations a ON d.automation_id = a.id
      JOIN geofence_events ge ON d.gevent_id = ge.id
      WHERE d.account_id = $1
        AND d.created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY d.created_at ASC
    `, [this.testData.account.id]);

    console.log(`📊 Found ${deliveriesResult.rows.length} webhook deliveries:`);
    deliveriesResult.rows.forEach((delivery, index) => {
      console.log(`   ${index + 1}. ${delivery.event_type.toUpperCase()} -> ${delivery.automation_name}: ${delivery.status.toUpperCase()} (attempt ${delivery.attempt})`);
      if (delivery.last_error) {
        console.log(`      Error: ${delivery.last_error}`);
      }
    });

    // Check received webhooks at our test server
    console.log(`\n📨 Test webhook server received ${receivedWebhooks.length} webhooks:`);
    receivedWebhooks.forEach((webhook, index) => {
      console.log(`   ${index + 1}. Received at ${webhook.timestamp}`);
      console.log(`      Event type: ${webhook.body.event?.type || 'unknown'}`);
      console.log(`      Device: ${webhook.body.event?.device?.name || 'unknown'}`);
      console.log(`      Geofence: ${webhook.body.event?.geofence?.name || 'unknown'}`);
    });

    return {
      deliveries: deliveriesResult.rows,
      receivedWebhooks: receivedWebhooks
    };
  }

  async validateSystemHealth() {
    console.log('\n🏥 Checking system health...');

    const checks = [];

    // Database connectivity
    try {
      await this.dbPool.query('SELECT NOW()');
      checks.push({ component: 'Database', status: 'healthy' });
    } catch (error) {
      checks.push({ component: 'Database', status: 'unhealthy', error: error.message });
    }

    // MQTT broker connectivity
    try {
      await new Promise((resolve, reject) => {
        const client = mqtt.connect(config.mqtt.brokerUrl, {
          username: config.mqtt.username,
          password: config.mqtt.password,
          clientId: `health-check-${Date.now()}`
        });

        const timeout = setTimeout(() => {
          client.end();
          reject(new Error('Connection timeout'));
        }, 5000);

        client.on('connect', () => {
          clearTimeout(timeout);
          client.end();
          resolve();
        });

        client.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      checks.push({ component: 'MQTT Broker', status: 'healthy' });
    } catch (error) {
      checks.push({ component: 'MQTT Broker', status: 'unhealthy', error: error.message });
    }

    // API server connectivity (optional)
    try {
      await axios.get(`${config.api.baseUrl}/health`, { timeout: 5000 });
      checks.push({ component: 'API Server', status: 'healthy' });
    } catch (error) {
      checks.push({ component: 'API Server', status: 'unhealthy', error: error.message });
    }

    checks.forEach(check => {
      if (check.status === 'healthy') {
        console.log(`✅ ${check.component}: ${check.status}`);
      } else {
        console.log(`❌ ${check.component}: ${check.status} - ${check.error}`);
      }
    });

    const allHealthy = checks.every(check => check.status === 'healthy');
    return { checks, allHealthy };
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete in reverse dependency order
      await this.dbPool.query('DELETE FROM automation_rules WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM deliveries WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM geofence_events WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM location_events WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM automations WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM geofences WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM devices WHERE account_id = $1', [this.testData.account.id]);
      await this.dbPool.query('DELETE FROM accounts WHERE id = $1', [this.testData.account.id]);
      
      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.error('❌ Cleanup error:', error.message);
    }

    if (testWebhookServer) {
      testWebhookServer.close();
      console.log('✅ Test webhook server stopped');
    }

    await this.dbPool.end();
    console.log('✅ Database connections closed');
  }

  async runTest() {
    try {
      await this.initialize();
      await this.setupTestData();
      
      const healthCheck = await this.validateSystemHealth();
      if (!healthCheck.allHealthy) {
        console.log('\n⚠️  System health check failed. Some components may not be running.');
        console.log('   Make sure Docker services are started: docker-compose up postgres kafka redis mqtt-broker');
      }

      await this.testMqttLocationPublishing();
      const geofenceEvents = await this.validateGeofenceEvents();
      const webhookResults = await this.validateWebhookDeliveries();

      console.log('\n🎉 End-to-end test summary:');
      console.log(`   Geofence events detected: ${geofenceEvents.length}`);
      console.log(`   Webhook deliveries attempted: ${webhookResults.deliveries.length}`);
      console.log(`   Webhooks received: ${webhookResults.receivedWebhooks.length}`);

      const success = geofenceEvents.length > 0 && webhookResults.receivedWebhooks.length > 0;
      
      if (success) {
        console.log('\n✅ End-to-end automation flow test PASSED!');
        console.log('   The complete pipeline from MQTT location -> geofence detection -> webhook delivery is working.');
      } else {
        console.log('\n❌ End-to-end automation flow test FAILED!');
        console.log('   Check the logs above for issues with:');
        console.log('   - MQTT ingestion service (apps/mqtt-ingestion)');
        console.log('   - Automation processor (apps/automation-workers)');
        console.log('   - Database geofence calculation');
      }

      return success;

    } catch (error) {
      console.error('\n💥 Test failed with error:', error.message);
      console.error(error.stack);
      return false;
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
async function main() {
  const tester = new AutomationFlowTester();
  const success = await tester.runTest();
  process.exit(success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default AutomationFlowTester;