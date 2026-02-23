/**
 * Report Generation Service
 * Handles PDF generation with PDFKit, templating with Handlebars, and chart embedding
 * Requirements: 4.1, 4.3, 4.4, 4.5
 */

import PDFDocument from 'pdfkit';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { TimeSeriesData, StatisticsResult, TrendResult, SPCMetricsSummary, SpecificationLimits, TagClassification, TagInfo } from '@/types/historian';
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
  includeDataTable?: boolean | undefined;
  version?: number | undefined;
  retrievalMode?: string | undefined;
}

export interface ReportData {
  config: ReportConfig;
  data: Record<string, TimeSeriesData[]>;
  statistics?: Record<string, StatisticsResult>;
  trends?: Record<string, TrendResult>;
  charts?: Record<string, Buffer>;
  tagInfo?: Record<string, TagInfo>;
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
      console.error('DEBUG: generateReport caught error:', error);
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
        error: error instanceof Error ? error.stack || error.message : 'Unknown error'
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

        const includeTrendLines = reportData.config.includeTrendLines !== false; // Default: true
        const includeStatsSummary = reportData.config.includeStatsSummary !== false; // Default: true
        const includeSPCCharts = !!reportData.config.includeSPCCharts; // Default: false
        const includeDataTable = !!reportData.config.includeDataTable; // Default: false

        reportLogger.info('PDF Generation configuration', {
          reportId: reportData.config.id,
          includeTrendLines,
          includeSPCCharts,
          includeStatsSummary,
          includeDataTable,
          hasStatistics: !!reportData.statistics && Object.keys(reportData.statistics).length > 0
        });

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

        // Pre-populate with WYSIWYG charts from frontend
        if (reportData.charts) {
          for (const [chartName, chartBuffer] of Object.entries(reportData.charts)) {
            enhancedCharts.set(chartName, chartBuffer);
            reportLogger.debug(`Using pre-generated WYSIWYG chart: ${chartName}`);
          }
        }

        for (const [tagName, data] of Object.entries(reportData.data)) {
          if (data.length === 0) continue;

          const classification = tagClassifications.get(tagName);
          const stats = reportData.statistics?.[tagName];

          // Generate standard chart with trend line and statistics if NOT provided by frontend
          const hasFrontendChart = Array.from(enhancedCharts.keys()).some(k => k === tagName || k.startsWith(`${tagName} - `));

          if (!hasFrontendChart) {
            const trendLine = trendLines.get(tagName);
            const statistics = stats ? {
              min: stats.min,
              max: stats.max,
              mean: stats.average,
              stdDev: stats.standardDeviation
            } : undefined;

            const lineChartData: any = {
              tagName,
              data,
              trendLine,
              statistics
            };

            try {
              const chartBuffer = await chartGenerationService.generateLineChart(
                [lineChartData],
                {
                  title: `${tagName} - Time Series Data`,
                  width: 1200,
                  height: 600,
                  timezone: reportData.config.timeRange.timezone,
                  includeTrendLines: includeTrendLines
                }
              );

              enhancedCharts.set(`${tagName} - Data Trend`, chartBuffer);
              reportLogger.debug(`Enhanced chart generated for ${tagName}`);
            } catch (error) {
              reportLogger.error(`Failed to generate line chart for ${tagName}`, {
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              // Chart generation failed - report will continue without this chart
              // The addChartsSection method will handle missing charts gracefully
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
            Subject: reportData.config.metadata?.subject || reportData.config.description || '',
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

        // Add Key Findings
        this.addKeyFindings(doc, reportData);

        // -- Section and page break
        doc.addPage();

        // *** Section Information (only displayed if option Statistics Summary is selected)
        if (includeStatsSummary && reportData.statistics) {
          doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('Statistics Summary', { align: 'center' });
          doc.moveDown(1);
          this.addStatisticalSummary(doc, reportData.statistics);
          doc.addPage();
        }

        // *** Section Data visualization (ALWAYS DISPLAYED)
        doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('Data Visualization', { align: 'center' });
        doc.moveDown(1);

        // Separate SPC charts to be used in Section Statistical Process Control Analysis later
        const spcCharts = new Map<string, Buffer>();
        for (const [chartName, chartBuffer] of enhancedCharts.entries()) {
          if (chartName.includes('SPC Chart')) {
            spcCharts.set(chartName, chartBuffer);
          }
        }



        // 2. Individual Tag Charts - Ordered and named exactly as in preview
        const individualChartsOrder = new Map<string, Buffer>();
        const individualDescriptions: Record<string, string> = {};

        for (const tagName of reportData.config.tags) {
          // Priority 1: Check for exact tag name (usually the captured chart from frontend)
          // Priority 2: Check for generated trend chart (suffix " - Data Trend")
          let chartBuffer = enhancedCharts.get(tagName);
          let chartTitle = tagName;

          if (!chartBuffer) {
            const trendName = `${tagName} - Data Trend`;
            chartBuffer = enhancedCharts.get(trendName);
            if (chartBuffer) {
              chartTitle = trendName;
            }
          }

          if (chartBuffer) {
            individualChartsOrder.set(chartTitle, chartBuffer);
            const info = reportData.tagInfo?.[tagName];
            if (info?.description) {
              individualDescriptions[chartTitle] = info.description;
            }
          }
        }

        if (individualChartsOrder.size > 0) {
          this.addChartsSection(doc, Object.fromEntries(individualChartsOrder), false, individualDescriptions);
        }

        doc.addPage();

        // *** Trend Analysis (only displayed if Include Trend Lines option is selected)
        if (includeTrendLines) {
          doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('Trend Analysis', { align: 'center' });
          doc.moveDown(1);

          let isFirstTag = true;
          for (const [tagName, data] of Object.entries(reportData.data)) {
            if (data.length > 0) {
              if (!isFirstTag || doc.y > doc.page.height - 300) {
                doc.addPage();
              }
              this.addTagSection(doc, tagName, data, reportData);
              isFirstTag = false;
            }
          }
          doc.addPage();
        }

        // *** Section Statistical Process Control Analysis (only displayed if SPC charts option is selected)
        if (includeSPCCharts && (spcCharts.size > 0 || spcMetricsSummary.length > 0)) {
          doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('Statistical Process Control Analysis', { align: 'center' });
          doc.moveDown(1);

          if (spcCharts.size > 0) {
            this.addChartsSection(doc, Object.fromEntries(spcCharts), false);
          }

          if (spcMetricsSummary.length > 0) {
            if (doc.y > doc.page.height - 300) {
              doc.addPage();
            } else {
              doc.moveDown(1);
            }
            this.addSPCMetricsTable(doc, spcMetricsSummary);
          }
          doc.addPage();
        }

        // *** Section Data table (only displayed if Includes Data Table is selected)
        if (reportData.config.includeDataTable) {
          doc.fontSize(16).fillColor('#111827').font('Helvetica-Bold').text('Data Table', { align: 'center' });
          doc.moveDown(1);

          for (const [tagName, data] of Object.entries(reportData.data)) {
            if (data.length > 0) {
              this.addDataTable(doc, tagName, data);
              doc.addPage();
            }
          }
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
        console.error('DEBUG: generatePDFReport caught error:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Add report header with branding
   */
  private addReportHeader(doc: PDFKit.PDFDocument, config: ReportConfig): void {
    // Company name - Kagome branding or from config
    const companyName = config.branding?.companyName || 'Kagome';
    doc.fontSize(16)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(companyName, 40, 25);

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
    doc.y = 90;  // Increased from 75
    doc.x = 40;   // Explicitly reset x to margin
  }

  /**
   * Add report title (name + description).
   * Section I component 1 & 2: Title and Description.
   */
  private addReportTitle(doc: PDFKit.PDFDocument, config: ReportConfig): void {
    const title = config.version
      ? `${config.name} (v${config.version})`
      : config.name;

    // Title — large, bold, centred
    doc.fontSize(22)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text(title, 40, doc.y, { align: 'center', width: doc.page.width - 80 });

    doc.moveDown(0.6);

    // Description — subtitle in muted colour
    if (config.description) {
      doc.fontSize(13)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text(config.description, 40, doc.y, { align: 'center', width: doc.page.width - 80 });
      doc.moveDown(0.5);
    }

    // Thin separator line
    doc.strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .stroke();

    doc.moveDown(0.8);
    doc.fillColor('#111827');
    doc.x = 40;
  }

  /**
   * Add compact metadata strip (report period, tags, generated date).
   * Section I supporting metadata — sits between Title and Executive Summary.
   */
  private addReportMetadata(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    const { config } = reportData;
    const tz = config.timeRange.timezone || env.DEFAULT_TIMEZONE;

    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: tz
    };

    const fmt = (d: Date | unknown) =>
      d instanceof Date ? d.toLocaleString('en-US', formatOptions) : 'Unknown';

    const startStr = fmt(config.timeRange.startTime);
    const endStr = fmt(config.timeRange.endTime);
    const genStr = fmt(reportData.generatedAt);
    const tagList = config.tags.join(', ');

    doc.x = 40;
    doc.fontSize(10);

    // Report period row
    doc.fillColor('#6b7280').font('Helvetica')
      .text(`Period: ${startStr} — ${endStr}  (${tz})`, 40, doc.y, {
        width: doc.page.width - 80
      });

    // Tags row
    doc.text(`Tags: ${tagList}`, 40, doc.y, { width: doc.page.width - 80 });

    // Generated row
    doc.text(`Generated: ${genStr}`, 40, doc.y, { width: doc.page.width - 80 });

    doc.moveDown(1);

    // Thin separator
    doc.strokeColor('#e5e7eb')
      .lineWidth(0.5)
      .moveTo(40, doc.y)
      .lineTo(doc.page.width - 40, doc.y)
      .stroke();

    doc.moveDown(1);
    doc.fillColor('#111827');
    doc.x = 40;
  }

  /**
   * Add executive summary paragraph.
   * Section I component 3: Executive Summary.
   * Note: Key Findings is a separate component (addKeyFindings) — not embedded here.
   */
  private addExecutiveSummary(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    const totalTags = reportData.config.tags.length;
    const totalDataPoints = Object.values(reportData.data)
      .reduce((sum, data) => sum + data.length, 0);

    // Compose adaptive summary text
    const sections: string[] = [];
    if (reportData.config.includeStatsSummary) sections.push('statistical summaries');
    if (reportData.config.includeTrendLines) sections.push('trend analysis');
    if (reportData.config.includeSPCCharts) sections.push('SPC analysis');
    if (reportData.config.includeDataTable) sections.push('raw data tables');
    if (sections.length === 0) sections.push('data visualization');

    const sectionList = sections.length > 1
      ? sections.slice(0, -1).join(', ') + ', and ' + sections[sections.length - 1]
      : sections[0];

    const summaryText =
      `This report analyses ${totalTags} monitoring point(s) over the configured time period, ` +
      `covering ${totalDataPoints.toLocaleString()} data points in total. ` +
      `It includes ${sectionList}.`;

    // Section header
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Executive Summary', 40);

    doc.moveDown(0.4);

    // Summary paragraph
    doc.fontSize(11)
      .fillColor('#374151')
      .font('Helvetica')
      .text(summaryText, 40, doc.y, { width: doc.page.width - 80, align: 'justify' });

    doc.moveDown(1);
    doc.fillColor('#111827');
    doc.x = 40;
  }

  /**
   * Add key findings as bullet points.
   * Section I component 4: Key Findings.
   */
  private addKeyFindings(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    const totalTags = reportData.config.tags.length;
    const totalDataPoints = Object.values(reportData.data)
      .reduce((sum, data) => sum + data.length, 0);

    // Build findings list
    const findings: string[] = [
      `Analysed ${totalTags} monitoring point(s) for the configured time interval.`,
      `Processed ${totalDataPoints.toLocaleString()} data points in total across all tags.`
    ];

    // Per-tag statistical highlights
    if (reportData.statistics && Object.keys(reportData.statistics).length > 0) {
      let maxAvgTag = '';
      let maxAvgVal = -Infinity;
      let minQualityTag = '';
      let minQualityVal = Infinity;

      for (const [tag, stats] of Object.entries(reportData.statistics)) {
        if (stats.average > maxAvgVal) {
          maxAvgVal = stats.average;
          maxAvgTag = tag;
        }
        if (stats.dataQuality < minQualityVal) {
          minQualityVal = stats.dataQuality;
          minQualityTag = tag;
        }
      }

      if (maxAvgTag) {
        findings.push(
          `Highest average value: ${maxAvgTag} at ${maxAvgVal.toFixed(2)}.`
        );
      }
      if (minQualityTag && minQualityVal < 100) {
        findings.push(
          `Data quality attention: ${minQualityTag} has ${minQualityVal.toFixed(1)}% good-quality readings.`
        );
      }
    } else {
      findings.push('No statistical summary available — enable "Include Statistics Summary" for detailed metrics.');
    }

    // Conditional-section summaries
    const enabledSections: string[] = [];
    if (reportData.config.includeStatsSummary) enabledSections.push('Statistics Summary');
    if (reportData.config.includeTrendLines) enabledSections.push('Trend Analysis');
    if (reportData.config.includeSPCCharts) enabledSections.push('SPC Analysis');
    if (reportData.config.includeDataTable) enabledSections.push('Data Table');
    if (enabledSections.length > 0) {
      findings.push(`Additional sections included: ${enabledSections.join(', ')}.`);
    }

    // --- Render ---
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Key Findings', 40, doc.y);

    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica').fillColor('#374151');

    for (const finding of findings) {
      doc.text(`•  ${finding}`, 50, doc.y, { width: doc.page.width - 90, align: 'left' });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.8);
    doc.fillColor('#111827');
    doc.x = 40;
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

    const tagInfo = reportData.tagInfo?.[tagName];
    if (tagInfo?.description) {
      doc.fontSize(10)
        .fillColor('#4b5563')
        .font('Helvetica-Oblique')
        .text(tagInfo.description);
      doc.moveDown(0.2);
    }

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
  private addChartsSection(
    doc: PDFKit.PDFDocument,
    charts: Record<string, Buffer>,
    printHeader: boolean = true,
    descriptions: Record<string, string | undefined> = {}
  ): void {
    if (printHeader) {
      doc.fontSize(16)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text('Data Visualizations', { align: 'center' });
      doc.moveDown(1.5);
    }

    let chartCount = 0;

    reportLogger.info('Adding charts section to PDF', {
      totalCharts: Object.keys(charts).length
    });

    for (const [chartName, chartBuffer] of Object.entries(charts)) {
      // Logic for 2 charts per page
      if (chartCount > 0 && chartCount % 2 === 0) {
        doc.addPage();
        reportLogger.debug('Added new page for charts', { chartCount });
      }

      const chartWidth = 515;
      const chartHeight = 280;

      // Print Title
      doc.fontSize(14)
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .text(chartName, { align: 'center' });

      // Print Description if available
      const description = descriptions[chartName];
      if (description) {
        doc.moveDown(0.3);
        doc.fontSize(10)
          .fillColor('#4b5563')
          .font('Helvetica')
          .text(description, { align: 'center', width: chartWidth });
      }

      doc.moveDown(0.7);

      // Validate buffer before embedding
      const validation = chartBufferValidator.validateBuffer(chartBuffer, chartName);

      if (!validation.valid) {
        reportLogger.error('Chart buffer validation failed before embedding', {
          chartName,
          errors: validation.errors
        });

        doc.fontSize(12)
          .font('Helvetica')
          .fillColor('#ef4444')
          .text(`Chart could not be displayed: ${validation.errors[0]}`, {
            align: 'center',
            width: chartWidth
          })
          .fillColor('#111827');
      } else {
        try {
          const bufferInfo = chartBufferValidator.getBufferInfo(chartBuffer);

          if (bufferInfo.format === 'SVG') {
            const svgString = chartBuffer.toString('utf8');
            // @ts-ignore - svg-to-pdfkit type definitions might be missing or incomplete
            const SVGtoPDF = require('svg-to-pdfkit');

            reportLogger.debug('Embedding SVG chart', {
              chartName,
              svgLength: svgString.length,
              x: doc.x,
              y: doc.y
            });

            SVGtoPDF(doc, svgString, doc.x, doc.y, {
              width: chartWidth,
              height: chartHeight,
              preserveAspectRatio: 'xMidYMid meet'
            });

            doc.y += chartHeight + 20;
          } else {
            doc.image(chartBuffer, doc.x, doc.y, {
              fit: [chartWidth, chartHeight],
              align: 'center'
            });
            doc.y += chartHeight + 20;
          }
        } catch (error) {
          reportLogger.error('Failed to embed chart image', { chartName, error });
        }
      }

      chartCount++;
    }
  }

  /**
   * Add statistical summary section (Section II of the report)
   * Renders a professional banded table with all key metrics per tag.
   * Columns: Tag | Mean | Median | Std Dev | Min | Max | Count | Quality %
   */
  private addStatisticalSummary(
    doc: PDFKit.PDFDocument,
    statistics: Record<string, StatisticsResult>
  ): void {
    if (Object.keys(statistics).length === 0) {
      doc.fontSize(11)
        .fillColor('#6b7280')
        .font('Helvetica')
        .text('No statistical data available for the selected tags.', 40, doc.y);
      return;
    }

    // ── Section header ──────────────────────────────────────────────────────
    doc.fontSize(14)
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .text('Statistical Summary', 40);

    doc.moveDown(0.4);

    doc.fontSize(10)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(
        'The table below shows key statistical metrics computed from the queried time-series data for each monitoring tag.',
        40, doc.y,
        { width: doc.page.width - 80, align: 'left' }
      );

    doc.moveDown(1);

    // ── Table layout ────────────────────────────────────────────────────────
    const pageWidth = doc.page.width - 80;  // usable width with 40px margins
    const tableLeft = 40;

    // Column definitions  [label, relativeWidth]
    const columns: Array<{ label: string; width: number; align: 'left' | 'center' | 'right' }> = [
      { label: 'Tag', width: pageWidth * 0.20, align: 'left' },
      { label: 'Mean', width: pageWidth * 0.11, align: 'center' },
      { label: 'Median', width: pageWidth * 0.11, align: 'center' },
      { label: 'Std Dev', width: pageWidth * 0.11, align: 'center' },
      { label: 'Min', width: pageWidth * 0.11, align: 'center' },
      { label: 'Max', width: pageWidth * 0.11, align: 'center' },
      { label: 'Count', width: pageWidth * 0.10, align: 'center' },
      { label: 'Quality', width: pageWidth * 0.15, align: 'center' },
    ];

    const totalTableWidth = columns.reduce((s, c) => s + c.width, 0);
    const headerHeight = 26;
    const rowHeight = 22;

    // ── Helper: check page break ─────────────────────────────────────────
    const ensureSpace = (needed: number): void => {
      if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
      }
    };

    // ── Draw header row ──────────────────────────────────────────────────
    ensureSpace(headerHeight + rowHeight);

    const headerTop = doc.y;

    // Header background
    doc.rect(tableLeft, headerTop, totalTableWidth, headerHeight)
      .fill('#1e3a5f');

    // Header text
    let xPos = tableLeft;
    doc.fontSize(8.5)
      .fillColor('#ffffff')
      .font('Helvetica-Bold');

    columns.forEach(col => {
      doc.text(col.label, xPos + 4, headerTop + 7, {
        width: col.width - 8,
        align: col.align
      });
      xPos += col.width;
    });

    let currentY = headerTop + headerHeight;

    // ── Draw data rows ───────────────────────────────────────────────────
    const entries = Object.entries(statistics);

    entries.forEach(([tagName, stats], rowIndex) => {
      ensureSpace(rowHeight);
      currentY = doc.y;

      // Alternating row background
      if (rowIndex % 2 === 0) {
        doc.rect(tableLeft, currentY, totalTableWidth, rowHeight)
          .fill('#f8fafc');
      } else {
        doc.rect(tableLeft, currentY, totalTableWidth, rowHeight)
          .fill('#ffffff');
      }

      // Subtle left accent bar on odd rows
      if (rowIndex % 2 !== 0) {
        doc.rect(tableLeft, currentY, 3, rowHeight)
          .fill('#dbeafe');
      }

      // Cell values
      const qualityPct = stats.dataQuality;
      const cells: string[] = [
        tagName.length > 24 ? tagName.substring(0, 22) + '…' : tagName,
        typeof stats.average === 'number' ? stats.average.toFixed(3) : 'N/A',
        typeof stats.median === 'number' ? stats.median.toFixed(3) : 'N/A',
        typeof stats.standardDeviation === 'number' ? stats.standardDeviation.toFixed(3) : 'N/A',
        typeof stats.min === 'number' ? stats.min.toFixed(3) : 'N/A',
        typeof stats.max === 'number' ? stats.max.toFixed(3) : 'N/A',
        typeof stats.count === 'number' ? stats.count.toLocaleString() : 'N/A',
        // Quality rendered separately below
        ''
      ];

      xPos = tableLeft;
      doc.font('Helvetica').fontSize(8).fillColor('#111827');

      cells.forEach((cell, colIndex) => {
        const col = columns[colIndex]!;
        if (colIndex < columns.length - 1) {
          // Normal text cell
          doc.text(cell, xPos + 4, currentY + 7, {
            width: col.width - 8,
            align: col.align
          });
        } else {
          // ── Quality column: progress bar + percentage ──────────────────
          const qualityCol = col;
          const barAreaX = xPos + 4;
          const barAreaW = qualityCol.width - 8;
          const barH = 7;
          const barY = currentY + rowHeight / 2 - barH / 2;

          // Background track
          doc.roundedRect(barAreaX, barY, barAreaW, barH, 2).fill('#e5e7eb');

          // Filled portion
          const fillW = Math.max(0, Math.min(barAreaW, barAreaW * (qualityPct / 100)));
          const fillColor = qualityPct >= 90 ? '#16a34a'
            : qualityPct >= 70 ? '#ca8a04'
              : '#dc2626';
          if (fillW > 0) {
            doc.roundedRect(barAreaX, barY, fillW, barH, 2).fill(fillColor);
          }

          // Percentage text after bar
          doc.fillColor('#374151').font('Helvetica').fontSize(7.5)
            .text(`${qualityPct.toFixed(1)}%`, barAreaX, currentY + 7, {
              width: barAreaW,
              align: 'center'
            });
        }
        xPos += col.width;
      });

      // Bottom separator line
      doc.strokeColor('#e5e7eb')
        .lineWidth(0.4)
        .moveTo(tableLeft, currentY + rowHeight)
        .lineTo(tableLeft + totalTableWidth, currentY + rowHeight)
        .stroke();

      doc.y = currentY + rowHeight;
    });

    // ── Table bottom border ──────────────────────────────────────────────
    doc.strokeColor('#1e3a5f')
      .lineWidth(1)
      .moveTo(tableLeft, doc.y)
      .lineTo(tableLeft + totalTableWidth, doc.y)
      .stroke();

    doc.moveDown(1);

    // ── Legend note ─────────────────────────────────────────────────────
    doc.fontSize(8)
      .fillColor('#6b7280')
      .font('Helvetica')
      .text(
        '* Quality %: proportion of data points with Good quality status (code 192). ' +
        'Std Dev = population standard deviation. Count = number of valid numeric data points.',
        40, doc.y,
        { width: doc.page.width - 80 }
      );

    doc.moveDown(0.5);
    doc.fillColor('#111827');
    doc.x = 40;
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
    const headers = ['Tag Name', 'Mean', 'StdDev', 'LCL', 'UCL', 'LSL', 'USL', 'Cp', 'Cpk', 'Stat'];
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