#!/bin/bash

# Script to test data comparison between raw query and report generation

echo "======================================================================"
echo "DATA COMPARISON TEST"
echo "Tag: Kagome_AU.TC11_TT004_PV"
echo "Time Range: 2002-03-14 06:00 to 2002-03-14 18:00"
echo "======================================================================"
echo ""

# First, let's generate a report using the API
echo "Step 1: Generating report via API..."
echo ""

curl -X POST http://127.0.0.1:3000/api/reports/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat /tmp/test-token.txt 2>/dev/null || echo 'test-token')" \
  -d '{
    "name": "Data Comparison Test",
    "description": "Testing data accuracy for Kagome_AU.TC11_TT004_PV",
    "tags": ["Kagome_AU.TC11_TT004_PV"],
    "timeRange": {
      "startTime": "2002-03-14T06:00:00.000Z",
      "endTime": "2002-03-14T18:00:00.000Z"
    },
    "chartTypes": ["line"],
    "template": "default",
    "format": "pdf",
    "includeStatistics": true,
    "includeTrends": true,
    "includeAnomalies": false
  }' | jq '.'

echo ""
echo "======================================================================"
echo "Report generation complete. Check the response above for:"
echo "  - dataMetrics.totalDataPoints"
echo "  - dataMetrics.statistics (min, max, average)"
echo "======================================================================"
