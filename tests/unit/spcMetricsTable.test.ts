/**
 * Unit tests for SPC Metrics Summary Table generation
 * Tests the generateSPCMetricsTable function in report generation service
 */

import PDFDocument from 'pdfkit';
import { SPCMetricsSummary } from '@/types/historian';
import { reportGenerationService } from '@/services/reportGeneration';

describe('SPC Metrics Summary Table', () => {
  describe('addSPCMetricsTable', () => {
    let doc: PDFKit.PDFDocument;

    beforeEach(() => {
      doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 60, left: 40, right: 40 }
      });
    });

    afterEach(() => {
      if (doc) {
        doc.end();
      }
    });

    it('should handle empty metrics array', () => {
      const metrics: SPCMetricsSummary[] = [];
      
      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle null metrics', () => {
      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, null);
      }).not.toThrow();
    });

    it('should render table with single metric', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 50.5,
          stdDev: 2.3,
          lsl: 45.0,
          usl: 55.0,
          cp: 1.45,
          cpk: 1.39,
          capability: 'Capable'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should render table with multiple metrics', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 50.5,
          stdDev: 2.3,
          lsl: 45.0,
          usl: 55.0,
          cp: 1.45,
          cpk: 1.39,
          capability: 'Capable'
        },
        {
          tagName: 'TAG002',
          mean: 100.2,
          stdDev: 5.1,
          lsl: 90.0,
          usl: 110.0,
          cp: 0.98,
          cpk: 0.95,
          capability: 'Marginal'
        },
        {
          tagName: 'TAG003',
          mean: 75.8,
          stdDev: 8.2,
          lsl: 60.0,
          usl: 90.0,
          cp: 0.61,
          cpk: 0.58,
          capability: 'Not Capable'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle metrics with null spec limits', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 50.5,
          stdDev: 2.3,
          lsl: null,
          usl: null,
          cp: null,
          cpk: null,
          capability: 'N/A'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle metrics with partial spec limits', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 50.5,
          stdDev: 2.3,
          lsl: 45.0,
          usl: null,
          cp: null,
          cpk: null,
          capability: 'N/A'
        },
        {
          tagName: 'TAG002',
          mean: 100.2,
          stdDev: 5.1,
          lsl: null,
          usl: 110.0,
          cp: null,
          cpk: null,
          capability: 'N/A'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle long tag names', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'VERY_LONG_TAG_NAME_THAT_MIGHT_OVERFLOW_THE_COLUMN',
          mean: 50.5,
          stdDev: 2.3,
          lsl: 45.0,
          usl: 55.0,
          cp: 1.45,
          cpk: 1.39,
          capability: 'Capable'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle extreme numeric values', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 999999.99,
          stdDev: 0.01,
          lsl: -999999.99,
          usl: 999999.99,
          cp: 9999.99,
          cpk: 9999.99,
          capability: 'Capable'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle all capability levels', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG_CAPABLE',
          mean: 50.0,
          stdDev: 2.0,
          lsl: 40.0,
          usl: 60.0,
          cp: 1.67,
          cpk: 1.67,
          capability: 'Capable'
        },
        {
          tagName: 'TAG_MARGINAL',
          mean: 50.0,
          stdDev: 2.5,
          lsl: 40.0,
          usl: 60.0,
          cp: 1.33,
          cpk: 1.20,
          capability: 'Marginal'
        },
        {
          tagName: 'TAG_NOT_CAPABLE',
          mean: 50.0,
          stdDev: 4.0,
          lsl: 40.0,
          usl: 60.0,
          cp: 0.83,
          cpk: 0.83,
          capability: 'Not Capable'
        },
        {
          tagName: 'TAG_NA',
          mean: 50.0,
          stdDev: 2.0,
          lsl: null,
          usl: null,
          cp: null,
          cpk: null,
          capability: 'N/A'
        }
      ];

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should handle many metrics (page break scenario)', () => {
      const metrics: SPCMetricsSummary[] = [];
      
      // Create 50 metrics to test page breaks
      for (let i = 1; i <= 50; i++) {
        metrics.push({
          tagName: `TAG${String(i).padStart(3, '0')}`,
          mean: 50.0 + i,
          stdDev: 2.0 + (i * 0.1),
          lsl: 40.0,
          usl: 60.0,
          cp: 1.5 - (i * 0.01),
          cpk: 1.4 - (i * 0.01),
          capability: i % 3 === 0 ? 'Capable' : i % 3 === 1 ? 'Marginal' : 'Not Capable'
        });
      }

      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should format numeric values to 2 decimal places', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 50.123456,
          stdDev: 2.987654,
          lsl: 45.111111,
          usl: 55.999999,
          cp: 1.456789,
          cpk: 1.398765,
          capability: 'Capable'
        }
      ];

      // This test verifies the function doesn't throw
      // Actual formatting verification would require PDF parsing
      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });

    it('should display N/A for null values', () => {
      const metrics: SPCMetricsSummary[] = [
        {
          tagName: 'TAG001',
          mean: 50.5,
          stdDev: 2.3,
          lsl: null,
          usl: null,
          cp: null,
          cpk: null,
          capability: 'N/A'
        }
      ];

      // This test verifies the function doesn't throw
      // Actual N/A display verification would require PDF parsing
      expect(() => {
        (reportGenerationService as any).addSPCMetricsTable(doc, metrics);
      }).not.toThrow();
    });
  });
});
