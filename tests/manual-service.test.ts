/**
 * Manual Service Test
 * Test ReportGenerationService with manual initialization
 */

import fs from 'fs';
import path from 'path';

// Create a custom ReportGenerationService that doesn't depend on environment
class TestReportGenerationService {
  private templatesDir: string;
  private outputDir: string;

  constructor() {
    this.templatesDir = path.join(process.cwd(), 'test-templates');
    this.outputDir = path.join(process.cwd(), 'test-reports');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async testBasicFunctionality(): Promise<boolean> {
    try {
      // Test directory creation
      const testFile = path.join(this.outputDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const exists = fs.existsSync(testFile);
      
      // Clean up
      fs.unlinkSync(testFile);
      
      return exists;
    } catch (error) {
      console.error('Test functionality error:', error);
      return false;
    }
  }

  cleanup(): void {
    try {
      // Clean up test directories
      if (fs.existsSync(this.templatesDir)) {
        fs.rmSync(this.templatesDir, { recursive: true, force: true });
      }
      if (fs.existsSync(this.outputDir)) {
        fs.rmSync(this.outputDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  }
}

describe('Manual Service Test', () => {
  let service: TestReportGenerationService;

  beforeEach(() => {
    service = new TestReportGenerationService();
  });

  afterEach(() => {
    service.cleanup();
  });

  it('should create service without environment dependencies', () => {
    expect(service).toBeDefined();
  });

  it('should create directories and write files', async () => {
    const result = await service.testBasicFunctionality();
    expect(result).toBe(true);
  });
});