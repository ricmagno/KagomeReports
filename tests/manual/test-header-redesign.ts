/**
 * Manual test for PDF header redesign
 * This test generates a sample PDF to verify the new header design
 */

import { reportGenerationService } from '../../src/services/reportGeneration';
import { ReportData, ReportConfig } from '../../src/services/reportGeneration';

async function testHeaderRedesign() {
  console.log('Testing PDF header redesign...');

  // Create a minimal test report configuration
  const config: ReportConfig = {
    id: 'test-header-redesign',
    name: 'Header Redesign Test Report',
    description: 'Testing the new Kagome-branded header design',
    tags: ['TestTag1'],
    timeRange: {
      startTime: new Date('2024-01-01T00:00:00Z'),
      endTime: new Date('2024-01-01T01:00:00Z')
    },
    chartTypes: [],
    template: 'default',
    format: 'pdf' as const
  };

  // Create minimal test data
  const reportData: ReportData = {
    config,
    data: {
      'TestTag1': [
        {
          timestamp: new Date('2024-01-01T00:00:00Z'),
          value: 100,
          quality: 192
        },
        {
          timestamp: new Date('2024-01-01T00:30:00Z'),
          value: 105,
          quality: 192
        },
        {
          timestamp: new Date('2024-01-01T01:00:00Z'),
          value: 110,
          quality: 192
        }
      ]
    },
    statistics: {
      'TestTag1': {
        min: 100,
        max: 110,
        average: 105,
        standardDeviation: 5,
        dataQuality: 100,
        count: 3
      }
    },
    generatedAt: new Date()
  };

  try {
    const result = await reportGenerationService.generateReport(reportData);

    if (result.success) {
      console.log('✓ PDF generated successfully!');
      console.log(`  File: ${result.filePath}`);
      console.log(`  Pages: ${result.metadata.pages}`);
      console.log(`  Size: ${(result.metadata.fileSize / 1024).toFixed(2)} KB`);
      console.log(`  Generation time: ${result.metadata.generationTime}ms`);
      console.log('\nPlease open the PDF to verify:');
      console.log('  1. Header has no colored background');
      console.log('  2. "Kagome" appears as company name in dark gray');
      console.log('  3. "Historian Reports" appears as subtitle in medium gray');
      console.log('  4. Horizontal line separates header from content');
      console.log('  5. All text is grayscale (no blue background)');
    } else {
      console.error('✗ PDF generation failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('✗ Test failed with error:', error);
    process.exit(1);
  }
}

// Run the test
testHeaderRedesign().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
