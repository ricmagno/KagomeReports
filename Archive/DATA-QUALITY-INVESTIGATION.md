# Data Quality Investigation Report

## Issue Summary
Report generation for tag `Kagome_AU.TC11_TT004_PV` shows **0% data quality** despite retrieving 101 data points.

## Investigation Results

### Report Generation Test
**Test Parameters:**
- Tag: `Kagome_AU.TC11_TT004_PV`
- Time Range: `2002-03-14 06:00:00` to `2002-03-14 18:00:00`
- Retrieval Mode: Cyclic
- Format: PDF

**Results:**
```json
{
  "success": true,
  "reportId": "report_1768375812470_dzc2he5yx",
  "dataMetrics": {
    "totalDataPoints": 101,
    "tagsProcessed": 1,
    "processingTime": 431,
    "dataQuality": 0  // ⚠️ 0% quality!
  },
  "metadata": {
    "pages": 0,
    "fileSize": 29600,
    "format": "pdf",
    "generationTime": 37
  }
}
```

## Root Cause Analysis

### 1. SQL Query Structure
The application uses this query structure (from `src/services/dataRetrieval.ts`):

```sql
SELECT 
  DateTime as timestamp,
  TagName as tagName,
  Value as value,
  Quality as quality
FROM History
WHERE TagName = @tagName
  AND DateTime >= @startTime
  AND DateTime <= @endTime
  AND wwRetrievalMode = @mode
ORDER BY DateTime ASC
```

### 2. Your Test Query
Your `test_query.sql` uses:

```sql
SELECT DateTime, TagName, Value FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2002-03-14 06:00'
AND DateTime <= '2002-03-14 18:00'
AND wwRetrievalMode = 'Cyclic'
```

**Key Difference:** Your query doesn't select the `Quality` column!

### 3. Potential Issues

#### Issue A: Quality Code Interpretation
The application expects AVEVA Historian quality codes:
- `192` = Good quality
- `0` = Bad quality  
- `64` = Uncertain quality

If the database is returning quality codes that don't match these values, all data will be marked as "bad quality".

#### Issue B: Quality Column Missing or NULL
If the `Quality` column is NULL or doesn't exist in the result set, the application might default to treating all data as bad quality.

#### Issue C: Retrieval Mode Parameter
The `wwRetrievalMode = 'Cyclic'` filter might be:
- Case-sensitive (should it be 'CYCLIC' or 'cyclic'?)
- Not matching the actual mode value in the database
- Filtering out good quality data

## Recommended Actions

### Action 1: Verify Quality Column Values
Run this query to see actual quality codes:

```sql
SELECT 
  DateTime, 
  TagName, 
  Value, 
  Quality,
  wwRetrievalMode,
  CASE 
    WHEN Quality = 192 THEN 'Good'
    WHEN Quality = 0 THEN 'Bad'
    WHEN Quality = 64 THEN 'Uncertain'
    ELSE 'Other (' + CAST(Quality AS VARCHAR) + ')'
  END as QualityLabel
FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2002-03-14 06:00'
AND DateTime <= '2002-03-14 18:00'
AND wwRetrievalMode = 'Cyclic'
ORDER BY DateTime
```

### Action 2: Check Without Retrieval Mode Filter
Test if removing the `wwRetrievalMode` filter changes the results:

```sql
SELECT TOP 100
  DateTime, 
  TagName, 
  Value, 
  Quality,
  wwRetrievalMode
FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2002-03-14 06:00'
AND DateTime <= '2002-03-14 18:00'
ORDER BY DateTime
```

### Action 3: Verify Available Retrieval Modes
Check what retrieval modes are actually in the database:

```sql
SELECT DISTINCT wwRetrievalMode, COUNT(*) as RowCount
FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2002-03-14 06:00'
AND DateTime <= '2002-03-14 18:00'
GROUP BY wwRetrievalMode
ORDER BY RowCount DESC
```

### Action 4: Compare Statistics
Run this to get statistics directly from the database:

```sql
SELECT 
  COUNT(*) as TotalPoints,
  MIN(Value) as MinValue,
  MAX(Value) as MaxValue,
  AVG(Value) as AvgValue,
  SUM(CASE WHEN Quality = 192 THEN 1 ELSE 0 END) as GoodQualityCount,
  SUM(CASE WHEN Quality = 0 THEN 1 ELSE 0 END) as BadQualityCount,
  SUM(CASE WHEN Quality = 64 THEN 1 ELSE 0 END) as UncertainQualityCount
FROM History
WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
AND DateTime >= '2002-03-14 06:00'
AND DateTime <= '2002-03-14 18:00'
AND wwRetrievalMode = 'Cyclic'
```

## Code Locations to Check

### 1. Quality Code Mapping
**File:** `src/types/historian.ts`
```typescript
export enum QualityCode {
  Good = 192,
  Bad = 0,
  Uncertain = 64
}
```

### 2. Data Transformation
**File:** `src/services/dataRetrieval.ts` (around line 700-750)
Look for the `transformToTimeSeriesData` method that converts database rows to application format.

### 3. Statistics Calculation
**File:** `src/services/statisticalAnalysis.ts`
Check the `calculateStatistics` method to see how data quality percentage is calculated.

## Next Steps

1. **Run the diagnostic queries** above directly on the AVEVA Historian database
2. **Compare the Quality column values** with the expected quality codes (192, 0, 64)
3. **Check if the retrieval mode** 'Cyclic' is correct (case-sensitivity matters)
4. **Verify the data transformation** logic in the application code
5. **Test with a different tag** to see if the issue is tag-specific or system-wide

## Expected Outcome

After running the diagnostic queries, you should be able to determine:
- Whether the Quality column contains the expected values (192 for good data)
- Whether the wwRetrievalMode filter is working correctly
- Whether the issue is with data retrieval or data quality calculation

## Contact Points

If the issue persists:
1. Check AVEVA Historian documentation for quality code definitions
2. Verify the database schema matches expectations
3. Review the data retrieval service logs for any warnings or errors
4. Test with known-good data from a different time period

---

**Generated:** 2026-01-14
**Report ID:** report_1768375812470_dzc2he5yx
**Investigation Status:** Pending database query results
