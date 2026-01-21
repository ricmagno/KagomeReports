# Design Document: Advanced Chart Analytics and SPC

## Overview

This design extends the Historian Reports PDF generation system with advanced analytics capabilities. The system will enhance existing charts with trend lines and statistical summaries, and introduce new Statistical Process Control (SPC) charts with capability metrics. The implementation integrates with the existing Chart.js-based chart generation pipeline and PDFKit report generation system.

The design focuses on three main areas:
1. **Enhanced Standard Charts**: Adding trend equations and statistical summaries to existing time-series charts
2. **SPC Chart Generation**: Creating new control charts with control limits and out-of-control indicators
3. **SPC Metrics Calculation**: Computing process capability indices (Cp/Cpk) and related statistics

## Architecture

### System Components

The feature integrates into the existing architecture with minimal changes to the core structure:

```
┌─────────────────────────────────────────────────────────────┐
│                    Report Generation Flow                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Data Retrieval Service (existing)                          │
│  - Fetch time-series data from AVEVA Historian              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Tag Classification Service (NEW)                           │
│  - Classify tags as Analog or Digital                       │
│  - Determine which analytics to apply                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Statistical Analysis Service (ENHANCED)                    │
│  - Calculate trend lines (linear regression)                │
│  - Calculate R² values                                      │
│  - Calculate SPC metrics (Cp, Cpk, control limits)         │
│  - Calculate summary statistics (min, max, mean, stddev)   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Chart Generation Service (ENHANCED)                        │
│  - Generate standard charts with trend lines               │
│  - Generate SPC charts with control limits                 │
│  - Add statistical summaries to charts                     │
│  - Convert charts to images for PDF                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  PDF Report Generation Service (ENHANCED)                   │
│  - Embed enhanced charts in PDF                            │
│  - Add SPC metrics summary table                           │
│  - Maintain grayscale printer-friendly design              │
└─────────────────────────────────────────────────────────────┘
```

### Integration Points

1. **Statistical Analysis Service** (`src/services/statisticalAnalysis.ts`):
   - Add trend line calculation functions
   - Add SPC metrics calculation functions
   - Add tag classification logic

2. **Report Generation Service** (`src/services/reportGeneration.ts`):
   - Enhance chart generation to include trend lines
   - Add SPC chart generation
   - Add SPC metrics summary table

3. **Chart.js Configuration**:
   - Configure plugins for trend lines
   - Configure annotations for control limits
   - Configure legend for statistical summaries

## Components and Interfaces

### 1. Tag Classification Service

**Purpose**: Determine whether a tag is analog (continuous) or digital (binary) to apply appropriate analytics.

**Interface**:
```typescript
interface TagClassification {
  tagName: string;
  type: 'analog' | 'digital';
  confidence: number; // 0-1, how confident the classification is
}

interface TagClassificationService {
  /**
   * Classify a tag based on its data characteristics
   */
  classifyTag(data: TimeSeriesData[]): TagClassification;
  
  /**
   * Classify multiple tags in batch
   */
  classifyTags(tagData: Map<string, TimeSeriesData[]>): Map<string, TagClassification>;
}
```

**Classification Algorithm**:
```typescript
function classifyTag(data: TimeSeriesData[]): TagClassification {
  // Extract unique values
  const uniqueValues = new Set(data.map(d => d.value));
  
  // If only 2 unique values and they are 0/1 or similar binary pattern
  if (uniqueValues.size === 2) {
    const values = Array.from(uniqueValues).sort();
    if ((values[0] === 0 && values[1] === 1) || 
        (values[0] === 0 && values[1] === 100)) {
      return { tagName: data[0].tagName, type: 'digital', confidence: 1.0 };
    }
  }
  
  // If more than 10 unique values, likely analog
  if (uniqueValues.size > 10) {
    return { tagName: data[0].tagName, type: 'analog', confidence: 0.95 };
  }
  
  // Check for continuous distribution
  const range = Math.max(...data.map(d => d.value)) - Math.min(...data.map(d => d.value));
  const avgGap = range / uniqueValues.size;
  
  // If gaps are small relative to range, likely analog
  if (avgGap < range * 0.1) {
    return { tagName: data[0].tagName, type: 'analog', confidence: 0.8 };
  }
  
  // Default to analog with low confidence
  return { tagName: data[0].tagName, type: 'analog', confidence: 0.5 };
}
```

### 2. Trend Line Calculation

**Purpose**: Calculate linear regression trend line and R² value for analog tags.

**Interface**:
```typescript
interface TrendLineResult {
  slope: number;        // m in y = mx + b
  intercept: number;    // b in y = mx + b
  rSquared: number;     // Coefficient of determination (0-1)
  equation: string;     // Formatted equation string
}

interface TrendLineCalculator {
  /**
   * Calculate linear regression trend line
   */
  calculateTrendLine(data: TimeSeriesData[]): TrendLineResult;
  
  /**
   * Format trend line equation for display
   */
  formatEquation(slope: number, intercept: number): string;
}
```

**Implementation**:
```typescript
function calculateTrendLine(data: TimeSeriesData[]): TrendLineResult {
  const n = data.length;
  
  if (n < 3) {
    throw new Error('Insufficient data points for trend calculation');
  }
  
  // Convert timestamps to numeric x values (seconds from start)
  const startTime = data[0].timestamp.getTime();
  const points = data.map(d => ({
    x: (d.timestamp.getTime() - startTime) / 1000, // seconds
    y: d.value
  }));
  
  // Calculate sums for linear regression
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const sumY2 = points.reduce((sum, p) => sum + p.y * p.y, 0);
  
  // Calculate slope and intercept
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Calculate R²
  const meanY = sumY / n;
  const ssTotal = points.reduce((sum, p) => sum + Math.pow(p.y - meanY, 2), 0);
  const ssResidual = points.reduce((sum, p) => {
    const predicted = slope * p.x + intercept;
    return sum + Math.pow(p.y - predicted, 2);
  }, 0);
  const rSquared = 1 - (ssResidual / ssTotal);
  
  return {
    slope: Number(slope.toFixed(2)),
    intercept: Number(intercept.toFixed(2)),
    rSquared: Number(rSquared.toFixed(3)),
    equation: formatEquation(slope, intercept)
  };
}

function formatEquation(slope: number, intercept: number): string {
  const m = slope.toFixed(2);
  const b = Math.abs(intercept).toFixed(2);
  const sign = intercept >= 0 ? '+' : '-';
  return `y = ${m}x ${sign} ${b}`;
}
```

### 3. SPC Metrics Calculation

**Purpose**: Calculate Statistical Process Control metrics including control limits and capability indices.

**Interface**:
```typescript
interface SpecificationLimits {
  lsl?: number;  // Lower Specification Limit
  usl?: number;  // Upper Specification Limit
}

interface SPCMetrics {
  mean: number;              // X̄ - Process average
  stdDev: number;            // σest - Estimated standard deviation
  ucl: number;               // Upper Control Limit (X̄ + 3σ)
  lcl: number;               // Lower Control Limit (X̄ - 3σ)
  cp: number | null;         // Process Capability Index
  cpk: number | null;        // Process Performance Index
  outOfControlPoints: number[]; // Indices of points outside control limits
}

interface SPCCalculator {
  /**
   * Calculate SPC metrics for a dataset
   */
  calculateSPCMetrics(
    data: TimeSeriesData[], 
    specLimits?: SpecificationLimits
  ): SPCMetrics;
  
  /**
   * Identify out-of-control points
   */
  identifyOutOfControlPoints(
    data: TimeSeriesData[], 
    ucl: number, 
    lcl: number
  ): number[];
}
```

**Implementation**:
```typescript
function calculateSPCMetrics(
  data: TimeSeriesData[], 
  specLimits?: SpecificationLimits
): SPCMetrics {
  const values = data.map(d => d.value);
  const n = values.length;
  
  // Calculate mean (X̄)
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  
  // Calculate standard deviation (σest)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  
  // Calculate control limits
  const ucl = mean + 3 * stdDev;
  const lcl = mean - 3 * stdDev;
  
  // Calculate Cp and Cpk if specification limits provided
  let cp: number | null = null;
  let cpk: number | null = null;
  
  if (specLimits?.lsl !== undefined && specLimits?.usl !== undefined) {
    // Validate specification limits
    if (specLimits.usl <= specLimits.lsl) {
      throw new Error('USL must be greater than LSL');
    }
    
    // Cp = (USL - LSL) / (6σ)
    cp = (specLimits.usl - specLimits.lsl) / (6 * stdDev);
    
    // Cpk = min((USL - X̄) / 3σ, (X̄ - LSL) / 3σ)
    const cpkUpper = (specLimits.usl - mean) / (3 * stdDev);
    const cpkLower = (mean - specLimits.lsl) / (3 * stdDev);
    cpk = Math.min(cpkUpper, cpkLower);
  }
  
  // Identify out-of-control points
  const outOfControlPoints = identifyOutOfControlPoints(data, ucl, lcl);
  
  return {
    mean: Number(mean.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    ucl: Number(ucl.toFixed(2)),
    lcl: Number(lcl.toFixed(2)),
    cp: cp !== null ? Number(cp.toFixed(2)) : null,
    cpk: cpk !== null ? Number(cpk.toFixed(2)) : null,
    outOfControlPoints
  };
}

function identifyOutOfControlPoints(
  data: TimeSeriesData[], 
  ucl: number, 
  lcl: number
): number[] {
  return data
    .map((d, index) => ({ value: d.value, index }))
    .filter(d => d.value > ucl || d.value < lcl)
    .map(d => d.index);
}
```

### 4. Enhanced Chart Configuration

**Purpose**: Configure Chart.js to display trend lines, statistical summaries, and SPC elements.

**Standard Chart with Trend Line**:
```typescript
interface EnhancedChartConfig {
  data: TimeSeriesData[];
  trendLine?: TrendLineResult;
  statistics: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
  grayscale: boolean;
}

function createEnhancedChart(config: EnhancedChartConfig): ChartConfiguration {
  const datasets = [
    {
      label: 'Data',
      data: config.data.map(d => ({ x: d.timestamp, y: d.value })),
      borderColor: config.grayscale ? '#000000' : '#3b82f6',
      backgroundColor: 'transparent',
      pointRadius: 2,
      borderWidth: 1
    }
  ];
  
  // Add trend line if available
  if (config.trendLine) {
    const startTime = config.data[0].timestamp.getTime();
    const endTime = config.data[config.data.length - 1].timestamp.getTime();
    
    datasets.push({
      label: `Trend: ${config.trendLine.equation} (R² = ${config.trendLine.rSquared})`,
      data: [
        { x: new Date(startTime), y: config.trendLine.intercept },
        { 
          x: new Date(endTime), 
          y: config.trendLine.slope * ((endTime - startTime) / 1000) + config.trendLine.intercept 
        }
      ],
      borderColor: config.grayscale ? '#666666' : '#ef4444',
      borderDash: [5, 5],
      borderWidth: 2,
      pointRadius: 0,
      fill: false
    });
  }
  
  return {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#000000',
            font: { size: 10 }
          }
        },
        annotation: {
          annotations: {
            statsBox: {
              type: 'label',
              xValue: 0.95,
              yValue: 0.95,
              xAdjust: 0,
              yAdjust: 0,
              content: [
                `Min: ${config.statistics.min.toFixed(2)}`,
                `Max: ${config.statistics.max.toFixed(2)}`,
                `Avg: ${config.statistics.mean.toFixed(2)}`,
                `StdDev: ${config.statistics.stdDev.toFixed(2)}`
              ],
              font: { size: 9 },
              color: '#000000',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderColor: '#000000',
              borderWidth: 1,
              padding: 6
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'hour' },
          ticks: { color: '#000000' }
        },
        y: {
          ticks: { color: '#000000' }
        }
      }
    }
  };
}
```

**SPC Chart Configuration**:
```typescript
interface SPCChartConfig {
  data: TimeSeriesData[];
  spcMetrics: SPCMetrics;
  specLimits?: SpecificationLimits;
  grayscale: boolean;
}

function createSPCChart(config: SPCChartConfig): ChartConfiguration {
  const { data, spcMetrics, specLimits, grayscale } = config;
  
  // Main data series
  const datasets = [
    {
      label: 'Process Data',
      data: data.map(d => ({ x: d.timestamp, y: d.value })),
      borderColor: grayscale ? '#000000' : '#3b82f6',
      backgroundColor: 'transparent',
      pointRadius: 3,
      pointBackgroundColor: data.map((d, i) => 
        spcMetrics.outOfControlPoints.includes(i) 
          ? (grayscale ? '#000000' : '#ef4444')
          : (grayscale ? '#666666' : '#3b82f6')
      ),
      borderWidth: 1
    }
  ];
  
  // Annotations for control limits and center line
  const annotations: any = {
    centerLine: {
      type: 'line',
      yMin: spcMetrics.mean,
      yMax: spcMetrics.mean,
      borderColor: grayscale ? '#000000' : '#10b981',
      borderWidth: 2,
      label: {
        content: `X̄ = ${spcMetrics.mean}`,
        enabled: true,
        position: 'end'
      }
    },
    ucl: {
      type: 'line',
      yMin: spcMetrics.ucl,
      yMax: spcMetrics.ucl,
      borderColor: grayscale ? '#666666' : '#ef4444',
      borderDash: [5, 5],
      borderWidth: 2,
      label: {
        content: `UCL = ${spcMetrics.ucl}`,
        enabled: true,
        position: 'end'
      }
    },
    lcl: {
      type: 'line',
      yMin: spcMetrics.lcl,
      yMax: spcMetrics.lcl,
      borderColor: grayscale ? '#666666' : '#ef4444',
      borderDash: [5, 5],
      borderWidth: 2,
      label: {
        content: `LCL = ${spcMetrics.lcl}`,
        enabled: true,
        position: 'end'
      }
    }
  };
  
  // Add specification limits if provided
  if (specLimits?.usl !== undefined) {
    annotations.usl = {
      type: 'line',
      yMin: specLimits.usl,
      yMax: specLimits.usl,
      borderColor: grayscale ? '#333333' : '#f59e0b',
      borderDash: [10, 5],
      borderWidth: 1,
      label: {
        content: `USL = ${specLimits.usl}`,
        enabled: true,
        position: 'start'
      }
    };
  }
  
  if (specLimits?.lsl !== undefined) {
    annotations.lsl = {
      type: 'line',
      yMin: specLimits.lsl,
      yMax: specLimits.lsl,
      borderColor: grayscale ? '#333333' : '#f59e0b',
      borderDash: [10, 5],
      borderWidth: 1,
      label: {
        content: `LSL = ${specLimits.lsl}`,
        enabled: true,
        position: 'start'
      }
    };
  }
  
  return {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: 'Statistical Process Control Chart',
          color: '#000000',
          font: { size: 14, weight: 'bold' }
        },
        legend: {
          display: true,
          position: 'top'
        },
        annotation: { annotations }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'hour' },
          ticks: { color: '#000000' }
        },
        y: {
          ticks: { color: '#000000' }
        }
      }
    }
  };
}
```

### 5. SPC Metrics Summary Table

**Purpose**: Display SPC metrics in a formatted table within the PDF report.

**Interface**:
```typescript
interface SPCMetricsSummary {
  tagName: string;
  mean: number;
  stdDev: number;
  lsl: number | null;
  usl: number | null;
  cp: number | null;
  cpk: number | null;
  capability: 'Capable' | 'Marginal' | 'Not Capable' | 'N/A';
}

function generateSPCMetricsTable(
  doc: PDFKit.PDFDocument, 
  metrics: SPCMetricsSummary[]
): void;
```

**Implementation**:
```typescript
function generateSPCMetricsTable(
  doc: PDFKit.PDFDocument, 
  metrics: SPCMetricsSummary[]
): void {
  const tableTop = doc.y + 20;
  const colWidths = [120, 60, 60, 60, 60, 60, 60, 80];
  const headers = ['Tag Name', 'X̄', 'σest', 'LSL', 'USL', 'Cp', 'Cpk', 'Capability'];
  
  // Draw table header
  let x = 50;
  doc.fontSize(10).font('Helvetica-Bold');
  headers.forEach((header, i) => {
    doc.text(header, x, tableTop, { width: colWidths[i], align: 'center' });
    x += colWidths[i];
  });
  
  // Draw header underline
  doc.moveTo(50, tableTop + 15)
     .lineTo(50 + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
     .stroke();
  
  // Draw table rows
  let y = tableTop + 25;
  doc.fontSize(9).font('Helvetica');
  
  metrics.forEach(metric => {
    x = 50;
    
    // Tag name
    doc.text(metric.tagName, x, y, { width: colWidths[0], align: 'left' });
    x += colWidths[0];
    
    // Mean
    doc.text(metric.mean.toFixed(2), x, y, { width: colWidths[1], align: 'center' });
    x += colWidths[1];
    
    // StdDev
    doc.text(metric.stdDev.toFixed(2), x, y, { width: colWidths[2], align: 'center' });
    x += colWidths[2];
    
    // LSL
    doc.text(metric.lsl !== null ? metric.lsl.toFixed(2) : 'N/A', x, y, { width: colWidths[3], align: 'center' });
    x += colWidths[3];
    
    // USL
    doc.text(metric.usl !== null ? metric.usl.toFixed(2) : 'N/A', x, y, { width: colWidths[4], align: 'center' });
    x += colWidths[4];
    
    // Cp
    doc.text(metric.cp !== null ? metric.cp.toFixed(2) : 'N/A', x, y, { width: colWidths[5], align: 'center' });
    x += colWidths[5];
    
    // Cpk
    doc.text(metric.cpk !== null ? metric.cpk.toFixed(2) : 'N/A', x, y, { width: colWidths[6], align: 'center' });
    x += colWidths[6];
    
    // Capability assessment
    doc.text(metric.capability, x, y, { width: colWidths[7], align: 'center' });
    
    y += 20;
    
    // Add page break if needed
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
  });
}

function assessCapability(cp: number | null, cpk: number | null): string {
  if (cp === null || cpk === null) return 'N/A';
  
  if (cpk >= 1.33) return 'Capable';
  if (cpk >= 1.0) return 'Marginal';
  return 'Not Capable';
}
```

## Data Models

### Extended Report Configuration

```typescript
interface ReportConfiguration {
  // Existing fields...
  name: string;
  tags: string[];
  startTime: Date;
  endTime: Date;
  
  // New fields for SPC
  specificationLimits?: Map<string, SpecificationLimits>;
  includeSPCCharts: boolean;
  includeTrendLines: boolean;
  includeStatsSummary: boolean;
}
```

### Tag Analytics Data

```typescript
interface TagAnalytics {
  tagName: string;
  classification: TagClassification;
  trendLine?: TrendLineResult;
  spcMetrics?: SPCMetrics;
  statistics: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
  };
}
```

### Enhanced Report Data

```typescript
interface EnhancedReportData {
  // Existing fields...
  configuration: ReportConfiguration;
  timeSeriesData: Map<string, TimeSeriesData[]>;
  
  // New fields
  tagAnalytics: Map<string, TagAnalytics>;
  spcMetricsSummary: SPCMetricsSummary[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Linear Regression Correctness
*For any* time-series dataset with at least 3 data points, the calculated trend line slope and intercept should satisfy the least squares regression formulas, where the sum of squared residuals is minimized.
**Validates: Requirements 1.1**

### Property 2: Trend Equation Formatting
*For any* calculated slope and intercept values, the formatted equation string should match the pattern "y = {slope}x {sign} {intercept}" where slope and intercept are rounded to 2 decimal places and sign is "+" or "-".
**Validates: Requirements 1.2**

### Property 3: R² Value Formatting
*For any* calculated R² value, it should be rounded to exactly 3 decimal places and be within the range [0, 1].
**Validates: Requirements 1.3**

### Property 4: Digital Tag Exclusion from Analytics
*For any* tag classified as digital (binary values), the system should not calculate trend lines, SPC charts, or SPC metrics for that tag.
**Validates: Requirements 1.4, 3.6, 6.4**

### Property 5: Statistical Calculations Accuracy
*For any* time-series dataset, the calculated minimum, maximum, mean, and standard deviation should match the mathematical definitions: min is the smallest value, max is the largest value, mean is the sum divided by count, and standard deviation is the square root of variance.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 6: Statistical Value Formatting
*For any* calculated statistical value (min, max, mean, stddev), when formatted for display, it should be rounded to exactly 2 decimal places.
**Validates: Requirements 2.5**

### Property 7: SPC Chart Generation for Analog Tags
*For any* analog tag in a report, an SPC chart should be generated with a center line, upper control limit, and lower control limit.
**Validates: Requirements 3.1**

### Property 8: Control Limits Formula Correctness
*For any* SPC chart, the upper control limit should equal the mean plus 3 times the standard deviation, and the lower control limit should equal the mean minus 3 times the standard deviation.
**Validates: Requirements 3.3, 3.4**

### Property 9: Center Line Equals Mean
*For any* SPC chart, the center line value should exactly equal the calculated mean of the process data.
**Validates: Requirements 3.2**

### Property 10: Out-of-Control Point Identification
*For any* data point in an SPC chart, if its value exceeds the upper control limit or falls below the lower control limit, it should be identified as an out-of-control point.
**Validates: Requirements 3.5**

### Property 11: SPC Metrics Formula Correctness
*For any* dataset with specification limits, the calculated Cp should equal (USL - LSL) / (6 × σest), and Cpk should equal the minimum of (USL - X̄) / (3 × σest) and (X̄ - LSL) / (3 × σest).
**Validates: Requirements 4.3, 4.4**

### Property 12: Cp and Cpk Calculation Presence
*For any* analog tag with configured specification limits, both Cp and Cpk values should be calculated and included in the metrics.
**Validates: Requirements 4.1, 4.2**

### Property 13: Missing Spec Limits Handling
*For any* tag without configured specification limits, the Cp and Cpk values should be null or display as "N/A".
**Validates: Requirements 4.5**

### Property 14: SPC Metrics Summary Completeness
*For any* SPC metrics summary, it should include all required fields: X̄ (mean), σest (standard deviation), LSL, USL, Cp, Cpk, and capability assessment.
**Validates: Requirements 4.6**

### Property 15: Specification Limits Validation
*For any* provided specification limits, if USL is less than or equal to LSL, the system should reject the configuration with a validation error.
**Validates: Requirements 5.2**

### Property 16: Specification Limits Persistence
*For any* report configuration with specification limits, saving and then loading the configuration should return the same specification limit values.
**Validates: Requirements 5.4**

### Property 17: Default Handling for Missing Spec Limits
*For any* tag without specification limits, the system should either use default values or mark Cp/Cpk metrics as "N/A" without failing.
**Validates: Requirements 5.3**

### Property 18: Tag Classification Correctness
*For any* tag data, if it contains only two distinct values that are 0 and 1 (or similar binary pattern), it should be classified as digital; otherwise, if it has continuous numeric values, it should be classified as analog.
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 19: PDF Report Content Completeness
*For any* generated PDF report with analog tags, it should include trend equations on standard charts, statistical summaries on charts, SPC charts for each analog tag, and an SPC metrics summary table.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 20: Invalid Specification Limits Rejection
*For any* specification limits where USL ≤ LSL, the system should display an error message and prevent report generation.
**Validates: Requirements 9.2**

## Error Handling

### Error Categories

1. **Insufficient Data Errors**:
   - Trend line calculation requires minimum 3 data points
   - SPC metrics calculation requires minimum 2 data points
   - Error message: "Insufficient data for {analysis_type}"
   - Action: Display "N/A" for affected metrics, continue report generation

2. **Invalid Configuration Errors**:
   - USL ≤ LSL validation failure
   - Missing required tag data
   - Error message: "Invalid configuration: {specific_issue}"
   - Action: Prevent report generation, display error to user

3. **Calculation Errors**:
   - Division by zero in Cp/Cpk calculations (when σest = 0)
   - Numerical overflow/underflow
   - Error message: "Calculation error for {metric_name}"
   - Action: Log error, display "N/A" for affected metric, continue

4. **Chart Rendering Errors**:
   - Chart.js rendering failure
   - Image conversion failure
   - Error message: "Chart rendering failed for {tag_name}"
   - Action: Include placeholder image with error message, continue

### Error Handling Strategy

```typescript
interface AnalyticsError {
  type: 'insufficient_data' | 'invalid_config' | 'calculation' | 'rendering';
  message: string;
  tagName?: string;
  metric?: string;
  recoverable: boolean;
}

class AnalyticsErrorHandler {
  private errors: AnalyticsError[] = [];
  
  handleError(error: AnalyticsError): void {
    // Log error
    logger.error('Analytics error', error);
    
    // Store for reporting
    this.errors.push(error);
    
    // Determine if we should continue
    if (!error.recoverable) {
      throw new Error(`Unrecoverable error: ${error.message}`);
    }
  }
  
  getErrors(): AnalyticsError[] {
    return this.errors;
  }
  
  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}
```

### Graceful Degradation

The system implements graceful degradation to ensure reports are generated even when some analytics fail:

1. **Trend Line Failure**: Display chart without trend line, include note in report
2. **SPC Metrics Failure**: Display "N/A" for failed metrics, include available metrics
3. **Chart Rendering Failure**: Include placeholder with error message, continue with other charts
4. **Tag Classification Uncertainty**: Default to analog classification, log warning

### Error Logging

All errors are logged with structured data for debugging:

```typescript
logger.error('Analytics calculation failed', {
  tagName: 'TAG001',
  analysisType: 'trend_line',
  error: error.message,
  dataPoints: data.length,
  timestamp: new Date().toISOString()
});
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Specific trend line calculations with known inputs/outputs
- Edge cases: empty datasets, single data points, all identical values
- Error conditions: invalid spec limits, division by zero
- Integration points: Chart.js configuration, PDFKit rendering

**Property-Based Tests**: Verify universal properties across all inputs
- Linear regression correctness across random datasets
- SPC formula correctness across random process data
- Tag classification across various data patterns
- Statistical calculation accuracy across random distributions

### Property-Based Testing Configuration

**Testing Library**: fast-check (already used in the project)

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: advanced-chart-analytics, Property {N}: {description}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

describe('Feature: advanced-chart-analytics', () => {
  describe('Property 1: Linear Regression Correctness', () => {
    it('should calculate correct slope and intercept for any dataset', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({
            timestamp: fc.date(),
            value: fc.float({ min: -1000, max: 1000 })
          }), { minLength: 3, maxLength: 100 }),
          (data) => {
            const result = calculateTrendLine(data);
            
            // Verify least squares property
            const residuals = data.map(d => {
              const predicted = result.slope * d.timestamp.getTime() + result.intercept;
              return Math.pow(d.value - predicted, 2);
            });
            const sumSquaredResiduals = residuals.reduce((a, b) => a + b, 0);
            
            // Any other line should have higher sum of squared residuals
            // (This is the defining property of least squares regression)
            expect(sumSquaredResiduals).toBeLessThanOrEqual(
              calculateAlternativeResiduals(data, result.slope + 0.1, result.intercept)
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 8: Control Limits Formula Correctness', () => {
    it('should calculate UCL and LCL using 3-sigma rule', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: 100 }), { minLength: 10, maxLength: 100 }),
          (values) => {
            const data = values.map((v, i) => ({
              timestamp: new Date(Date.now() + i * 1000),
              value: v,
              tagName: 'TEST',
              quality: 192
            }));
            
            const metrics = calculateSPCMetrics(data);
            
            // Verify UCL = mean + 3*sigma
            expect(metrics.ucl).toBeCloseTo(metrics.mean + 3 * metrics.stdDev, 2);
            
            // Verify LCL = mean - 3*sigma
            expect(metrics.lcl).toBeCloseTo(metrics.mean - 3 * metrics.stdDev, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
```

### Unit Test Coverage

**Key Areas for Unit Tests**:

1. **Tag Classification**:
   - Binary data (0/1) → digital
   - Binary data (0/100) → digital
   - Continuous data → analog
   - Edge case: 3 unique values → analog

2. **Trend Line Calculation**:
   - Known linear data (y = 2x + 5) → correct slope/intercept
   - Horizontal line (y = 10) → slope = 0
   - Vertical spread → low R²
   - Perfect fit → R² = 1.0

3. **SPC Metrics**:
   - Known dataset → verify Cp/Cpk calculations
   - Process centered between limits → Cp = Cpk
   - Process off-center → Cpk < Cp
   - No spec limits → Cp/Cpk = null

4. **Error Handling**:
   - < 3 data points → insufficient data error
   - USL ≤ LSL → validation error
   - σest = 0 → handle division by zero

5. **Chart Generation**:
   - Analog tag → includes trend line
   - Digital tag → no trend line
   - SPC chart → includes control limits
   - Statistics legend → positioned correctly

### Integration Testing

**End-to-End Report Generation**:
1. Configure report with mixed analog/digital tags
2. Set specification limits for some tags
3. Generate report
4. Verify PDF contains:
   - Enhanced charts with trend lines (analog only)
   - Statistical summaries on all charts
   - SPC charts (analog only)
   - SPC metrics summary table
   - Proper grayscale rendering

### Performance Testing

While not part of correctness properties, performance should be monitored:

1. **Benchmark Tests**:
   - Trend line calculation: < 100ms per tag
   - SPC metrics calculation: < 200ms per tag
   - Full report with 10 tags: < 30 seconds

2. **Load Testing**:
   - Large datasets (10,000+ points)
   - Multiple concurrent report generations
   - Memory usage monitoring

### Test Data Generators

**For Property-Based Tests**:
```typescript
// Generate random time-series data
const timeSeriesArbitrary = fc.array(
  fc.record({
    timestamp: fc.date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') }),
    value: fc.float({ min: -100, max: 100 }),
    quality: fc.constantFrom(192, 0, 128),
    tagName: fc.constantFrom('TAG001', 'TAG002', 'TAG003')
  }),
  { minLength: 3, maxLength: 1000 }
);

// Generate binary (digital) data
const digitalDataArbitrary = fc.array(
  fc.record({
    timestamp: fc.date(),
    value: fc.constantFrom(0, 1),
    quality: fc.constant(192),
    tagName: fc.constant('DIGITAL_TAG')
  }),
  { minLength: 10, maxLength: 100 }
);

// Generate specification limits
const specLimitsArbitrary = fc.record({
  lsl: fc.float({ min: 0, max: 50 }),
  usl: fc.float({ min: 51, max: 100 })
});
```

## Implementation Notes

### Dependencies

**New Dependencies**:
- `chartjs-plugin-annotation`: For adding control limits and reference lines to charts
- No additional dependencies required (Chart.js and fast-check already in project)

**Existing Dependencies**:
- Chart.js: Chart generation
- PDFKit: PDF report generation
- fast-check: Property-based testing

### Performance Considerations

1. **Caching**: Cache calculated analytics for tags to avoid recalculation
2. **Batch Processing**: Calculate analytics for all tags in parallel where possible
3. **Lazy Evaluation**: Only calculate SPC metrics when spec limits are provided
4. **Efficient Algorithms**: Use single-pass algorithms for statistical calculations

### Backward Compatibility

- Existing reports without SPC features continue to work unchanged
- New fields in report configuration are optional
- Default behavior: include trend lines and statistics, SPC charts only if spec limits provided

### Configuration Options

Add to report configuration UI:
- Checkbox: "Include trend lines on charts" (default: true)
- Checkbox: "Include statistical summaries" (default: true)
- Checkbox: "Generate SPC charts" (default: true if spec limits provided)
- Per-tag inputs: LSL and USL values

### Migration Path

No database migration required - new features are additive:
1. Deploy updated code
2. Existing report configurations work as-is
3. Users can optionally add spec limits to enable SPC features
4. New reports automatically include trend lines and statistics
