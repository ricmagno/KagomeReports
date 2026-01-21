/**
 * Report Generation Service
 * Handles PDF generation with PDFKit, templating with Handlebars, and chart embedding
 * Requirements: 4.1, 4.3, 4.4, 4.5
 */

import PDFDocument from 'pdfkit';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { TimeSeriesData, StatisticsResult, TrendResult } from '@/types/historian';
import { reportLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { env } from '@/config/environment';
import { chartGenerationService } from './chartGeneration';
import { chartBufferValidator } from '@/utils/chartBufferValidator';
import { generateReportFilename, getReportNameFromConfig } from '@/utils/reportFilename';

export interface ReportConfig {
  id: string;
  name: string;
  description?: string | undefined;
  tags: string[];
  timeRange: {
    startTime: Date;
    endTime: Date;
    relativeRange?: 'last1h' | 'last2h' | 'last6h' | 'last12h' | 'last24h' | 'last7d' | 'last30d' | undefined;
  };
  chartTypes: ('line' | 'bar' | 'trend' | 'scatter')[];
  template: string;
  format: 'pdf' | 'docx';
  branding?: {
    companyName?: string | undefined;
    logo?: string | undefined;
    colors?: {
      primary?: string | undefined;
      secondary?: string | undefined;
    } | undefined;
  } | undefined;
  metadata?: {
    author?: string | undefined;
    subject?: string | undefined;
    keywords?: string[] | undefined;
  } | undefined;
}

export interface ReportData {
  config: ReportConfig;
  data: Record<string, TimeSeriesData[]>;
  statistics?: Record<string, StatisticsResult>;
  trends?: Record<string, TrendResult>;
  charts?: Record<string, Buffer>;
  generatedAt: Date;
}

export interface ReportResult {
  success: boolean;
  reportId: string;
  filePath?: string;
  buffer?: Buffer;
  metadata: {
    pages: number;
    fileSize: number;
    format: string;
    generationTime: number;
  };
  error?: string;
}

export class ReportGenerationService {
  private templatesDir: string;
  private outputDir: string;

  constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
    this.outputDir = env.REPORTS_DIR || './reports';
    this.ensureDirectories();
    this.registerHandlebarsHelpers();
  }

  /**
   * Generate a PDF report
   */
  async generateReport(reportData: ReportData): Promise<ReportResult> {
    const startTime = Date.now();

    try {
      reportLogger.info('Starting report generation', {
        reportId: reportData.config.id,
        format: reportData.config.format
      });

      // Generate charts if requested
      if (reportData.config.chartTypes.length > 0 && !reportData.charts) {
        reportLogger.info('Generating charts for report', {
          chartTypes: reportData.config.chartTypes
        });

        reportData.charts = await chartGenerationService.generateReportCharts(
          reportData.data,
          reportData.statistics,
          reportData.trends,
          reportData.config.chartTypes
        );
      }

      if (reportData.config.format === 'pdf') {
        return await this.generatePDFReport(reportData, startTime);
      } else if (reportData.config.format === 'docx') {
        // TODO: Implement DOCX generation
        throw createError('DOCX format not yet implemented', 501);
      } else {
        throw createError('Unsupported report format', 400);
      }
    } catch (error) {
      reportLogger.error('Report generation failed', {
        reportId: reportData.config.id,
        error
      });

      return {
        success: false,
        reportId: reportData.config.id,
        metadata: {
          pages: 0,
          fileSize: 0,
          format: reportData.config.format,
          generationTime: Date.now() - startTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate PDF report using PDFKit
   */
  private async generatePDFReport(reportData: ReportData, startTime: number): Promise<ReportResult> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 40, bottom: 60, left: 40, right: 40 },
          bufferPages: true, // Enable page buffering for footer addition
          info: {
            Title: reportData.config.name,
            Author: reportData.config.metadata?.author || 'Historian Reports',
            Subject: reportData.config.metadata?.subject || reportData.config.description,
            Keywords: reportData.config.metadata?.keywords?.join(', ') || '',
            Creator: 'Historian Reports Application',
            Producer: 'PDFKit'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));

        // Add error handler for the document
        doc.on('error', (error) => {
          reject(error);
        });

        // Add header with branding
        this.addReportHeader(doc, reportData.config);

        // Add title and metadata
        this.addReportTitle(doc, reportData.config);
        this.addReportMetadata(doc, reportData);

        // Add executive summary
        this.addExecutiveSummary(doc, reportData);

        // Add data sections for each tag
        let isFirstTag = true;
        for (const [tagName, data] of Object.entries(reportData.data)) {
          if (data.length > 0) {
            // Only add page break if not the first tag or if we're too far down the page
            if (!isFirstTag || doc.y > doc.page.height - 300) {
              doc.addPage();
            } else {
              // Add some spacing before first tag section
              doc.moveDown(1);
            }
            this.addTagSection(doc, tagName, data, reportData);
            isFirstTag = false;
          }
        }

        // Add charts if available
        if (reportData.charts && Object.keys(reportData.charts).length > 0) {
          // Only add page if we're too far down the current page
          if (doc.y > doc.page.height - 400) {
            doc.addPage();
          } else {
            doc.moveDown(1);
          }
          this.addChartsSection(doc, reportData.charts);
        }

        // Add data table for each tag
        for (const [tagName, data] of Object.entries(reportData.data)) {
          if (data.length > 0) {
            doc.addPage();
            this.addDataTable(doc, tagName, data);
          }
        }

        // Add statistical summary
        if (reportData.statistics) {
          // Only add page if we're too far down the current page
          if (doc.y > doc.page.height - 300) {
            doc.addPage();
          } else {
            doc.moveDown(1);
          }
          this.addStatisticalSummary(doc, reportData.statistics);
        }

        // Get page count before adding footers
        const pageCount = doc.bufferedPageRange().count;

        // Add footer to all pages (must be done before doc.end())
        this.addReportFooter(doc, reportData);

        // Finalize the PDF
        doc.end();

        doc.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);

            // Generate standardized filename using report name and current date
            const reportName = getReportNameFromConfig(reportData.config);
            const fileName = generateReportFilename(reportName, 'pdf');

            const filePath = path.join(this.outputDir, fileName);

            // Save to file
            fs.writeFileSync(filePath, buffer);

            const result: ReportResult = {
              success: true,
              reportId: reportData.config.id,
              filePath,
              buffer,
              metadata: {
                pages: pageCount,
                fileSize: buffer.length,
                format: 'pdf',
                generationTime: Date.now() - startTime
              }
            };

            reportLogger.info('PDF report generated successfully', {
              reportId: reportData.config.id,
              filePath,
              fileSize: buffer.length,
              pages: result.metadata.pages,
              generationTime: result.metadata.generationTime
            });

            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add report header with branding
   */
  private addReportHeader(doc: PDFKit.PDFDocument, config: ReportConfig): void {
    // Company name - Kagome branding
    doc.fontSize(16)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Kagome', 40, 25);

    // Subtitle - Historian Reports
    doc.fontSize(11)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text('Historian Reports', 40, 45);

    // Subtle separator line
    doc.strokeColor('#e5e7eb')
      .lineWidth(1)
      .moveTo(40, 65)
      .lineTo(doc.page.width - 40, 65)
      .stroke();

    // Reset position and color
    doc.fillColor('#111827');
    doc.y = 75;
  }

  /**
   * Add report title and basic information
   */
  private addReportTitle(doc: PDFKit.PDFDocument, config: ReportConfig): void {
    doc.fontSize(20)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(config.name, { align: 'center' });

    doc.moveDown();

    if (config.description) {
      doc.fontSize(14)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text(config.description, { align: 'center' });
      doc.moveDown();
    }

    // Time range - safely handle dates
    const startTime = config.timeRange.startTime instanceof Date
      ? config.timeRange.startTime.toLocaleString()
      : 'Unknown';
    const endTime = config.timeRange.endTime instanceof Date
      ? config.timeRange.endTime.toLocaleString()
      : 'Unknown';

    doc.fontSize(12)
      .fillColor('#6b7280')
      .text(`Report Period: ${startTime} - ${endTime}`, { align: 'center' });

    // Reset to default black
    doc.fillColor('#111827');
    doc.moveDown(1);
  }

  /**
   * Add report metadata
   */
  private addReportMetadata(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    const startY = doc.y;

    // Left column
    const generatedDate = reportData.generatedAt instanceof Date
      ? reportData.generatedAt.toLocaleString()
      : 'Unknown';

    doc.fontSize(10)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Generated:', 50, startY)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(generatedDate, 120, startY);

    doc.fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Tags:', 50, startY + 15)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(reportData.config.tags.join(', '), 120, startY + 15);

    // Right column
    const totalDataPoints = Object.values(reportData.data)
      .reduce((sum, data) => sum + data.length, 0);

    doc.fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Data Points:', 300, startY)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(totalDataPoints.toString(), 370, startY);

    doc.fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Format:', 300, startY + 15)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(reportData.config.format.toUpperCase(), 370, startY + 15);

    // Reset to default
    doc.fillColor('#111827');
    doc.y = startY + 40;
    doc.moveDown(0.5);
  }

  /**
   * Add executive summary
   */
  private addExecutiveSummary(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Executive Summary');

    doc.moveDown(0.5);

    const totalTags = reportData.config.tags.length;
    const totalDataPoints = Object.values(reportData.data)
      .reduce((sum, data) => sum + data.length, 0);

    doc.fontSize(12)
      .fillColor('#111827')
      .font('Helvetica')
      .text(`This report analyzes ${totalTags} tag(s) over the specified time period, ` +
        `containing a total of ${totalDataPoints} data points. ` +
        `The analysis includes statistical summaries, trend analysis, and data quality metrics.`);

    doc.moveDown(0.5);

    // Key findings
    if (reportData.statistics) {
      doc.fillColor('#111827')
        .font('Helvetica-Bold')
        .text('Key Findings:');

      doc.fillColor('#111827')
        .font('Helvetica');

      for (const [tagName, stats] of Object.entries(reportData.statistics)) {
        doc.text(`• ${tagName}: Average ${stats.average.toFixed(2)}, ` +
          `Range ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}, ` +
          `Data Quality ${stats.dataQuality.toFixed(1)}%`);
      }
    }

    doc.moveDown(1);
  }

  /**
   * Add section for individual tag
   */
  private addTagSection(
    doc: PDFKit.PDFDocument,
    tagName: string,
    data: TimeSeriesData[],
    reportData: ReportData
  ): void {
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(`Tag: ${tagName}`);

    doc.moveDown(0.5);

    // Basic information
    doc.fontSize(12)
      .fillColor('#111827')
      .font('Helvetica')
      .text(`Data Points: ${data.length}`);

    if (data.length > 0) {
      const startTime = data[0]?.timestamp?.toLocaleString() || 'Unknown';
      const endTime = data[data.length - 1]?.timestamp?.toLocaleString() || 'Unknown';
      doc.text(`Time Range: ${startTime} - ${endTime}`);
    } else {
      doc.text('Time Range: No data available');
    }

    doc.moveDown(0.5);

    // Statistics if available
    const stats = reportData.statistics?.[tagName];
    if (stats) {
      doc.fillColor('#111827')
        .font('Helvetica-Bold')
        .text('Statistical Summary:');

      doc.fillColor('#111827')
        .font('Helvetica')
        .text(`Minimum: ${stats.min.toFixed(2)}`)
        .text(`Maximum: ${stats.max.toFixed(2)}`)
        .text(`Average: ${stats.average.toFixed(2)}`)
        .text(`Standard Deviation: ${stats.standardDeviation.toFixed(2)}`)
        .text(`Data Quality: ${stats.dataQuality.toFixed(1)}%`);

      doc.moveDown(0.5);
    }

    // Trend information if available
    const trend = reportData.trends?.[tagName];
    if (trend) {
      doc.fillColor('#111827')
        .font('Helvetica-Bold')
        .text('Trend Analysis:');

      doc.fillColor('#111827')
        .font('Helvetica')
        .text(`Trend Equation: ${trend.equation}`)
        .text(`Correlation: ${trend.correlation.toFixed(3)}`)
        .text(`Confidence: ${(trend.confidence * 100).toFixed(1)}%`);

      doc.moveDown(0.5);
    }

    // Data quality breakdown
    const qualityBreakdown = this.calculateQualityBreakdown(data);
    doc.fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Data Quality Breakdown:');

    doc.fillColor('#111827')
      .font('Helvetica')
      .text(`Good Quality: ${qualityBreakdown.good} (${qualityBreakdown.goodPercent.toFixed(1)}%)`)
      .text(`Bad Quality: ${qualityBreakdown.bad} (${qualityBreakdown.badPercent.toFixed(1)}%)`)
      .text(`Uncertain Quality: ${qualityBreakdown.uncertain} (${qualityBreakdown.uncertainPercent.toFixed(1)}%)`);
  }

  /**
   * Add charts section
   */
  private addChartsSection(doc: PDFKit.PDFDocument, charts: Record<string, Buffer>): void {
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Data Visualizations');

    doc.moveDown();

    let chartCount = 0;
    let successCount = 0;
    let failureCount = 0;
    const failures: string[] = [];

    reportLogger.info('Adding charts section to PDF', {
      totalCharts: Object.keys(charts).length
    });

    for (const [chartName, chartBuffer] of Object.entries(charts)) {
      if (chartCount > 0 && chartCount % 2 === 0) {
        doc.addPage();
        reportLogger.debug('Added new page for charts', { chartCount });
      }

      const y = doc.y;
      const chartWidth = 450;  // Increased from 250
      const chartHeight = 300; // Increased from 200

      doc.fontSize(12)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(chartName, { align: 'center' });

      doc.moveDown(0.5);

      // Validate buffer before embedding
      reportLogger.debug('Validating chart buffer before embedding', {
        chartName,
        bufferSize: chartBuffer?.length || 0
      });

      const validation = chartBufferValidator.validateBuffer(chartBuffer, chartName);

      if (!validation.valid) {
        reportLogger.error('Chart buffer validation failed before embedding', {
          chartName,
          errors: validation.errors,
          bufferInfo: validation.bufferInfo
        });

        // Add placeholder text
        doc.fontSize(12)
          .font('Helvetica')
          .fillColor('#ef4444')
          .text(`Chart could not be displayed: ${validation.errors[0]}`, {
            align: 'center',
            width: chartWidth
          })
          .fillColor('#111827');

        failures.push(chartName);
        failureCount++;
      } else {
        try {
          // Log buffer details before embedding
          reportLogger.info('Embedding chart in PDF', {
            chartName,
            bufferSize: validation.bufferInfo.size,
            format: validation.bufferInfo.format,
            dimensions: validation.bufferInfo.dimensions,
            targetSize: { width: chartWidth, height: chartHeight }
          });

          // Add chart image with explicit options
          doc.image(chartBuffer, {
            fit: [chartWidth, chartHeight],
            align: 'center'
          });

          successCount++;

          reportLogger.info('Chart embedded successfully in PDF', {
            chartName,
            bufferSize: validation.bufferInfo.size
          });

        } catch (error) {
          reportLogger.error('Failed to embed chart in PDF', {
            chartName,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            bufferSize: validation.bufferInfo.size,
            bufferFormat: validation.bufferInfo.format
          });

          // Add error placeholder
          doc.fontSize(12)
            .font('Helvetica')
            .fillColor('#ef4444')
            .text(`Chart embedding failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
              align: 'center',
              width: chartWidth
            })
            .fillColor('#111827');

          failures.push(chartName);
          failureCount++;
        }
      }

      doc.moveDown(1.5);
      chartCount++;
    }

    // Log summary
    reportLogger.info('Chart embedding summary', {
      total: chartCount,
      successful: successCount,
      failed: failureCount,
      failures: failures,
      successRate: chartCount > 0 ? ((successCount / chartCount) * 100).toFixed(1) + '%' : '0%'
    });

    // Add summary note if there were failures
    if (failureCount > 0) {
      doc.moveDown();
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(`Note: ${failureCount} of ${chartCount} chart(s) could not be displayed. See logs for details.`, {
          align: 'center'
        })
        .fillColor('#111827');
    }
  }

  /**
   * Add statistical summary section
   */
  private addStatisticalSummary(doc: PDFKit.PDFDocument, statistics: Record<string, StatisticsResult>): void {
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Statistical Summary');

    doc.moveDown(0.5);

    // Create table
    const tableTop = doc.y;
    const tableLeft = 40;
    const columnWidth = 85;
    const rowHeight = 20;

    // Table headers
    const headers = ['Tag', 'Min', 'Max', 'Average', 'Std Dev', 'Quality %'];

    doc.fontSize(10)
      .fillColor('#111827')
      .font('Helvetica-Bold');

    headers.forEach((header, i) => {
      doc.text(header, tableLeft + i * columnWidth, tableTop, {
        width: columnWidth,
        align: 'center'
      });
    });

    // Table rows
    doc.fillColor('#111827')
      .font('Helvetica');
    let rowIndex = 1;

    for (const [tagName, stats] of Object.entries(statistics)) {
      const y = tableTop + rowIndex * rowHeight;

      const values = [
        tagName,
        stats.min.toFixed(2),
        stats.max.toFixed(2),
        stats.average.toFixed(2),
        stats.standardDeviation.toFixed(2),
        stats.dataQuality.toFixed(1) + '%'
      ];

      values.forEach((value, i) => {
        doc.text(value, tableLeft + i * columnWidth, y, {
          width: columnWidth,
          align: 'center'
        });
      });

      rowIndex++;
    }

    doc.y = tableTop + (rowIndex + 1) * rowHeight;
  }

  /**
   * Add data table section showing all data points
   */
  private addDataTable(doc: PDFKit.PDFDocument, tagName: string, data: TimeSeriesData[]): void {
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text(`Data Table: ${tagName}`);

    doc.moveDown(0.5);

    // Table configuration
    const tableTop = doc.y;
    const tableLeft = 40;
    const pageWidth = doc.page.width - 80; // Account for margins (40 on each side)

    // Column widths (proportional)
    const colWidths = {
      timestamp: pageWidth * 0.35,
      value: pageWidth * 0.25,
      quality: pageWidth * 0.20,
      status: pageWidth * 0.20
    };

    const rowHeight = 20;
    const headerHeight = 25;

    // Helper function to get quality status text
    const getQualityStatus = (quality: number): string => {
      if (quality === 192) return 'Good';
      if (quality === 0) return 'Bad';
      if (quality === 64) return 'Uncertain';
      return `Code ${quality}`;
    };

    // Helper function to check if we need a new page
    const checkPageBreak = (currentY: number) => {
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        return 50; // Reset to top margin
      }
      return currentY;
    };

    // Draw table header
    let currentY = tableTop;

    doc.fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#374151');

    // Header background
    doc.rect(tableLeft, currentY, pageWidth, headerHeight)
      .fill('#f3f4f6');

    // Header text
    doc.fillColor('#374151')
      .text('Timestamp', tableLeft + 5, currentY + 7, { width: colWidths.timestamp, align: 'left' })
      .text('Value', tableLeft + colWidths.timestamp + 5, currentY + 7, { width: colWidths.value, align: 'right' })
      .text('Quality Code', tableLeft + colWidths.timestamp + colWidths.value + 5, currentY + 7, { width: colWidths.quality, align: 'center' })
      .text('Status', tableLeft + colWidths.timestamp + colWidths.value + colWidths.quality + 5, currentY + 7, { width: colWidths.status, align: 'center' });

    currentY += headerHeight;

    // Draw table rows
    doc.font('Helvetica')
      .fontSize(9);

    // Limit to first 1000 rows to avoid huge PDFs
    const maxRows = Math.min(data.length, 1000);

    for (let i = 0; i < maxRows; i++) {
      const row = data[i];

      // Safety check
      if (!row) continue;

      // Check if we need a new page
      currentY = checkPageBreak(currentY);

      // Alternate row colors
      if (i % 2 === 0) {
        doc.rect(tableLeft, currentY, pageWidth, rowHeight)
          .fill('#f9fafb');
      }

      // Format timestamp
      const timestamp = row.timestamp instanceof Date
        ? row.timestamp.toLocaleString()
        : new Date(row.timestamp).toLocaleString();

      // Format value
      const value = typeof row.value === 'number'
        ? row.value.toFixed(2)
        : String(row.value);

      // Get quality status
      const qualityStatus = getQualityStatus(row.quality);

      // Use grayscale for all text (no colored quality indicators in tables)
      // Draw row data
      doc.fillColor('#111827')
        .text(timestamp, tableLeft + 5, currentY + 5, { width: colWidths.timestamp, align: 'left' })
        .text(value, tableLeft + colWidths.timestamp + 5, currentY + 5, { width: colWidths.value, align: 'right' })
        .text(String(row.quality), tableLeft + colWidths.timestamp + colWidths.value + 5, currentY + 5, { width: colWidths.quality, align: 'center' })
        .text(qualityStatus, tableLeft + colWidths.timestamp + colWidths.value + colWidths.quality + 5, currentY + 5, { width: colWidths.status, align: 'center' });

      currentY += rowHeight;
    }

    // Add note if data was truncated
    if (data.length > maxRows) {
      currentY = checkPageBreak(currentY + 10);
      doc.fillColor('#6b7280')
        .fontSize(10)
        .text(`Note: Showing first ${maxRows} of ${data.length} data points. Export to CSV for complete data.`,
          tableLeft, currentY + 10, { align: 'center', width: pageWidth });
    }

    // Reset color
    doc.fillColor('black');
    doc.y = currentY + 30;
  }

  /**
   * Add report footer to all pages with generation info and page numbers
   */
  private addReportFooter(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    try {
      // Get total page count
      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      // Format generation timestamp
      const generatedDate = reportData.generatedAt instanceof Date
        ? reportData.generatedAt.toLocaleString()
        : 'Unknown';

      // Iterate through all pages and add footer to each
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Temporarily disable bottom margin to prevent auto-page-adding 
        // when writing in the footer area (within the original margin)
        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const pageNumber = i + 1;
        const footerY = doc.page.height - 55;

        // Add horizontal separator line above footer
        doc.strokeColor('#cccccc')
          .lineWidth(1)
          .moveTo(40, footerY)
          .lineTo(doc.page.width - 40, footerY)
          .stroke();

        // Add generation timestamp (left side)
        doc.fillColor('#666666')
          .fontSize(8)
          .font('Helvetica')
          .text(
            `Generated by Historian Reports on ${generatedDate}`,
            40,
            footerY + 10,
            { align: 'left', width: doc.page.width - 200 }
          );

        // Add page numbers (right side)
        doc.text(
          `Page ${pageNumber} of ${totalPages}`,
          doc.page.width - 140,
          footerY + 10,
          { align: 'right', width: 100 }
        );

        // Restore bottom margin
        doc.page.margins.bottom = oldBottomMargin;
      }

      // Reset color
      doc.fillColor('#111827');
    } catch (error) {
      reportLogger.error('Error adding footer to pages', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Calculate data quality breakdown
   */
  private calculateQualityBreakdown(data: TimeSeriesData[]) {
    const good = data.filter(d => d.quality === 192).length;
    const bad = data.filter(d => d.quality === 0).length;
    const uncertain = data.filter(d => d.quality === 64).length;
    const total = data.length;

    return {
      good,
      bad,
      uncertain,
      goodPercent: (good / total) * 100,
      badPercent: (bad / total) * 100,
      uncertainPercent: (uncertain / total) * 100
    };
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Register Handlebars helpers
   */
  private registerHandlebarsHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: any) => {
      if (date instanceof Date) {
        return date.toLocaleString();
      }
      return 'Invalid Date';
    });

    // Number formatting helper
    Handlebars.registerHelper('formatNumber', (num: any, decimals: number = 2) => {
      if (typeof num === 'number' && !isNaN(num)) {
        return num.toFixed(decimals);
      }
      return '0.00';
    });

    // Percentage helper
    Handlebars.registerHelper('percentage', (num: any) => {
      if (typeof num === 'number' && !isNaN(num)) {
        return (num * 100).toFixed(1) + '%';
      }
      return '0.0%';
    });

    // Conditional helper
    Handlebars.registerHelper('ifEquals', function (this: any, arg1: any, arg2: any, options: any) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
  }

  /**
   * Load and compile template
   */
  async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      // Create default template if it doesn't exist
      await this.createDefaultTemplate(templateName);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8');
    return Handlebars.compile(templateContent);
  }

  /**
   * Create default template
   */
  private async createDefaultTemplate(templateName: string): Promise<void> {
    const defaultTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>{{reportName}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #0ea5e9; color: white; padding: 20px; text-align: center; }
        .content { margin: 20px 0; }
        .tag-section { margin: 30px 0; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .statistics { display: flex; justify-content: space-between; margin: 20px 0; }
        .stat-item { text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{reportName}}</h1>
        <p>{{description}}</p>
    </div>
    
    <div class="content">
        <p><strong>Generated:</strong> {{formatDate generatedAt}}</p>
        <p><strong>Time Range:</strong> {{formatDate timeRange.startTime}} - {{formatDate timeRange.endTime}}</p>
        <p><strong>Tags:</strong> {{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}</p>
        
        {{#each tagData}}
        <div class="tag-section">
            <h2>{{@key}}</h2>
            <p>Data Points: {{this.length}}</p>
            {{#if ../statistics.[this]}}
            <div class="statistics">
                <div class="stat-item">
                    <strong>{{formatNumber ../statistics.[this].min}}</strong><br>
                    <small>Minimum</small>
                </div>
                <div class="stat-item">
                    <strong>{{formatNumber ../statistics.[this].max}}</strong><br>
                    <small>Maximum</small>
                </div>
                <div class="stat-item">
                    <strong>{{formatNumber ../statistics.[this].average}}</strong><br>
                    <small>Average</small>
                </div>
                <div class="stat-item">
                    <strong>{{percentage ../statistics.[this].dataQuality}}</strong><br>
                    <small>Data Quality</small>
                </div>
            </div>
            {{/if}}
        </div>
        {{/each}}
    </div>
</body>
</html>
    `;

    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
    fs.writeFileSync(templatePath, defaultTemplate.trim());
  }
}

// Export singleton instance
export const reportGenerationService = new ReportGenerationService();