/**
 * Test script to verify retrieval mode functionality
 */

import { dataRetrievalService } from '../src/services/dataRetrieval';
import { RetrievalMode } from '../src/types/historian';

async function testRetrievalModes() {
  try {
    console.log('Testing retrieval modes...\n');
    
    const tagName = 'Kagome_AU.TC11_TT004_PV';
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago
    
    console.log('Query parameters:');
    console.log('  Tag:', tagName);
    console.log('  Start:', startTime.toISOString());
    console.log('  End:', endTime.toISOString());
    console.log('');
    
    // Test Delta mode (actual stored values)
    console.log('=== Testing Delta Mode ===');
    const deltaData = await dataRetrievalService.getTimeSeriesData(
      tagName,
      { startTime, endTime },
      { mode: RetrievalMode.Delta, includeQuality: true }
    );
    console.log(`Delta mode: ${deltaData.length} data points`);
    if (deltaData.length > 0) {
      console.log('  First point:', {
        timestamp: deltaData[0]!.timestamp,
        value: deltaData[0]!.value,
        quality: deltaData[0]!.quality
      });
      console.log('  Last point:', {
        timestamp: deltaData[deltaData.length - 1]!.timestamp,
        value: deltaData[deltaData.length - 1]!.value,
        quality: deltaData[deltaData.length - 1]!.quality
      });
    }
    console.log('');
    
    // Test Cyclic mode (interpolated values)
    console.log('=== Testing Cyclic Mode ===');
    const cyclicData = await dataRetrievalService.getTimeSeriesData(
      tagName,
      { startTime, endTime },
      { mode: RetrievalMode.Cyclic, maxPoints: 100, includeQuality: true }
    );
    console.log(`Cyclic mode: ${cyclicData.length} data points`);
    if (cyclicData.length > 0) {
      console.log('  First point:', {
        timestamp: cyclicData[0]!.timestamp,
        value: cyclicData[0]!.value,
        quality: cyclicData[0]!.quality
      });
      console.log('  Last point:', {
        timestamp: cyclicData[cyclicData.length - 1]!.timestamp,
        value: cyclicData[cyclicData.length - 1]!.value,
        quality: cyclicData[cyclicData.length - 1]!.quality
      });
    }
    console.log('');
    
    // Test Average mode
    console.log('=== Testing Average Mode ===');
    const avgData = await dataRetrievalService.getTimeSeriesData(
      tagName,
      { startTime, endTime },
      { mode: RetrievalMode.Average, maxPoints: 50, includeQuality: true }
    );
    console.log(`Average mode: ${avgData.length} data points`);
    if (avgData.length > 0) {
      console.log('  First point:', {
        timestamp: avgData[0]!.timestamp,
        value: avgData[0]!.value,
        quality: avgData[0]!.quality
      });
      console.log('  Last point:', {
        timestamp: avgData[avgData.length - 1]!.timestamp,
        value: avgData[avgData.length - 1]!.value,
        quality: avgData[avgData.length - 1]!.quality
      });
    }
    console.log('');
    
    console.log('=== Summary ===');
    console.log(`Delta mode: ${deltaData.length} points (actual stored values)`);
    console.log(`Cyclic mode: ${cyclicData.length} points (interpolated)`);
    console.log(`Average mode: ${avgData.length} points (averaged)`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  process.exit(0);
}

testRetrievalModes();
