# PDF Report Generation Plan

## Overview

This document outlines the comprehensive plan for implementing PDF report generation based on the specifications in `Reports.MD`. The system will generate professional, printable reports from AVEVA Historian data with configurable sections and WYSIWYG (What You See Is What You Get) chart rendering.

## Core Principle: WYSIWYG

The preview ApexCharts shown in the web interface must appear **exactly** as they do in the generated PDF. ApexChart.js supports exporting charts as SVG or PNG, which should be leveraged for PDF generation.

---

## Report Structure

### Section I: Report Information *(Always Displayed)*

**Components:**

- **Title**: Report name/title
- **Description**: Report description text
- **Executive Summary**: High-level overview of the report findings
- **Key Findings**: Bullet points or paragraphs highlighting important discoveries

> **Page Break**

---

### Section II: Statistics Summary *(Conditional)*

**Display Condition:** Only shown when "Include Statistics Summary" option is selected

**Components:**

Statistical metrics for all tags:

- Mean (Average)
- Median
- Standard Deviation
- Minimum Value
- Maximum Value
- Count of data points
- Quality metrics

> **Page Break**

---

### Section III: Data Visualization *(Always Displayed)*

**Display Condition:** Always shown

**Components:**

1. **Multi-Trend Chart**
   - Combined chart showing all selected tags on one graph
   - Uses ApexChart from preview (WYSIWYG)
   - Title: Report name
   - Description: Report description
   - Export format: SVG or PNG from ApexChart.js

2. **Individual Tag Charts**
   - One chart per tag
   - Uses ApexChart from preview (WYSIWYG)
   - Maintains same order, colors, titles, descriptions, and ranges as preview
   - Export format: SVG or PNG from ApexChart.js

> **Page Break**

---

### Section IV: Trend Analysis *(Conditional)*

**Display Condition:** Only shown when "Include Trend Lines" option is selected

**Section Title:** "Trend Analysis" (renamed from "Multi-trend Analysis")

**Components:**

1. **Time Series Charts with Trend Lines**
   - Current time series data with overlaid trend lines
   - Trend equation displayed (e.g., `y = mx + b`)
   - R² (R-squared) value showing goodness of fit
   - Statistical metrics:
     - Minimum value
     - Maximum value
     - Average value
     - Standard Deviation

2. **Statistical Summary**
   - Detailed statistical breakdown per tag

3. **Trend Analysis (Linear Regression)**
   - Regression analysis results
   - Interpretation of trends
   - Slope and intercept values

> **Page Break**

---

### Section V: Statistical Process Control Analysis *(Conditional)*

**Display Condition:** Only shown when "Include SPC Charts" option is selected

**Components:**

1. **SPC Charts**
   - Control charts for each tag
   - Upper Control Limit (UCL)
   - Lower Control Limit (LCL)
   - Center Line (CL)
   - Data points with out-of-control indicators

2. **Specification Limits** *(Sub-option)*
   - **Display Condition:** Only shown as submenu when "Include SPC Charts" is selected
   - User-defined specification limits:
     - Upper Specification Limit (USL)
     - Lower Specification Limit (LSL)
   - Process capability metrics (Cp, Cpk)

> **Page Break**

---

### Section VI: Data Table *(Conditional)*

**Display Condition:** Only shown when "Include Data Table" option is selected

**Components:**

- Tabular data for all selected tags
- Columns:
  - Timestamp
  - Tag Name
  - Value
  - Quality Code
  - Status
- Pagination for large datasets
- Professional table formatting

**End of Report**

---

## Chart Options Configuration

### Advanced Analytics Options

All options are **disabled by default** and must be explicitly enabled by the user.

**Option Hierarchy:**

```
☐ Include Statistics Summary
☐ Include Trend Lines
☐ Include SPC Charts
    ☐ Specification Limits (submenu, only visible when SPC Charts is checked)
☐ Include Data Table
```

**Implementation Notes:**

- Options should be checkboxes in the report configuration UI
- "Specification Limits" is a nested option under "Include SPC Charts"
- When "Include SPC Charts" is unchecked, "Specification Limits" should be hidden
- Default state: All options unchecked

---

## Technical Implementation Strategy

### 1. Chart Export Strategy

**Approach:** Use ApexChart.js built-in export functionality

**Options:**

- **SVG Export** *(Recommended)*
  - Vector format, scales perfectly
  - Smaller file size
  - Better quality at any resolution
  - Method: `chart.dataURI({ type: 'svg' })`

- **PNG Export** *(Alternative)*
  - Raster format
  - Larger file size
  - Fixed resolution
  - Method: `chart.dataURI({ type: 'png' })`

**Implementation:**

```javascript
// Export chart as SVG
const chartDataUri = await chart.dataURI({
  type: 'svg',
  width: 800,
  height: 400
});

// Use in PDF generation
doc.addImage(chartDataUri.imgURI, 'SVG', x, y, width, height);
```

### 2. PDF Generation Library

**Current:** PDFKit or similar library

**Requirements:**

- Support for SVG/PNG image embedding
- Page break control
- Professional formatting
- Header/footer support
- Table generation

### 3. Data Flow

```
User Configuration
    ↓
Report Preview (ApexCharts rendered)
    ↓
Generate PDF Request
    ↓
Export ApexCharts as SVG/PNG
    ↓
Build PDF Sections (conditional based on options)
    ↓
Embed Charts (WYSIWYG)
    ↓
Generate Final PDF
    ↓
Download/Email
```

### 4. Section Rendering Logic

```typescript
interface ReportOptions {
  includeStatisticsSummary: boolean;
  includeTrendLines: boolean;
  includeSPCCharts: boolean;
  includeSpecificationLimits: boolean; // Only relevant if includeSPCCharts is true
  includeDataTable: boolean;
}

function generatePDF(config: ReportConfig, options: ReportOptions) {
  // Section I: Always render
  renderReportInformation();
  addPageBreak();

  // Section II: Conditional
  if (options.includeStatisticsSummary) {
    renderStatisticsSummary();
    addPageBreak();
  }

  // Section III: Always render
  renderDataVisualization();
  addPageBreak();

  // Section IV: Conditional
  if (options.includeTrendLines) {
    renderTrendAnalysis();
    addPageBreak();
  }

  // Section V: Conditional
  if (options.includeSPCCharts) {
    renderSPCAnalysis(options.includeSpecificationLimits);
    addPageBreak();
  }

  // Section VI: Conditional
  if (options.includeDataTable) {
    renderDataTable();
  }
}
```

---

## UI/UX Considerations

### Report Configuration Panel

**Location:** Report configuration form

**Layout:**

```
┌─────────────────────────────────────┐
│ Report Configuration                │
├─────────────────────────────────────┤
│ Title: [________________]           │
│ Description: [________________]     │
│                                     │
│ Advanced Analytics Options:         │
│ ☐ Include Statistics Summary        │
│ ☐ Include Trend Lines               │
│ ☐ Include SPC Charts                │
│   ☐ Specification Limits            │
│ ☐ Include Data Table                │
└─────────────────────────────────────┘
```

### Preview Behavior

- Preview should show all sections that will appear in the PDF
- Charts in preview must match PDF output exactly (WYSIWYG)
- Conditional sections should be hidden in preview when options are disabled

---

## Data Requirements

### For Each Section

**Section I (Report Information):**

- User-provided title
- User-provided description
- Auto-generated or user-provided executive summary
- Auto-generated or user-provided key findings

**Section II (Statistics Summary):**

- Statistical calculations from time-series data
- Aggregated metrics per tag

**Section III (Data Visualization):**

- ApexChart configurations from preview
- Chart data (time-series values)
- Chart styling (colors, labels, ranges)

**Section IV (Trend Analysis):**

- Linear regression calculations
- Trend line equations
- R² values
- Statistical metrics

**Section V (SPC Analysis):**

- Control limit calculations (UCL, LCL, CL)
- Specification limits (if enabled)
- Process capability metrics (Cp, Cpk)
- Out-of-control point detection

**Section VI (Data Table):**

- Raw time-series data
- Timestamp, value, quality code for each point

---

## Quality Assurance

### WYSIWYG Validation

- [ ] Multi-trend chart matches preview exactly
- [ ] Individual charts match preview exactly (order, color, range)
- [ ] Chart titles and descriptions match preview
- [ ] Statistical values match preview calculations

### Conditional Rendering Validation

- [ ] Statistics Summary only appears when option is enabled
- [ ] Trend Analysis only appears when option is enabled
- [ ] SPC Charts only appear when option is enabled
- [ ] Specification Limits only appear when parent option is enabled
- [ ] Data Table only appears when option is enabled

### Page Break Validation

- [ ] Page breaks occur after each major section
- [ ] No orphaned content
- [ ] Headers/footers consistent across pages

### Professional Formatting

- [ ] Consistent fonts and sizing
- [ ] Proper margins and spacing
- [ ] Clear section headings
- [ ] Professional color scheme
- [ ] Company branding (if applicable)

---

## Implementation Phases

### Phase 1: Core Structure

1. Implement Section I (Report Information)
2. Implement Section III (Data Visualization) with WYSIWYG charts
3. Add page break logic
4. Basic PDF generation

### Phase 2: Conditional Sections

1. Implement Statistics Summary (Section II)
2. Implement Trend Analysis (Section IV)
3. Implement SPC Analysis (Section V)
4. Implement Data Table (Section VI)

### Phase 3: Chart Export Integration

1. Integrate ApexChart SVG/PNG export
2. Ensure WYSIWYG rendering
3. Optimize chart quality and file size

### Phase 4: UI Configuration

1. Add Advanced Analytics options to UI
2. Implement nested option logic (Specification Limits)
3. Update preview to reflect options
4. Add validation and error handling

### Phase 5: Testing & Refinement

1. WYSIWYG validation testing
2. Conditional rendering testing
3. Performance optimization
4. User acceptance testing

---

## Success Criteria

1. **WYSIWYG Compliance**: PDF charts match preview exactly
2. **Conditional Rendering**: Sections appear/disappear based on options
3. **Professional Quality**: Reports are print-ready and professional
4. **Performance**: PDF generation completes in reasonable time (<30 seconds)
5. **Accuracy**: All statistical calculations are correct
6. **Usability**: Configuration options are intuitive and clear

---

## Notes and Considerations

### ApexChart Export

- Test both SVG and PNG export to determine best quality/performance
- Consider caching exported charts for scheduled reports
- Handle chart export errors gracefully

### Page Layout

- Consider landscape vs portrait orientation for wide charts
- Ensure charts fit within page margins
- Handle multi-page tables with proper headers

### Performance

- Large datasets may require pagination in data tables
- Consider async PDF generation for complex reports
- Implement progress indicators for long-running generations

### Accessibility

- Ensure PDF is accessible (tagged PDF)
- Include alt text for charts
- Use proper heading hierarchy

### Future Enhancements

- Custom branding/logos
- Multiple chart types (bar, pie, scatter)
- Export to other formats (DOCX, Excel)
- Interactive PDF features
- Batch report generation
