/**
 * Simple PDF Generation Test
 * Direct test of PDF generation functionality
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

describe('Simple PDF Generation', () => {
  it('should create a basic PDF document', (done) => {
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      
      // Verify it's a valid PDF
      expect(buffer.length).toBeGreaterThan(0);
      expect(buffer.toString('ascii', 0, 4)).toBe('%PDF');
      
      done();
    });

    // Add some content
    doc.fontSize(20).text('Test PDF Document');
    doc.moveDown();
    doc.fontSize(12).text('This is a test of PDF generation.');
    
    // End the document
    doc.end();
  });

  it('should save PDF to file system', (done) => {
    const doc = new PDFDocument();
    const testFile = path.join(process.cwd(), 'test-output.pdf');
    const stream = fs.createWriteStream(testFile);
    
    doc.pipe(stream);
    
    stream.on('finish', () => {
      // Verify file exists and has content
      expect(fs.existsSync(testFile)).toBe(true);
      const stats = fs.statSync(testFile);
      expect(stats.size).toBeGreaterThan(0);
      
      // Clean up
      fs.unlinkSync(testFile);
      done();
    });

    // Add content
    doc.text('Test PDF saved to file');
    doc.end();
  });
});