/**
 * Integration tests for export/import API endpoints
 * 
 * Tests the POST /api/reports/export and POST /api/reports/import endpoints
 * to ensure they correctly handle report configuration export and import operations.
 */

import request from 'supertest';
import express from 'express';
import reportsRouter from '../../src/routes/reports';
import { ReportConfig } from '../../src/types/reports';

// Mock authentication middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user', username: 'testuser' };
    next();
  },
  requirePermission: () => (req: any, res: any, next: any) => next(),
}));

// Mock error handler
import { errorHandler } from '../../src/middleware/errorHandler';

// Create test app
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/api/reports', reportsRouter);
app.use(errorHandler); // Add error handler middleware

describe('Export/Import API Integration Tests', () => {
  // Sample report configuration for testing
  const sampleConfig: ReportConfig = {
    name: 'Test Report',
    description: 'Test report for export/import',
    tags: ['Tag1', 'Tag2', 'Tag3'],
    timeRange: {
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-02T00:00:00Z'),
    },
    chartTypes: ['line'],
    template: 'default',
    format: 'pdf',
    filters: [],
    includeSPCCharts: false,
    includeTrendLines: true,
    includeStatsSummary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('POST /api/reports/export', () => {
    it('should export configuration to JSON format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          config: sampleConfig,
          format: 'json',
        })
        .expect(200);

      // Check response headers
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toMatch(/^attachment; filename="ReportConfig_/);
      expect(response.headers['cache-control']).toBe('no-cache');

      // Parse response body as JSON
      const exportedData = JSON.parse(response.text);

      // Verify structure
      expect(exportedData).toHaveProperty('schemaVersion');
      expect(exportedData).toHaveProperty('exportMetadata');
      expect(exportedData).toHaveProperty('reportConfig');
      expect(exportedData.reportConfig.tags).toEqual(['Tag1', 'Tag2', 'Tag3']);
    });

    it('should export configuration to Power BI format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          config: sampleConfig,
          format: 'powerbi',
        })
        .expect(200);

      // Check response headers
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.headers['content-disposition']).toMatch(/^attachment; filename="PowerBI_/);

      // Verify M Query content
      expect(response.text).toContain('let');
      expect(response.text).toContain('Server =');
      expect(response.text).toContain('Database =');
      expect(response.text).toContain('Tag1');
      expect(response.text).toContain('Tag2');
      expect(response.text).toContain('Tag3');
    });

    it('should return 400 for missing config', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          format: 'json',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('configuration is required');
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          config: sampleConfig,
          format: 'invalid',
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Invalid export format');
    });

    it('should return 400 for missing format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          config: sampleConfig,
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/reports/import', () => {
    let exportedJSON: string;

    beforeAll(async () => {
      // Export a configuration to use for import tests
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          config: sampleConfig,
          format: 'json',
        });

      exportedJSON = response.text;
    });

    it('should import valid JSON configuration', async () => {
      const response = await request(app)
        .post('/api/reports/import')
        .send({
          fileContent: exportedJSON,
        })
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('tags');
      expect(response.body.data.tags).toEqual(['Tag1', 'Tag2', 'Tag3']);
    });

    it('should return validation errors for invalid JSON', async () => {
      const response = await request(app)
        .post('/api/reports/import')
        .send({
          fileContent: 'invalid json {',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('validationErrors');
      expect(response.body.error.validationErrors[0].code).toBe('INVALID_JSON');
    });

    it('should return validation errors for missing required fields', async () => {
      const invalidConfig = {
        schemaVersion: '1.0.0',
        reportConfig: {
          // Missing required fields
        },
      };

      const response = await request(app)
        .post('/api/reports/import')
        .send({
          fileContent: JSON.stringify(invalidConfig),
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.validationErrors.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing fileContent', async () => {
      const response = await request(app)
        .post('/api/reports/import')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('File content is required');
    });

    it('should return 400 for non-string fileContent', async () => {
      const response = await request(app)
        .post('/api/reports/import')
        .send({
          fileContent: { invalid: 'object' },
        })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Export/Import Round-Trip', () => {
    it('should successfully export and re-import a configuration', async () => {
      // Step 1: Export
      const exportResponse = await request(app)
        .post('/api/reports/export')
        .send({
          config: sampleConfig,
          format: 'json',
        })
        .expect(200);

      const exportedJSON = exportResponse.text;

      // Step 2: Import
      const importResponse = await request(app)
        .post('/api/reports/import')
        .send({
          fileContent: exportedJSON,
        })
        .expect(200);

      // Step 3: Verify data integrity
      const importedConfig = importResponse.body.data;

      expect(importedConfig.tags).toEqual(sampleConfig.tags);
      expect(importedConfig.name).toBe(sampleConfig.name);
      expect(importedConfig.description).toBe(sampleConfig.description);
      expect(importedConfig.includeTrendLines).toBe(sampleConfig.includeTrendLines);
      expect(importedConfig.includeSPCCharts).toBe(sampleConfig.includeSPCCharts);
      expect(importedConfig.includeStatsSummary).toBe(sampleConfig.includeStatsSummary);

      // Verify time range (dates should be preserved)
      expect(new Date(importedConfig.timeRange.startTime).getTime()).toBe(
        sampleConfig.timeRange.startTime.getTime()
      );
      expect(new Date(importedConfig.timeRange.endTime).getTime()).toBe(
        sampleConfig.timeRange.endTime.getTime()
      );
    });
  });
});
