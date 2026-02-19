/**
 * Report Generation Service
 * Handles PDF generation with PDFKit, templating with Handlebars, and chart embedding
 * Requirements: 4.1, 4.3, 4.4, 4.5
 */

import PDFDocument from 'pdfkit';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { TimeSeriesData, StatisticsResult, TrendResult, SPCMetricsSummary, SpecificationLimits, TagClassification } from '@/types/historian';
import { reportLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';
import { env } from '@/config/environment';
import { chartGenerationService } from './chartGeneration';
import { chartBufferValidator } from '@/utils/chartBufferValidator';
import { generateReportFilename, getReportNameFromConfig } from '@/utils/reportFilename';
import { classifyTag, classifyTags } from './tagClassificationService';
import { statisticalAnalysisService } from './statisticalAnalysis';
import { analyticsErrorHandler } from '@/utils/analyticsErrorHandler';

// Import package.json for version info
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));

export interface ReportConfig {
  id: string;
  name: string;
  description?: string | undefined;
  tags: string[];
  timeRange: {
    startTime: Date;
    endTime: Date;
    relativeRange?: 'last1h' | 'last2h' | 'last6h' | 'last12h' | 'last24h' | 'last7d' | 'last30d' | undefined;
    timezone?: string | undefined;
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
  specificationLimits?: Record<string, SpecificationLimits> | undefined;
  includeSPCCharts?: boolean | undefined;
  includeTrendLines?: boolean | undefined;
  includeStatsSummary?: boolean | undefined;
  version?: number | undefined;
  retrievalMode?: string | undefined;
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
          reportData.config.chartTypes,
          { timezone: reportData.config.timeRange.timezone }
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
    return new Promise(async (resolve, reject) => {
      try {
        // Step 1: Classify tags (analog vs digital)
        reportLogger.info('Classifying tags for analytics', {
          tagCount: Object.keys(reportData.data).length
        });

        const tagClassifications = new Map<string, TagClassification>();
        for (const [tagName, data] of Object.entries(reportData.data)) {
          if (data.length > 0) {
            const classification = classifyTag(data);
            tagClassifications.set(tagName, classification);
            reportLogger.debug(`Tag ${tagName} classified as ${classification.type}`, {
              confidence: classification.confidence
            });
          }
        }

        // Step 2: Calculate analytics for analog tags
        const trendLines = new Map<string, any>();
        const spcMetrics = new Map<string, any>();
        const spcMetricsSummary: SPCMetricsSummary[] = [];

        const includeTrendLines = reportData.config.includeTrendLines !== false; // Default true
        const includeSPCCharts = reportData.config.includeSPCCharts !== false; // Default true

        for (const [tagName, data] of Object.entries(reportData.data)) {
          const classification = tagClassifications.get(tagName);

          // Only process analog tags
          if (classification?.type === 'analog' && data.length >= 3) {
            // Calculate trend line if enabled (with graceful error handling)
            if (includeTrendLines) {
              const trendLine = statisticalAnalysisService.safeCalculateTrendLine(data, tagName);
              if (trendLine) {
                trendLines.set(tagName, trendLine);
                reportLogger.debug(`Trend line calculated for ${tagName}`, {
                  slope: trendLine.slope,
                  rSquared: trendLine.rSquared
                });
              } else {
                reportLogger.warn(`Trend line calculation failed for ${tagName}, continuing without trend line`);
              }
            }

            // Calculate SPC metrics if enabled and spec limits provided (with graceful error handling)
            if (includeSPCCharts) {
              const specLimits = reportData.config.specificationLimits?.[tagName];
              const metrics = statisticalAnalysisService.safeCalculateSPCMetrics(data, tagName, specLimits);

              if (metrics) {
                spcMetrics.set(tagName, metrics);

                // Add to summary table
                const capability = statisticalAnalysisService.assessCapability(metrics.cp, metrics.cpk);
                spcMetricsSummary.push({
                  tagName,
                  mean: metrics.mean,
                  stdDev: metrics.stdDev,
                  ucl: metrics.ucl,
                  lcl: metrics.lcl,
                  lsl: specLimits?.lsl ?? null,
                  usl: specLimits?.usl ?? null,
                  cp: metrics.cp,
                  cpk: metrics.cpk,
                  capability
                });

                reportLogger.debug(`SPC metrics calculated for ${tagName}`, {
                  mean: metrics.mean,
                  cp: metrics.cp,
                  cpk: metrics.cpk,
                  capability
                });
              } else {
                reportLogger.warn(`SPC metrics calculation failed for ${tagName}, continuing without SPC metrics`);
              }
            }
          }
        }

        // Step 3: Generate enhanced charts with trend lines and statistics
        const enhancedCharts = new Map<string, Buffer>();

        // Include any pre-generated charts from the report data
        if (reportData.charts) {
          // Priority 1: Multi-trend chart should always be first
          if (reportData.charts['combined_multi_trend']) {
            enhancedCharts.set('Multi-trend', reportData.charts['combined_multi_trend']);
          }

          // Priority 2: Statistics summary chart
          if (reportData.charts['statistics_summary']) {
            enhancedCharts.set('Statistical Summary Chart', reportData.charts['statistics_summary']);
          }

          for (const [name, buffer] of Object.entries(reportData.charts)) {
            // Already handled these specific priorities
            if (name === 'combined_multi_trend' || name === 'statistics_summary') continue;

            let friendlyName = name;
            // Map cryptic service-internal names to user-friendly titles
            if (name.endsWith('_line')) friendlyName = `${name.replace('_line', '')} - Time Series`;
            else if (name.endsWith('_trend')) friendlyName = `${name.replace('_trend', '')} - Trend Analysis`;
            else if (name.endsWith('_scatter')) friendlyName = `${name.replace('_scatter', '')} - Scatter Plot`;

            enhancedCharts.set(friendlyName, buffer);
          }
        }

        for (const [tagName, data] of Object.entries(reportData.data)) {
          if (data.length === 0) continue;

          const classification = tagClassifications.get(tagName);
          const stats = reportData.statistics?.[tagName];

          // Generate standard chart with trend line and statistics
          const trendLine = trendLines.get(tagName);
          const tagStatistics = stats ? {
            min: stats.min,
            max: stats.max,
            mean: stats.average,
            stdDev: stats.standardDeviation
          } : undefined;

          // Only generate internal chart if not already provided in reportData.charts
          // to avoid duplicated visualizations for the same tag
          if (enhancedCharts.has(`${tagName} - Time Series`)) {
            reportLogger.debug(`Skipping internal chart generation for ${tagName}, already exists in pre-generated charts`);
          } else {
            const lineChartData: any = {
              tagName,
              data,
              trendLine,
              statistics: tagStatistics
            };

            try {
              const chartBuffer = await chartGenerationService.generateLineChart(
                [lineChartData],
                {
                  title: `${tagName} - Time Series Data`,
                  width: 1200,
                  height: 600,
                  timezone: reportData.config.timeRange.timezone
                }
              );

              enhancedCharts.set(`${tagName} - Data Trend`, chartBuffer);
              reportLogger.debug(`Enhanced chart generated for ${tagName}`);
            } catch (error) {
              reportLogger.error(`Failed to generate line chart for ${tagName}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }

          // Generate SPC chart for analog tags if enabled
          if (classification?.type === 'analog' && includeSPCCharts) {
            const metrics = spcMetrics.get(tagName);
            const specLimits = reportData.config.specificationLimits?.[tagName];

            if (metrics) {
              try {
                const spcChartBuffer = await chartGenerationService.generateSPCChart(
                  tagName,
                  data,
                  metrics,
                  specLimits,
                  {
                    title: `${tagName} - SPC Chart`,
                    width: 1200,
                    height: 600,
                    timezone: reportData.config.timeRange.timezone
                  }
                );

                enhancedCharts.set(`${tagName} - SPC Chart`, spcChartBuffer);
                reportLogger.debug(`SPC chart generated for ${tagName}`);
              } catch (error) {
                reportLogger.error(`Failed to generate SPC chart for ${tagName}`, {
                  error: error instanceof Error ? error.message : 'Unknown error'
                });
                // SPC chart generation failed - report will continue without this chart
              }
            }
          }
        }

        // Step 4: Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 80, bottom: 60, left: 30, right: 30 },
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

        // Separate standard charts from SPC charts
        const standardCharts = new Map<string, Buffer>();
        const spcCharts = new Map<string, Buffer>();

        for (const [chartName, chartBuffer] of enhancedCharts.entries()) {
          if (chartName.includes('SPC Chart')) {
            spcCharts.set(chartName, chartBuffer);
          } else {
            standardCharts.set(chartName, chartBuffer);
          }
        }

        // Add standard charts section (with trend lines)
        if (standardCharts.size > 0) {
          // Always start Data Visualizations on a new page as per requirements
          doc.addPage();
          this.addChartsSection(doc, Object.fromEntries(standardCharts));
        }

        // Add SPC section on a new page if we have SPC data
        if (spcCharts.size > 0 || spcMetricsSummary.length > 0) {
          // Always start SPC section on a new page
          doc.addPage();

          // Add SPC section header
          doc.fontSize(16)
            .fillColor('#111827')
            .font('Helvetica-Bold')
            .text('Statistical Process Control Analysis', { align: 'center' });

          doc.moveDown(1);

          // Add SPC charts first
          if (spcCharts.size > 0) {
            this.addChartsSection(doc, Object.fromEntries(spcCharts));
          }

          // Add SPC metrics summary table after charts
          if (spcMetricsSummary.length > 0) {
            // Only add page if we're too far down the current page
            if (doc.y > doc.page.height - 300) {
              doc.addPage();
            } else {
              doc.moveDown(1);
            }
            this.addSPCMetricsTable(doc, spcMetricsSummary);
          }
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

            // Generate standardized filename using report name and current date/timezone
            const reportName = getReportNameFromConfig(reportData.config);
            const baseFileName = generateReportFilename(
              reportName,
              'pdf',
              reportData.generatedAt,
              reportData.config.timeRange?.timezone
            );

            // Use a subdirectory for each report ID to keep filenames clean 
            // while maintaining uniqueness and allowing the download route to find them.
            const reportDir = path.join(this.outputDir, reportData.config.id);
            if (!fs.existsSync(reportDir)) {
              fs.mkdirSync(reportDir, { recursive: true });
            }

            const filePath = path.join(reportDir, baseFileName);

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

            // Log analytics error summary if any errors occurred
            if (analyticsErrorHandler.hasErrors()) {
              const errorSummary = analyticsErrorHandler.getErrorSummary();
              reportLogger.warn('Report generated with analytics errors', {
                reportId: reportData.config.id,
                errorSummary,
                errors: analyticsErrorHandler.getErrors().map(e => ({
                  type: e.type,
                  message: e.message,
                  tagName: e.tagName,
                  metric: e.metric
                }))
              });

              // Clear errors for next report
              analyticsErrorHandler.clearErrors();
            }

            reportLogger.info('PDF report generated successfully with analytics', {
              reportId: reportData.config.id,
              filePath,
              fileSize: buffer.length,
              pages: result.metadata.pages,
              generationTime: result.metadata.generationTime,
              analogTags: Array.from(tagClassifications.values()).filter(c => c.type === 'analog').length,
              digitalTags: Array.from(tagClassifications.values()).filter(c => c.type === 'digital').length,
              trendLinesGenerated: trendLines.size,
              spcChartsGenerated: spcMetrics.size
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
    doc.y = 130;  // Increased from 110 for further improved spacing to avoid overlap
    doc.x = 40;   // Explicitly reset x to margin
  }

  /**
   * Add report title and basic information
   */
  private addReportTitle(doc: PDFKit.PDFDocument, config: ReportConfig): void {
    const title = config.version
      ? `${config.name} (v${config.version})`
      : config.name;

    doc.fontSize(20)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(title, { align: 'center' });

    doc.moveDown();

    if (config.description) {
      doc.fontSize(14)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text(config.description, { align: 'center' });
      doc.moveDown();
    }

    // Time range - safely handle dates with timezone
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: config.timeRange.timezone || env.DEFAULT_TIMEZONE
    };

    const startTime = config.timeRange.startTime instanceof Date
      ? config.timeRange.startTime.toLocaleString('en-US', formatOptions)
      : 'Unknown';
    const endTime = config.timeRange.endTime instanceof Date
      ? config.timeRange.endTime.toLocaleString('en-US', formatOptions)
      : 'Unknown';

    doc.fontSize(12)
      .fillColor('#6b7280')
      .text(`Report Period: ${startTime} - ${endTime} (${config.timeRange.timezone || env.DEFAULT_TIMEZONE})`, { align: 'center' });

    // Reset to default black
    doc.fillColor('#111827');
    doc.moveDown(1);
  }

  /**
   * Add report metadata
   */
  private addReportMetadata(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    // Basic date formatting options
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: reportData.config.timeRange.timezone || env.DEFAULT_TIMEZONE
    };

    const generatedDate = reportData.generatedAt instanceof Date
      ? reportData.generatedAt.toLocaleString('en-US', formatOptions)
      : 'Unknown';

    const totalDataPoints = Object.values(reportData.data)
      .reduce((sum, data) => sum + data.length, 0);

    doc.fontSize(10);

    // Use relative positioning to prevent overlap when content wraps
    // Each metadata item gets its own line as per user requirements for organization

    // Reset x to consistent left alignment for metadata indented from main margin
    doc.x = 50;

    // Generated info
    doc.fillColor('#111827').font('Helvetica-Bold').text('Generated: ', { continued: true })
      .fillColor('#6b7280').font('Helvetica').text(generatedDate);

    // Data points count
    doc.fillColor('#111827').font('Helvetica-Bold').text('Data Points: ', { continued: true })
      .fillColor('#6b7280').font('Helvetica').text(totalDataPoints.toString());

    // Export format
    doc.fillColor('#111827').font('Helvetica-Bold').text('Format: ', { continued: true })
      .fillColor('#6b7280').font('Helvetica').text(reportData.config.format.toUpperCase());

    // Tag list - print each tag on a new line for maximum clarity
    doc.fillColor('#111827').font('Helvetica-Bold').text('Tags: ');

    doc.fillColor('#6b7280').font('Helvetica');
    for (const tag of reportData.config.tags) {
      doc.text(`• ${tag}`, 65); // Indent individual tags slightly more (65 instead of 50)
    }

    // Clean up positioning and color for next section
    doc.fillColor('#111827');
    doc.x = 40; // Reset to default margin
    doc.moveDown(1);
  }

  /**
   * Add executive summary
   */
  private addExecutiveSummary(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Executive Summary', 40);  // Explicit x position

    doc.moveDown(0.5);

    const totalTags = reportData.config.tags.length;
    const totalDataPoints = Object.values(reportData.data)
      .reduce((sum, data) => sum + data.length, 0);

    doc.fontSize(12)
      .fillColor('#111827')
      .font('Helvetica')
      .text(`This report analyzes ${totalTags} tag(s) over the specified time period, ` +
        `containing a total of ${totalDataPoints} data points. ` +
        `The analysis includes statistical summaries, trend analysis, and data quality metrics.`,
        40, doc.y, {  // Explicit x position and current y
        width: doc.page.width - 80,  // Full width minus margins
        align: 'left'
      });

    doc.moveDown(0.5);

    // Key findings - iterate over all tags to ensure none are missing from the summary
    doc.fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Key Findings:', 40);

    doc.fillColor('#111827')
      .font('Helvetica');

    for (const tagName of reportData.config.tags) {
      const stats = reportData.statistics?.[tagName];
      if (stats) {
        doc.text(`• ${tagName}: Average ${stats.average.toFixed(2)}, ` +
          `Range ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}, ` +
          `Data Quality ${stats.dataQuality.toFixed(1)}%`,
          40, doc.y, {
          width: doc.page.width - 80,
          align: 'left'
        }
        );
      } else {
        doc.text(`• ${tagName}: No statistical data available for this period.`,
          40, doc.y, {
          width: doc.page.width - 80,
          align: 'left'
        }
        );
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
      const formatOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: reportData.config.timeRange.timezone || env.DEFAULT_TIMEZONE
      };
      const startTime = data[0]?.timestamp?.toLocaleString('en-US', formatOptions) || 'Unknown';
      const endTime = data[data.length - 1]?.timestamp?.toLocaleString('en-US', formatOptions) || 'Unknown';
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
      // New page every 2 charts to maintain clear layout and professional appearance
      if (chartCount > 0 && chartCount % 2 === 0) {
        doc.addPage();
        reportLogger.debug('Added new page for charts', { chartCount });
      }

      const chartWidth = 535;  // Increased from 515 for wider appearance
      const chartHeight = 320; // Maximum height to allow exactly 2 charts per page with titles and margins

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
      .text('Statistical Summary', 40); // Explicit x position

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
        return doc.page.margins.top; // Reset to top margin
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

      // Format report period for header
      const startTimeStr = reportData.config.timeRange.startTime instanceof Date
        ? reportData.config.timeRange.startTime.toLocaleString()
        : 'Unknown';
      const endTimeStr = reportData.config.timeRange.endTime instanceof Date
        ? reportData.config.timeRange.endTime.toLocaleString()
        : 'Unknown';
      const periodStr = `Report Period: ${startTimeStr} - ${endTimeStr}`;

      // Iterate through all pages and add decorations (header/footer) to each
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);

        // Add header to all pages BUT the first
        if (i > 0) {
          doc.fillColor('#6b7280')
            .fontSize(9)
            .font('Helvetica')
            .text(
              `${reportData.config.name} - ${periodStr}`,
              40,
              25,
              { align: 'right', width: doc.page.width - 80 }
            );

          // Add a subtle line below the repeat header
          doc.strokeColor('#e5e7eb')
            .lineWidth(0.5)
            .moveTo(40, 38)
            .lineTo(doc.page.width - 40, 38)
            .stroke();
        }

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
            `Generated by Historian Reports v${packageJson.version} on ${generatedDate}`,
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
   * Add SPC metrics summary table
   */
  addSPCMetricsTable(doc: PDFKit.PDFDocument, metrics: SPCMetricsSummary[]): void {
    if (!metrics || metrics.length === 0) {
      return;
    }

    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('SPC Metrics Summary', 40); // Explicit x position

    doc.moveDown(0.5);

    const tableTop = doc.y + 10;
    const tableLeft = 40;
    const colWidths: number[] = [100, 50, 50, 50, 50, 45, 45, 45, 45, 50];
    const headers = ['Tag Name', 'Average', 'Std Dev', 'LCL', 'UCL', 'LSL', 'USL', 'Cp', 'Cpk', 'Stat'];
    const rowHeight = 20;
    const headerHeight = 25;

    // Helper function to check if we need a new page
    const checkPageBreak = (currentY: number) => {
      if (currentY > doc.page.height - 100) {
        doc.addPage();
        return doc.page.margins.top; // Reset to top margin
      }
      return currentY;
    };

    let currentY = tableTop;

    // Draw table header background
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    doc.rect(tableLeft, currentY, tableWidth, headerHeight)
      .fill('#f3f4f6');

    // Draw table header text
    let x = tableLeft;
    doc.fontSize(8) // Reduced from 10 to fit more columns
      .fillColor('#374151')
      .font('Helvetica-Bold');

    headers.forEach((header, i) => {
      const width = colWidths[i] || 60;
      doc.text(header, x + 2, currentY + 7, { // Reduced padding
        width: width - 4,
        align: 'center'
      });
      x += width;
    });

    currentY += headerHeight;

    // Draw table rows
    doc.fontSize(8) // Reduced from 9 to fit
      .fillColor('#111827')
      .font('Helvetica');

    metrics.forEach((metric, index) => {
      // Check if we need a new page
      currentY = checkPageBreak(currentY);

      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(tableLeft, currentY, tableWidth, rowHeight)
          .fill('#f9fafb');
      }

      x = tableLeft;

      // Tag name (left-aligned)
      doc.fillColor('#111827')
        .text(metric.tagName, x + 2, currentY + 5, {
          width: colWidths[0]! - 4,
          align: 'left'
        });
      x += colWidths[0]!;

      // Mean (X̄)
      doc.text(metric.mean.toFixed(2), x + 2, currentY + 5, {
        width: colWidths[1]! - 4,
        align: 'center'
      });
      x += colWidths[1]!;

      // StdDev (σest)
      doc.text(metric.stdDev.toFixed(2), x + 2, currentY + 5, {
        width: colWidths[2]! - 4,
        align: 'center'
      });
      x += colWidths[2]!;

      // LCL
      doc.text(metric.lcl.toFixed(2), x + 2, currentY + 5, {
        width: colWidths[3]! - 4,
        align: 'center'
      });
      x += colWidths[3]!;

      // UCL
      doc.text(metric.ucl.toFixed(2), x + 2, currentY + 5, {
        width: colWidths[4]! - 4,
        align: 'center'
      });
      x += colWidths[4]!;

      // LSL
      doc.text(
        metric.lsl !== null ? metric.lsl.toFixed(2) : 'N/A',
        x + 2,
        currentY + 5,
        { width: colWidths[5]! - 4, align: 'center' }
      );
      x += colWidths[5]!;

      // USL
      doc.text(
        metric.usl !== null ? metric.usl.toFixed(2) : 'N/A',
        x + 2,
        currentY + 5,
        { width: colWidths[6]! - 4, align: 'center' }
      );
      x += colWidths[6]!;

      // Cp
      doc.text(
        metric.cp !== null ? metric.cp.toFixed(2) : 'N/A',
        x + 2,
        currentY + 5,
        { width: colWidths[7]! - 4, align: 'center' }
      );
      x += colWidths[7]!;

      // Cpk
      doc.text(
        metric.cpk !== null ? metric.cpk.toFixed(2) : 'N/A',
        x + 2,
        currentY + 5,
        { width: colWidths[8]! - 4, align: 'center' }
      );
      x += colWidths[8]!;

      // Capability assessment with visual indicator
      const capabilityText = metric.capability;
      let capabilityColor = '#111827'; // Default black

      if (metric.capability === 'Capable') {
        capabilityColor = '#111827'; // Dark
      } else if (metric.capability === 'Marginal') {
        capabilityColor = '#6b7280'; // Gray
      } else if (metric.capability === 'Not Capable') {
        capabilityColor = '#9ca3af'; // Light gray
      }

      doc.fillColor(capabilityColor)
        .text(capabilityText, x + 2, currentY + 5, {
          width: colWidths[9]! - 4,
          align: 'center'
        });

      currentY += rowHeight;
    });

    // Reset color and position
    doc.fillColor('#111827');
    doc.y = currentY + 20;
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