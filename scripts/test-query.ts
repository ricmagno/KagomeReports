/**
 * Test script to trigger a time-series query and see the SQL output
 */

import { dataRetrievalService } from '../src/services/dataRetrieval';

async function testQuery() {
  try {
    console.log('Testing time-series query...');
    
    const tagName = 'Kagome_AU.TC11_TT004_PV';
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago
    
    console.log('Query parameters:');
    console.log('  Tag:', tagName);
    console.log('  Start:', startTime.toISOString());
    console.log('  End:', endTime.toISOString());
    console.log('');
    
    const data = await dataRetrievalService.getTimeSeriesData(
      tagName,
      { startTime, endTime }
    );
    
    console.log(`\nReceived ${data.length} data points`);
    if (data.length > 0) {
      console.log('First point:', data[0]);
      console.log('Last point:', data[data.length - 1]);
    }
    
  } catch (error) {
    console.error('Query failed:', error);
  }
  
  process.exit(0);
}

testQuery();
