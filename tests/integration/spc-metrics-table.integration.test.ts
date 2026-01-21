/**
 * Integration tests for SPC Metrics Summary Table in PDF reports
 * Tests the complete flow of generating a PDF with SPC metrics table
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { SPCMetricsSummary } from '@/types/historian';
import { reportGenerationService } from '@/services/reportGeneration';

describe('SPC Metrics Table Integration', () => {
  const testOutputDir = path.join(process.cwd(), 'reports', 'test');

  beforeAll(() => {
    // Ensure test output directory exists
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test files
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      files.forEach(file => {
        if (file.startsWith('spc-metrics-table-test')) {
          fs.unlinkSync(path.join(testOutputDir, file));
        }
      });
    }
  });

  it('should generate PDF with SPC metrics table', (done) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 60, left: 40, right: 40 }
    });

    const outputPath = path.join(testOutputDir, 'spc-metrics-table-test-basic.pdf');
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Add title
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('SPC Metrics Table Integration Test', { align: 'center' });

    doc.moveDown(2);

    // Create sample metrics
    const metrics: SPCMetricsSummary[] = [
      {
        tagName: 'Temperature_Sensor_01',
        mean: 75.5,
        stdDev: 2.3,
        lsl: 70.0,
        usl: 80.0,
        cp: 1.45,
        cpk: 1.39,
        capability: 'Capable'
      },
      {
        tagName: 'Pressure_Sensor_02',
        mean: 100.2,
        stdDev: 5.1,
        lsl: 90.0,
        usl: 110.0,
        cp: 0.98,
        cpk: 0.95,
        capability: 'Marginal'
      },
      {
        tagName: 'Flow_Meter_03',
        mean: 45.8,
        stdDev: 8.2,
        lsl: 30.0,
        usl: 60.0,
        cp: 0.61,
        cpk: 0.58,
        capability: 'Not Capable'
      },
      {
        tagName: 'Level_Sensor_04',
        mean: 50.0,
        stdDev: 3.5,
        lsl: null,
        usl: null,
        cp: null,
        cpk: null,
        capability: 'N/A'
      }
    ];

    // Add SPC metrics table
    (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

    doc.end();

    writeStream.on('finish', () => {
      // Verify file was created
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file has content
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      done();
    });

    writeStream.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should generate PDF with large SPC metrics table (page breaks)', (done) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 60, left: 40, right: 40 }
    });

    const outputPath = path.join(testOutputDir, 'spc-metrics-table-test-large.pdf');
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Add title
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('SPC Metrics Table - Large Dataset Test', { align: 'center' });

    doc.moveDown(2);

    // Create many metrics to test page breaks
    const metrics: SPCMetricsSummary[] = [];
    for (let i = 1; i <= 50; i++) {
      metrics.push({
        tagName: `TAG_${String(i).padStart(3, '0')}`,
        mean: 50.0 + i,
        stdDev: 2.0 + (i * 0.1),
        lsl: 40.0,
        usl: 60.0,
        cp: 1.5 - (i * 0.01),
        cpk: 1.4 - (i * 0.01),
        capability: i % 3 === 0 ? 'Capable' : i % 3 === 1 ? 'Marginal' : 'Not Capable'
      });
    }

    // Add SPC metrics table
    (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

    doc.end();

    writeStream.on('finish', () => {
      // Verify file was created
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file has content
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      done();
    });

    writeStream.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should generate PDF with mixed capability levels', (done) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 60, left: 40, right: 40 }
    });

    const outputPath = path.join(testOutputDir, 'spc-metrics-table-test-mixed.pdf');
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Add title
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('SPC Metrics Table - Mixed Capabilities', { align: 'center' });

    doc.moveDown(2);

    // Create metrics with all capability levels
    const metrics: SPCMetricsSummary[] = [
      {
        tagName: 'Highly_Capable_Process',
        mean: 50.0,
        stdDev: 1.5,
        lsl: 40.0,
        usl: 60.0,
        cp: 2.22,
        cpk: 2.22,
        capability: 'Capable'
      },
      {
        tagName: 'Barely_Capable_Process',
        mean: 50.0,
        stdDev: 2.5,
        lsl: 40.0,
        usl: 60.0,
        cp: 1.33,
        cpk: 1.33,
        capability: 'Capable'
      },
      {
        tagName: 'Marginal_Process_Upper',
        mean: 50.0,
        stdDev: 3.0,
        lsl: 40.0,
        usl: 60.0,
        cp: 1.11,
        cpk: 1.11,
        capability: 'Marginal'
      },
      {
        tagName: 'Marginal_Process_Lower',
        mean: 50.0,
        stdDev: 3.3,
        lsl: 40.0,
        usl: 60.0,
        cp: 1.01,
        cpk: 1.01,
        capability: 'Marginal'
      },
      {
        tagName: 'Not_Capable_Process',
        mean: 50.0,
        stdDev: 4.0,
        lsl: 40.0,
        usl: 60.0,
        cp: 0.83,
        cpk: 0.83,
        capability: 'Not Capable'
      },
      {
        tagName: 'No_Spec_Limits_Process',
        mean: 50.0,
        stdDev: 2.0,
        lsl: null,
        usl: null,
        cp: null,
        cpk: null,
        capability: 'N/A'
      },
      {
        tagName: 'Partial_Spec_LSL_Only',
        mean: 50.0,
        stdDev: 2.0,
        lsl: 40.0,
        usl: null,
        cp: null,
        cpk: null,
        capability: 'N/A'
      },
      {
        tagName: 'Partial_Spec_USL_Only',
        mean: 50.0,
        stdDev: 2.0,
        lsl: null,
        usl: 60.0,
        cp: null,
        cpk: null,
        capability: 'N/A'
      }
    ];

    // Add SPC metrics table
    (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

    doc.end();

    writeStream.on('finish', () => {
      // Verify file was created
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file has content
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      done();
    });

    writeStream.on('error', (error) => {
      done(error);
    });
  }, 10000);

  it('should handle empty metrics gracefully', (done) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 60, left: 40, right: 40 }
    });

    const outputPath = path.join(testOutputDir, 'spc-metrics-table-test-empty.pdf');
    const writeStream = fs.createWriteStream(outputPath);

    doc.pipe(writeStream);

    // Add title
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('SPC Metrics Table - Empty Test', { align: 'center' });

    doc.moveDown(2);

    // Add text before empty table
    doc.fontSize(12)
      .font('Helvetica')
      .text('This document should not have an SPC metrics table (empty array).');

    // Try to add empty metrics table
    const metrics: SPCMetricsSummary[] = [];
    (reportGenerationService as any).addSPCMetricsTable(doc, metrics);

    // Add text after empty table
    doc.text('If you see this text, the empty table was handled correctly.');

    doc.end();

    writeStream.on('finish', () => {
      // Verify file was created
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file has content
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      done();
    });

    writeStream.on('error', (error) => {
      done(error);
    });
  }, 10000);
});
