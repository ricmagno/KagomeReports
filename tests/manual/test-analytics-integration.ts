/**
 * Manual test for analytics integration in report generation
 * Tests the complete flow: tag classification → analytics calculation → chart generation → PDF
 */

import { reportGenerationService } from '../../src/services/reportGeneration';
import { TimeSeriesData } from '../../src/types/historian';
import fs from 'fs';
import path from 'path';

// Generate test data
function generateTestData(
  tagName: string,
  count: number,
  mean: number,
  stdDev: number,
  outOfControlIndices: number[] = []
): TimeSeriesData[] {
  const data: TimeSeriesData[] = [];
  const startTime = new Date('2024-01-01T00:00:00Z');
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60000); // 1 minute intervals
    
    // Generate value with normal distribution
    let value: number;
    if (outOfControlIndices.includes(i)) {
      // Out of control point
      value = mean + (Math.random() > 0.5 ? 1 : -1) * (stdDev * 4 + Math.random() * stdDev);
    } else {
      // Normal point
      value = mean + (Math.random() - 0.5) * 2 * stdDev;
    }
    
    data.push({
      timestamp,
      value,
      quality: 192, // Good quality
      tagName
    });
  }
  
  return data;
}

// Generate digital (binary) test data
function generateDigitalData(tagName: string, count: number): TimeSeriesData[] {
  const data: TimeSeriesData[] = [];
  const startTime = new Date('2024-01-01T00:00:00Z');
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60000);
    const value = Math.random() > 0.5 ? 1 : 0; // Binary values
    
    data.push({
      timestamp,
      value,
      quality: 192,
      tagName
    });
  }
  
  return data;
}

async function runTest() {
  console.log('=== Analytics Integration Test ===\n');
  
  try {
    // Test 1: Report with analog tags (with spec limits)
    console.log('Test 1: Generating report with analog tags and spec limits...');
    
    const analogData1 = generateTestData('TEMP_01', 100, 75, 5, [10, 25, 40]);
    const analogData2 = generateTestData('PRESSURE_01', 100, 100, 10, [15, 30]);
    
    const reportData1 = {
      config: {
        id: 'test-report-1',
        name: 'Analytics Integration Test - Analog Tags',
        description: 'Test report with analog tags, trend lines, and SPC charts',
        tags: ['TEMP_01', 'PRESSURE_01'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-01T02:00:00Z')
        },
        chartTypes: ['line' as const],
        template: 'default',
        format: 'pdf' as const,
        specificationLimits: {
          'TEMP_01': { lsl: 65, usl: 85 },
          'PRESSURE_01': { lsl: 80, usl: 120 }
        },
        includeSPCCharts: true,
        includeTrendLines: true,
        includeStatsSummary: true
      },
      data: {
        'TEMP_01': analogData1,
        'PRESSURE_01': analogData2
      },
      statistics: {
        'TEMP_01': {
          min: Math.min(...analogData1.map(d => d.value)),
          max: Math.max(...analogData1.map(d => d.value)),
          average: analogData1.reduce((sum, d) => sum + d.value, 0) / analogData1.length,
          standardDeviation: 5,
          count: analogData1.length,
          dataQuality: 100
        },
        'PRESSURE_01': {
          min: Math.min(...analogData2.map(d => d.value)),
          max: Math.max(...analogData2.map(d => d.value)),
          average: analogData2.reduce((sum, d) => sum + d.value, 0) / analogData2.length,
          standardDeviation: 10,
          count: analogData2.length,
          dataQuality: 100
        }
      },
      generatedAt: new Date()
    };
    
    const result1 = await reportGenerationService.generateReport(reportData1);
    
    if (result1.success && result1.filePath) {
      console.log('✓ Test 1 passed');
      console.log(`  Report generated: ${result1.filePath}`);
      console.log(`  Pages: ${result1.metadata.pages}`);
      console.log(`  File size: ${(result1.metadata.fileSize / 1024).toFixed(2)} KB`);
      console.log(`  Generation time: ${result1.metadata.generationTime}ms\n`);
    } else {
      console.log('✗ Test 1 failed:', result1.error);
    }
    
    // Test 2: Report with mixed analog and digital tags
    console.log('Test 2: Generating report with mixed analog and digital tags...');
    
    const analogData3 = generateTestData('FLOW_01', 80, 50, 8);
    const digitalData1 = generateDigitalData('PUMP_STATUS', 80);
    
    const reportData2 = {
      config: {
        id: 'test-report-2',
        name: 'Analytics Integration Test - Mixed Tags',
        description: 'Test report with both analog and digital tags',
        tags: ['FLOW_01', 'PUMP_STATUS'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-01T01:30:00Z')
        },
        chartTypes: ['line' as const],
        template: 'default',
        format: 'pdf' as const,
        specificationLimits: {
          'FLOW_01': { lsl: 35, usl: 65 }
        },
        includeSPCCharts: true,
        includeTrendLines: true,
        includeStatsSummary: true
      },
      data: {
        'FLOW_01': analogData3,
        'PUMP_STATUS': digitalData1
      },
      statistics: {
        'FLOW_01': {
          min: Math.min(...analogData3.map(d => d.value)),
          max: Math.max(...analogData3.map(d => d.value)),
          average: analogData3.reduce((sum, d) => sum + d.value, 0) / analogData3.length,
          standardDeviation: 8,
          count: analogData3.length,
          dataQuality: 100
        },
        'PUMP_STATUS': {
          min: 0,
          max: 1,
          average: digitalData1.reduce((sum, d) => sum + d.value, 0) / digitalData1.length,
          standardDeviation: 0.5,
          count: digitalData1.length,
          dataQuality: 100
        }
      },
      generatedAt: new Date()
    };
    
    const result2 = await reportGenerationService.generateReport(reportData2);
    
    if (result2.success && result2.filePath) {
      console.log('✓ Test 2 passed');
      console.log(`  Report generated: ${result2.filePath}`);
      console.log(`  Pages: ${result2.metadata.pages}`);
      console.log(`  File size: ${(result2.metadata.fileSize / 1024).toFixed(2)} KB`);
      console.log(`  Generation time: ${result2.metadata.generationTime}ms\n`);
    } else {
      console.log('✗ Test 2 failed:', result2.error);
    }
    
    // Test 3: Report without spec limits (no SPC charts)
    console.log('Test 3: Generating report without spec limits...');
    
    const analogData4 = generateTestData('LEVEL_01', 60, 120, 15);
    
    const reportData3 = {
      config: {
        id: 'test-report-3',
        name: 'Analytics Integration Test - No Spec Limits',
        description: 'Test report with trend lines but no SPC charts',
        tags: ['LEVEL_01'],
        timeRange: {
          startTime: new Date('2024-01-01T00:00:00Z'),
          endTime: new Date('2024-01-01T01:00:00Z')
        },
        chartTypes: ['line' as const],
        template: 'default',
        format: 'pdf' as const,
        includeSPCCharts: true,
        includeTrendLines: true,
        includeStatsSummary: true
      },
      data: {
        'LEVEL_01': analogData4
      },
      statistics: {
        'LEVEL_01': {
          min: Math.min(...analogData4.map(d => d.value)),
          max: Math.max(...analogData4.map(d => d.value)),
          average: analogData4.reduce((sum, d) => sum + d.value, 0) / analogData4.length,
          standardDeviation: 15,
          count: analogData4.length,
          dataQuality: 100
        }
      },
      generatedAt: new Date()
    };
    
    const result3 = await reportGenerationService.generateReport(reportData3);
    
    if (result3.success && result3.filePath) {
      console.log('✓ Test 3 passed');
      console.log(`  Report generated: ${result3.filePath}`);
      console.log(`  Pages: ${result3.metadata.pages}`);
      console.log(`  File size: ${(result3.metadata.fileSize / 1024).toFixed(2)} KB`);
      console.log(`  Generation time: ${result3.metadata.generationTime}ms\n`);
    } else {
      console.log('✗ Test 3 failed:', result3.error);
    }
    
    console.log('=== All Tests Completed ===');
    console.log('\nGenerated reports can be found in the reports/ directory');
    
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
