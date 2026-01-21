/**
 * Manual test script for SPC Metrics Summary Table
 * Generates sample PDFs with SPC metrics tables for visual verification
 * 
 * Run with: npx ts-node tests/manual/test-spc-metrics-table.ts
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { SPCMetricsSummary } from '../../src/types/historian';
import { reportGenerationService } from '../../src/services/reportGeneration';

const outputDir = path.join(process.cwd(), 'reports', 'manual-tests');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('🧪 SPC Metrics Summary Table Manual Test');
console.log('=========================================\n');

/**
 * Test 1: Basic table with all capability levels
 */
function test1_BasicTable() {
  console.log('Test 1: Basic SPC Metrics Table');
  
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 60, left: 40, right: 40 }
  });

  const outputPath = path.join(outputDir, 'spc-metrics-table-basic.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Add header
  doc.fontSize(24)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('SPC Metrics Summary Table', { align: 'center' });

  doc.moveDown();

  doc.fontSize(14)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text('Test 1: Basic Table with All Capability Levels', { align: 'center' });

  doc.moveDown(2);

  // Create sample metrics
  const metrics: SPCMetricsSummary[] = [
    {
      tagName: 'Temperature_01',
      mean: 75.5,
      stdDev: 2.3,
      lsl: 70.0,
      usl: 80.0,
      cp: 1.45,
      cpk: 1.39,
      capability: 'Capable'
    },
    {
      tagName: 'Pressure_02',
      mean: 100.2,
      stdDev: 5.1,
      lsl: 90.0,
      usl: 110.0,
      cp: 1.15,
      cpk: 1.10,
      capability: 'Marginal'
    },
    {
      tagName: 'Flow_03',
      mean: 45.8,
      stdDev: 8.2,
      lsl: 30.0,
      usl: 60.0,
      cp: 0.61,
      cpk: 0.58,
      capability: 'Not Capable'
    },
    {
      tagName: 'Level_04',
      mean: 50.0,
      stdDev: 3.5,
      lsl: null,
      usl: null,
      cp: null,
      cpk: null,
      capability: 'N/A'
    }
  ];

  (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

  doc.end();

  writeStream.on('finish', () => {
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   File size: ${fs.statSync(outputPath).size} bytes\n`);
  });
}

/**
 * Test 2: Large table with page breaks
 */
function test2_LargeTable() {
  console.log('Test 2: Large Table with Page Breaks');
  
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 60, left: 40, right: 40 }
  });

  const outputPath = path.join(outputDir, 'spc-metrics-table-large.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Add header
  doc.fontSize(24)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('SPC Metrics Summary Table', { align: 'center' });

  doc.moveDown();

  doc.fontSize(14)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text('Test 2: Large Table (50 Tags) with Page Breaks', { align: 'center' });

  doc.moveDown(2);

  // Create many metrics
  const metrics: SPCMetricsSummary[] = [];
  for (let i = 1; i <= 50; i++) {
    const cpValue = 1.5 - (i * 0.02);
    const cpkValue = cpValue - 0.05;
    
    let capability: 'Capable' | 'Marginal' | 'Not Capable' | 'N/A';
    if (cpkValue >= 1.33) {
      capability = 'Capable';
    } else if (cpkValue >= 1.0) {
      capability = 'Marginal';
    } else {
      capability = 'Not Capable';
    }

    metrics.push({
      tagName: `TAG_${String(i).padStart(3, '0')}`,
      mean: 50.0 + (i * 0.5),
      stdDev: 2.0 + (i * 0.05),
      lsl: 40.0,
      usl: 60.0,
      cp: cpValue,
      cpk: cpkValue,
      capability
    });
  }

  (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

  doc.end();

  writeStream.on('finish', () => {
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   File size: ${fs.statSync(outputPath).size} bytes\n`);
  });
}

/**
 * Test 3: Edge cases and special values
 */
function test3_EdgeCases() {
  console.log('Test 3: Edge Cases and Special Values');
  
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 60, left: 40, right: 40 }
  });

  const outputPath = path.join(outputDir, 'spc-metrics-table-edge-cases.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Add header
  doc.fontSize(24)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('SPC Metrics Summary Table', { align: 'center' });

  doc.moveDown();

  doc.fontSize(14)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text('Test 3: Edge Cases and Special Values', { align: 'center' });

  doc.moveDown(2);

  const metrics: SPCMetricsSummary[] = [
    {
      tagName: 'Very_Long_Tag_Name_That_Might_Overflow',
      mean: 50.123456,
      stdDev: 2.987654,
      lsl: 45.111111,
      usl: 55.999999,
      cp: 1.456789,
      cpk: 1.398765,
      capability: 'Capable'
    },
    {
      tagName: 'Extreme_High_Values',
      mean: 999999.99,
      stdDev: 0.01,
      lsl: 999990.00,
      usl: 1000000.00,
      cp: 9999.99,
      cpk: 9999.99,
      capability: 'Capable'
    },
    {
      tagName: 'Extreme_Low_Values',
      mean: 0.001,
      stdDev: 0.0001,
      lsl: 0.0,
      usl: 0.002,
      cp: 3.33,
      cpk: 3.33,
      capability: 'Capable'
    },
    {
      tagName: 'Negative_Values',
      mean: -50.5,
      stdDev: 5.2,
      lsl: -60.0,
      usl: -40.0,
      cp: 0.64,
      cpk: 0.61,
      capability: 'Not Capable'
    },
    {
      tagName: 'Zero_Mean',
      mean: 0.0,
      stdDev: 1.0,
      lsl: -3.0,
      usl: 3.0,
      cp: 1.0,
      cpk: 1.0,
      capability: 'Marginal'
    },
    {
      tagName: 'Only_LSL',
      mean: 50.0,
      stdDev: 2.0,
      lsl: 40.0,
      usl: null,
      cp: null,
      cpk: null,
      capability: 'N/A'
    },
    {
      tagName: 'Only_USL',
      mean: 50.0,
      stdDev: 2.0,
      lsl: null,
      usl: 60.0,
      cp: null,
      cpk: null,
      capability: 'N/A'
    },
    {
      tagName: 'No_Spec_Limits',
      mean: 50.0,
      stdDev: 2.0,
      lsl: null,
      usl: null,
      cp: null,
      cpk: null,
      capability: 'N/A'
    }
  ];

  (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

  doc.end();

  writeStream.on('finish', () => {
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   File size: ${fs.statSync(outputPath).size} bytes\n`);
  });
}

/**
 * Test 4: Real-world industrial scenario
 */
function test4_RealWorldScenario() {
  console.log('Test 4: Real-World Industrial Scenario');
  
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 60, left: 40, right: 40 }
  });

  const outputPath = path.join(outputDir, 'spc-metrics-table-real-world.pdf');
  const writeStream = fs.createWriteStream(outputPath);
  doc.pipe(writeStream);

  // Add header
  doc.fontSize(24)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('Process Capability Report', { align: 'center' });

  doc.moveDown();

  doc.fontSize(14)
    .font('Helvetica')
    .fillColor('#6b7280')
    .text('Manufacturing Line A - Weekly Summary', { align: 'center' });

  doc.fontSize(12)
    .text('Report Date: ' + new Date().toLocaleDateString(), { align: 'center' });

  doc.moveDown(2);

  // Add description
  doc.fontSize(12)
    .fillColor('#111827')
    .font('Helvetica')
    .text('This report summarizes the process capability metrics for all critical process parameters on Manufacturing Line A. ' +
          'Processes marked as "Not Capable" require immediate attention and corrective action.');

  doc.moveDown(1);

  const metrics: SPCMetricsSummary[] = [
    {
      tagName: 'Reactor_Temperature',
      mean: 185.3,
      stdDev: 3.2,
      lsl: 180.0,
      usl: 190.0,
      cp: 1.04,
      cpk: 1.10,
      capability: 'Marginal'
    },
    {
      tagName: 'Reactor_Pressure',
      mean: 45.2,
      stdDev: 1.8,
      lsl: 40.0,
      usl: 50.0,
      cp: 0.93,
      cpk: 0.96,
      capability: 'Not Capable'
    },
    {
      tagName: 'Feed_Flow_Rate',
      mean: 120.5,
      stdDev: 2.1,
      lsl: 115.0,
      usl: 125.0,
      cp: 1.59,
      cpk: 1.43,
      capability: 'Capable'
    },
    {
      tagName: 'Product_Viscosity',
      mean: 850.2,
      stdDev: 15.3,
      lsl: 800.0,
      usl: 900.0,
      cp: 1.09,
      cpk: 1.09,
      capability: 'Marginal'
    },
    {
      tagName: 'pH_Level',
      mean: 7.2,
      stdDev: 0.15,
      lsl: 6.8,
      usl: 7.6,
      cp: 1.78,
      cpk: 1.78,
      capability: 'Capable'
    },
    {
      tagName: 'Cooling_Water_Temp',
      mean: 25.3,
      stdDev: 1.2,
      lsl: 20.0,
      usl: 30.0,
      cp: 1.39,
      cpk: 1.47,
      capability: 'Capable'
    },
    {
      tagName: 'Agitator_Speed',
      mean: 450.0,
      stdDev: 8.5,
      lsl: 430.0,
      usl: 470.0,
      cp: 0.78,
      cpk: 0.78,
      capability: 'Not Capable'
    },
    {
      tagName: 'Product_Density',
      mean: 1.05,
      stdDev: 0.02,
      lsl: 1.00,
      usl: 1.10,
      cp: 1.67,
      cpk: 1.67,
      capability: 'Capable'
    }
  ];

  (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

  // Add summary notes
  doc.moveDown(2);
  doc.fontSize(12)
    .font('Helvetica-Bold')
    .fillColor('#111827')
    .text('Summary:');

  doc.font('Helvetica')
    .text('• 4 processes are Capable (Cpk ≥ 1.33)');
  doc.text('• 2 processes are Marginal (1.0 ≤ Cpk < 1.33)');
  doc.text('• 2 processes are Not Capable (Cpk < 1.0)');

  doc.moveDown();
  doc.text('Action Items:');
  doc.text('1. Investigate Reactor_Pressure - consistently below capability target');
  doc.text('2. Review Agitator_Speed control system - high variability observed');
  doc.text('3. Monitor Reactor_Temperature and Product_Viscosity - approaching limits');

  doc.end();

  writeStream.on('finish', () => {
    console.log(`✅ Generated: ${outputPath}`);
    console.log(`   File size: ${fs.statSync(outputPath).size} bytes\n`);
  });
}

// Run all tests
console.log('Starting test generation...\n');

test1_BasicTable();
setTimeout(() => test2_LargeTable(), 100);
setTimeout(() => test3_EdgeCases(), 200);
setTimeout(() => test4_RealWorldScenario(), 300);

setTimeout(() => {
  console.log('\n✨ All tests completed!');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log('\nPlease review the generated PDFs to verify:');
  console.log('  1. Table headers are properly formatted');
  console.log('  2. Numeric values are rounded to 2 decimal places');
  console.log('  3. "N/A" is displayed for null values');
  console.log('  4. Capability indicators use appropriate grayscale colors');
  console.log('  5. Page breaks work correctly for large tables');
  console.log('  6. Table layout is printer-friendly');
}, 500);
