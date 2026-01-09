/**
 * Debug PDF Generation Test
 * Test to isolate the PDF generation issue
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

describe('Debug PDF Generation', () => {
  it('should create PDF with date handling', (done) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', (error) => {
      console.error('PDF Document error:', error);
      done(error);
    });
    
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
      done();
    });

    try {
      // Test date handling
      const testDate = new Date('2024-01-01T00:00:00Z');
      const dateString = testDate.toLocaleString();
      
      doc.fontSize(20).text('Test PDF Document');
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${dateString}`);
      doc.text(`Test data: ${testDate instanceof Date ? 'Valid Date' : 'Invalid Date'}`);
      
      // Test undefined date handling
      const undefinedDate: any = undefined;
      const safeDateString = undefinedDate instanceof Date 
        ? undefinedDate.toLocaleString() 
        : 'Unknown';
      doc.text(`Undefined date: ${safeDateString}`);
      
      // Test array access
      const testArray = [{ timestamp: testDate, value: 100 }];
      const firstItem = testArray[0]?.timestamp?.toLocaleString() || 'Unknown';
      const lastItem = testArray[testArray.length - 1]?.timestamp?.toLocaleString() || 'Unknown';
      doc.text(`Array access: ${firstItem} - ${lastItem}`);
      
      // Test empty array
      const emptyArray: any[] = [];
      const emptyFirst = emptyArray[0]?.timestamp?.toLocaleString() || 'Unknown';
      const emptyLast = emptyArray[emptyArray.length - 1]?.timestamp?.toLocaleString() || 'Unknown';
      doc.text(`Empty array: ${emptyFirst} - ${emptyLast}`);
      
      doc.end();
    } catch (error) {
      console.error('Error during PDF creation:', error);
      done(error);
    }
  });
});