/**
 * Manual test for trend line chart generation
 * 
 * This test generates a sample PDF report with trend lines to verify:
 * - Trend lines are displayed on charts
 * - Trend equations and R² values are shown in legend
 * - Statistical summaries are displayed
 * - Weak fit indicator (R² < 0.3) is shown
 * - Grayscale compatibility for printing
 */

import { chartGenerationService } from '../../src/services/chartGeneration';
import { TimeSeriesData } from '../../src/types/historian';
import fs from 'fs';
import path from 'path';

async function testTrendLineCharts() {
  console.log('Testing trend line chart generation...\n');

  // Create test data with a clear linear trend
  const linearData: TimeSeriesData[] = [];
  const startTime = new Date('2024-01-01T00:00:00Z');
  
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60000); // 1 minute intervals
    const value = 50 + i * 0.5 + (Math.random() - 0.5) * 2; // Linear trend with small noise
    linearData.push({
      timestamp,
      value,
      quality: 192,
      tagName: 'TEMP_SENSOR_01'
    });
  }

  // Create test data with weak trend (high noise)
  const noisyData: TimeSeriesData[] = [];
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60000);
    const value = 100 + (Math.random() - 0.5) * 50; // High noise, weak trend
    noisyData.push({
      timestamp,
      value,
      quality: 192,
      tagName: 'PRESSURE_SENSOR_02'
    });
  }

  // Create test data with perfect linear trend
  const perfectData: TimeSeriesData[] = [];
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(startTime.getTime() + i * 60000);
    const value = 25 + i * 1.0; // Perfect linear trend
    perfectData.push({
      timestamp,
      value,
      quality: 192,
      tagName: 'FLOW_METER_03'
    });
  }

  try {
    // Test 1: Chart with good trend line (R² should be high)
    console.log('Test 1: Generating chart with strong linear trend...');
    const chart1 = await chartGenerationService.generateReportCharts(
      { 'TEMP_SENSOR_01': linearData },
      undefined,
      undefined,
      ['line']
    );
    
    const outputDir = path.join(process.cwd(), 'reports', 'test-charts');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(outputDir, 'trend-line-strong.png'),
      chart1['TEMP_SENSOR_01_line']!
    );
    console.log('✓ Chart with strong trend saved to reports/test-charts/trend-line-strong.png\n');

    // Test 2: Chart with weak trend line (R² should be low, warning indicator)
    console.log('Test 2: Generating chart with weak trend (high noise)...');
    const chart2 = await chartGenerationService.generateReportCharts(
      { 'PRESSURE_SENSOR_02': noisyData },
      undefined,
      undefined,
      ['line']
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'trend-line-weak.png'),
      chart2['PRESSURE_SENSOR_02_line']!
    );
    console.log('✓ Chart with weak trend saved to reports/test-charts/trend-line-weak.png');
    console.log('  (Should show ⚠ indicator for R² < 0.3)\n');

    // Test 3: Chart with perfect trend line (R² = 1.0)
    console.log('Test 3: Generating chart with perfect linear trend...');
    const chart3 = await chartGenerationService.generateReportCharts(
      { 'FLOW_METER_03': perfectData },
      undefined,
      undefined,
      ['line']
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'trend-line-perfect.png'),
      chart3['FLOW_METER_03_line']!
    );
    console.log('✓ Chart with perfect trend saved to reports/test-charts/trend-line-perfect.png');
    console.log('  (Should show R² = 1.000)\n');

    // Test 4: Digital tag (should not have trend line)
    console.log('Test 4: Generating chart for digital tag (binary data)...');
    const digitalData: TimeSeriesData[] = [];
    for (let i = 0; i < 50; i++) {
      const timestamp = new Date(startTime.getTime() + i * 60000);
      const value = i % 2; // Binary 0/1 pattern
      digitalData.push({
        timestamp,
        value,
        quality: 192,
        tagName: 'PUMP_STATUS'
      });
    }
    
    const chart4 = await chartGenerationService.generateReportCharts(
      { 'PUMP_STATUS': digitalData },
      undefined,
      undefined,
      ['line']
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'digital-tag-no-trend.png'),
      chart4['PUMP_STATUS_line']!
    );
    console.log('✓ Digital tag chart saved to reports/test-charts/digital-tag-no-trend.png');
    console.log('  (Should NOT show trend line)\n');

    console.log('All tests completed successfully!');
    console.log('\nVerification checklist:');
    console.log('1. Strong trend chart should show trend line with high R² (> 0.8)');
    console.log('2. Weak trend chart should show trend line with low R² and ⚠ indicator');
    console.log('3. Perfect trend chart should show R² = 1.000');
    console.log('4. Digital tag chart should NOT show trend line');
    console.log('5. All charts should display statistical summary (Min, Max, Avg, StdDev)');
    console.log('6. All charts should be in grayscale for printing');
    console.log('\nPlease review the generated charts in reports/test-charts/');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testTrendLineCharts().catch(console.error);
