/**
 * Manual test for SPC chart generation
 * Run with: npx ts-node tests/manual/test-spc-chart-generation.ts
 */

import { chartGenerationService } from '../../src/services/chartGeneration';
import { TimeSeriesData } from '../../src/types/historian';
import * as fs from 'fs';
import * as path from 'path';

async function testSPCChartGeneration() {
  console.log('Testing SPC Chart Generation...\n');

  // Generate test data with some out-of-control points
  const now = new Date();
  const data: TimeSeriesData[] = [];
  const mean = 100;
  const stdDev = 5;
  
  // Generate 50 data points
  for (let i = 0; i < 50; i++) {
    const timestamp = new Date(now.getTime() + i * 60000); // 1 minute intervals
    let value: number;
    
    // Add some out-of-control points (beyond 3 sigma)
    if (i === 10 || i === 25 || i === 40) {
      // Out of control high
      value = mean + 4 * stdDev;
    } else if (i === 15 || i === 35) {
      // Out of control low
      value = mean - 4 * stdDev;
    } else {
      // Normal variation within control limits
      value = mean + (Math.random() - 0.5) * 2 * stdDev;
    }
    
    data.push({
      timestamp,
      value,
      quality: 192,
      tagName: 'TEST_TAG_001'
    });
  }

  // Calculate SPC metrics
  const values = data.map(d => d.value);
  const calculatedMean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - calculatedMean, 2), 0) / (values.length - 1);
  const calculatedStdDev = Math.sqrt(variance);
  const ucl = calculatedMean + 3 * calculatedStdDev;
  const lcl = calculatedMean - 3 * calculatedStdDev;
  
  // Identify out-of-control points
  const outOfControlPoints: number[] = [];
  data.forEach((d, index) => {
    if (d.value > ucl || d.value < lcl) {
      outOfControlPoints.push(index);
    }
  });

  const spcMetrics = {
    mean: Number(calculatedMean.toFixed(2)),
    stdDev: Number(calculatedStdDev.toFixed(2)),
    ucl: Number(ucl.toFixed(2)),
    lcl: Number(lcl.toFixed(2)),
    cp: 1.33,
    cpk: 1.15,
    outOfControlPoints
  };

  const specLimits = {
    lsl: 80,
    usl: 120
  };

  console.log('Test Data Summary:');
  console.log(`  Data points: ${data.length}`);
  console.log(`  Mean: ${spcMetrics.mean}`);
  console.log(`  Std Dev: ${spcMetrics.stdDev}`);
  console.log(`  UCL: ${spcMetrics.ucl}`);
  console.log(`  LCL: ${spcMetrics.lcl}`);
  console.log(`  Out-of-control points: ${outOfControlPoints.length}`);
  console.log(`  Specification limits: LSL=${specLimits.lsl}, USL=${specLimits.usl}`);
  console.log(`  Cp: ${spcMetrics.cp}, Cpk: ${spcMetrics.cpk}\n`);

  try {
    // Test 1: SPC chart with specification limits
    console.log('Test 1: Generating SPC chart with specification limits...');
    const buffer1 = await chartGenerationService.generateSPCChart(
      'TEST_TAG_001',
      data,
      spcMetrics,
      specLimits,
      { title: 'SPC Chart with Spec Limits' }
    );
    
    const outputPath1 = path.join(__dirname, '../../reports/test-spc-chart-with-specs.png');
    fs.writeFileSync(outputPath1, buffer1);
    console.log(`✓ SPC chart with spec limits saved to: ${outputPath1}`);
    console.log(`  Buffer size: ${buffer1.length} bytes\n`);

    // Test 2: SPC chart without specification limits
    console.log('Test 2: Generating SPC chart without specification limits...');
    const spcMetricsNoSpecs = {
      ...spcMetrics,
      cp: null,
      cpk: null
    };
    
    const buffer2 = await chartGenerationService.generateSPCChart(
      'TEST_TAG_002',
      data,
      spcMetricsNoSpecs,
      undefined,
      { title: 'SPC Chart without Spec Limits' }
    );
    
    const outputPath2 = path.join(__dirname, '../../reports/test-spc-chart-no-specs.png');
    fs.writeFileSync(outputPath2, buffer2);
    console.log(`✓ SPC chart without spec limits saved to: ${outputPath2}`);
    console.log(`  Buffer size: ${buffer2.length} bytes\n`);

    // Test 3: SPC chart with all points in control
    console.log('Test 3: Generating SPC chart with all points in control...');
    const controlledData: TimeSeriesData[] = [];
    for (let i = 0; i < 30; i++) {
      const timestamp = new Date(now.getTime() + i * 60000);
      const value = mean + (Math.random() - 0.5) * 2 * stdDev; // Within 1 sigma
      controlledData.push({
        timestamp,
        value,
        quality: 192,
        tagName: 'TEST_TAG_003'
      });
    }
    
    const controlledMetrics = {
      mean: 100,
      stdDev: 5,
      ucl: 115,
      lcl: 85,
      cp: 1.67,
      cpk: 1.67,
      outOfControlPoints: []
    };
    
    const buffer3 = await chartGenerationService.generateSPCChart(
      'TEST_TAG_003',
      controlledData,
      controlledMetrics,
      specLimits,
      { title: 'SPC Chart - All Points in Control' }
    );
    
    const outputPath3 = path.join(__dirname, '../../reports/test-spc-chart-controlled.png');
    fs.writeFileSync(outputPath3, buffer3);
    console.log(`✓ SPC chart with controlled process saved to: ${outputPath3}`);
    console.log(`  Buffer size: ${buffer3.length} bytes\n`);

    console.log('✅ All SPC chart generation tests passed!');
    console.log('\nGenerated files:');
    console.log(`  - ${outputPath1}`);
    console.log(`  - ${outputPath2}`);
    console.log(`  - ${outputPath3}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testSPCChartGeneration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
