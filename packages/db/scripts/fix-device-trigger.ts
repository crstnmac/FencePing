#!/usr/bin/env tsx

import { getDbClient } from '../src/client.js';

async function fixDeviceTrigger() {
  const client = await getDbClient();
  
  try {
    console.log('🔧 Fixing device trigger issue...');
    
    // Drop the problematic trigger and function
    await client.query('DROP TRIGGER IF EXISTS device_status_trigger ON devices;');
    console.log('✅ Dropped device_status_trigger');
    
    await client.query('DROP FUNCTION IF EXISTS update_device_last_modified();');
    console.log('✅ Dropped update_device_last_modified function');
    
    console.log('✅ Device trigger issue fixed');
    
  } catch (error) {
    console.error('❌ Error fixing device trigger:', error);
    throw error;
  } finally {
    client.release();
  }
}

fixDeviceTrigger()
  .then(() => {
    console.log('✅ Device trigger fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Device trigger fix failed:', error);
    process.exit(1);
  });