/**
 * Integration test for analytics integration in report generation
 * Tests the complete flow: tag classification → analytics calculation → chart generation → PDF
 */

import { reportGenerationService } from '../../src/services/reportGeneration';
import { TimeSeriesData } from '../../src/types/historian';

describe('Analytics Integration in Report Generation', () => {
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

  it('should generate report with analog tags, trend lines, and SPC charts', async () => {
    const analogData1 = generateTestData('TEMP_01', 100, 75, 5, [10, 25, 40]);
    const analogData2 = generateTestData('PRESSURE_01', 100, 100, 10, [15, 30]);
    
    const reportData = {
      config: {
        id: 'test-analytics-1',
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
    
    const result = await reportGenerationService.generateReport(reportData);
    
    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();
    expect(result.metadata.pages).toBeGreaterThan(0);
    expect(result.metadata.fileSize).toBeGreaterThan(0);
    expect(result.buffer).toBeDefined();
  }, 30000); // 30 second timeout

  it('should generate report with mixed analog and digital tags', async () => {
    const analogData = generateTestData('FLOW_01', 80, 50, 8);
    const digitalData = generateDigitalData('PUMP_STATUS', 80);
    
    const reportData = {
      config: {
        id: 'test-analytics-2',
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
        'FLOW_01': analogData,
        'PUMP_STATUS': digitalData
      },
      statistics: {
        'FLOW_01': {
          min: Math.min(...analogData.map(d => d.value)),
          max: Math.max(...analogData.map(d => d.value)),
          average: analogData.reduce((sum, d) => sum + d.value, 0) / analogData.length,
          standardDeviation: 8,
          count: analogData.length,
          dataQuality: 100
        },
        'PUMP_STATUS': {
          min: 0,
          max: 1,
          average: digitalData.reduce((sum, d) => sum + d.value, 0) / digitalData.length,
          standardDeviation: 0.5,
          count: digitalData.length,
          dataQuality: 100
        }
      },
      generatedAt: new Date()
    };
    
    const result = await reportGenerationService.generateReport(reportData);
    
    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();
    expect(result.metadata.pages).toBeGreaterThan(0);
    // Digital tags should not have SPC charts, only analog tags
  }, 30000);

  it('should generate report with trend lines but no SPC charts when spec limits not provided', async () => {
    const analogData = generateTestData('LEVEL_01', 60, 120, 15);
    
    const reportData = {
      config: {
        id: 'test-analytics-3',
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
        'LEVEL_01': analogData
      },
      statistics: {
        'LEVEL_01': {
          min: Math.min(...analogData.map(d => d.value)),
          max: Math.max(...analogData.map(d => d.value)),
          average: analogData.reduce((sum, d) => sum + d.value, 0) / analogData.length,
          standardDeviation: 15,
          count: analogData.length,
          dataQuality: 100
        }
      },
      generatedAt: new Date()
    };
    
    const result = await reportGenerationService.generateReport(reportData);
    
    expect(result.success).toBe(true);
    expect(result.filePath).toBeDefined();
    expect(result.metadata.pages).toBeGreaterThan(0);
    // Should have trend lines but no SPC charts (no spec limits provided)
  }, 30000);
});
