/**
 * Script to compare raw database query results with generated report data
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { dataRetrievalService } from '../src/services/dataRetrieval';
import { statisticalAnalysisService } from '../src/services/statisticalAnalysis';
import { reportGenerationService } from '../src/services/reportGeneration';

// Database configuration (from active config)
const dbConfig = {
  server: '192.168.235.17',
  port: 2433,
  database: 'Runtime',
  user: 'aaAdmin',
  password: 'aaAdmin',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000
  }
};

async function runRawQuery() {
  console.log('\n=== Running Raw SQL Query ===\n');
  
  const pool = await sql.connect(dbConfig);
  
  const query = `
    SELECT DateTime, TagName, Value, wwRetrievalMode 
    FROM History
    WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
    AND DateTime >= '2002-03-14 06:00'
    AND DateTime <= '2002-03-14 18:00'
    AND wwRetrievalMode = 'Cyclic'
    ORDER BY DateTime
  `;
  
  const result = await pool.request().query(query);
  
  console.log(`Total rows returned: ${result.recordset.length}`);
  console.log('\nFirst 10 rows:');
  console.log('DateTime\t\t\tTagName\t\t\t\tValue\t\tMode');
  console.log('='.repeat(100));
  
  result.recordset.slice(0, 10).forEach(row => {
    console.log(`${row.DateTime.toISOString()}\t${row.TagName}\t${row.Value}\t${row.wwRetrievalMode}`);
  });
  
  if (result.recordset.length > 10) {
    console.log('\n... (showing first 10 of ' + result.recordset.length + ' rows)');
    console.log('\nLast 10 rows:');
    console.log('DateTime\t\t\tTagName\t\t\t\tValue\t\tMode');
    console.log('='.repeat(100));
    
    result.recordset.slice(-10).forEach(row => {
      console.log(`${row.DateTime.toISOString()}\t${row.TagName}\t${row.Value}\t${row.wwRetrievalMode}`);
    });
  }
  
  // Calculate statistics
  const values = result.recordset.map(r => r.Value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  
  console.log('\n=== Raw Query Statistics ===');
  console.log(`Count: ${values.length}`);
  console.log(`Min: ${min.toFixed(2)}`);
  console.log(`Max: ${max.toFixed(2)}`);
  console.log(`Average: ${avg.toFixed(2)}`);
  
  await pool.close();
  
  return {
    count: result.recordset.length,
    data: result.recordset,
    stats: { min, max, avg }
  };
}

async function generateReportData() {
  console.log('\n\n=== Generating Report Data ===\n');
  
  const tagName = 'Kagome_AU.TC11_TT004_PV';
  const startTime = new Date('2002-03-14T06:00:00');
  const endTime = new Date('2002-03-14T18:00:00');
  
  console.log(`Tag: ${tagName}`);
  console.log(`Start: ${startTime.toISOString()}`);
  console.log(`End: ${endTime.toISOString()}`);
  
  // Retrieve data using the service
  const data = await dataRetrievalService.getTimeSeriesData(
    tagName,
    startTime,
    endTime,
    'Cyclic'
  );
  
  console.log(`\nTotal data points retrieved: ${data.length}`);
  
  if (data.length > 0) {
    console.log('\nFirst 10 data points:');
    console.log('Timestamp\t\t\tValue\t\tQuality');
    console.log('='.repeat(80));
    
    data.slice(0, 10).forEach(point => {
      console.log(`${point.timestamp.toISOString()}\t${point.value}\t${point.quality}`);
    });
    
    if (data.length > 10) {
      console.log('\n... (showing first 10 of ' + data.length + ' points)');
      console.log('\nLast 10 data points:');
      console.log('Timestamp\t\t\tValue\t\tQuality');
      console.log('='.repeat(80));
      
      data.slice(-10).forEach(point => {
        console.log(`${point.timestamp.toISOString()}\t${point.value}\t${point.quality}`);
      });
    }
  }
  
  // Calculate statistics using the service
  const stats = statisticalAnalysisService.calculateStatistics(data);
  
  console.log('\n=== Report Data Statistics ===');
  console.log(`Count: ${stats.count}`);
  console.log(`Min: ${stats.min.toFixed(2)}`);
  console.log(`Max: ${stats.max.toFixed(2)}`);
  console.log(`Average: ${stats.average.toFixed(2)}`);
  console.log(`Std Dev: ${stats.standardDeviation.toFixed(2)}`);
  console.log(`Data Quality: ${stats.dataQuality.toFixed(1)}%`);
  
  return {
    count: data.length,
    data: data,
    stats: stats
  };
}

async function compareResults(rawResult: any, reportResult: any) {
  console.log('\n\n=== COMPARISON RESULTS ===\n');
  
  console.log('Data Point Count:');
  console.log(`  Raw Query: ${rawResult.count}`);
  console.log(`  Report Service: ${reportResult.count}`);
  console.log(`  Difference: ${Math.abs(rawResult.count - reportResult.count)}`);
  
  if (rawResult.count !== reportResult.count) {
    console.log('  ⚠️  WARNING: Data point counts do not match!');
  } else {
    console.log('  ✅ Data point counts match');
  }
  
  console.log('\nStatistics Comparison:');
  console.log(`  Min Value:`);
  console.log(`    Raw: ${rawResult.stats.min.toFixed(2)}`);
  console.log(`    Report: ${reportResult.stats.min.toFixed(2)}`);
  console.log(`    Diff: ${Math.abs(rawResult.stats.min - reportResult.stats.min).toFixed(2)}`);
  
  console.log(`  Max Value:`);
  console.log(`    Raw: ${rawResult.stats.max.toFixed(2)}`);
  console.log(`    Report: ${reportResult.stats.max.toFixed(2)}`);
  console.log(`    Diff: ${Math.abs(rawResult.stats.max - reportResult.stats.max).toFixed(2)}`);
  
  console.log(`  Average:`);
  console.log(`    Raw: ${rawResult.stats.avg.toFixed(2)}`);
  console.log(`    Report: ${reportResult.stats.avg.toFixed(2)}`);
  console.log(`    Diff: ${Math.abs(rawResult.stats.avg - reportResult.stats.avg).toFixed(2)}`);
  
  // Check if values are within acceptable tolerance (0.01%)
  const tolerance = 0.0001;
  const minMatch = Math.abs(rawResult.stats.min - reportResult.stats.min) / rawResult.stats.min < tolerance;
  const maxMatch = Math.abs(rawResult.stats.max - reportResult.stats.max) / rawResult.stats.max < tolerance;
  const avgMatch = Math.abs(rawResult.stats.avg - reportResult.stats.avg) / rawResult.stats.avg < tolerance;
  
  console.log('\nValidation:');
  console.log(`  Min values match: ${minMatch ? '✅' : '❌'}`);
  console.log(`  Max values match: ${maxMatch ? '✅' : '❌'}`);
  console.log(`  Avg values match: ${avgMatch ? '✅' : '❌'}`);
  
  if (minMatch && maxMatch && avgMatch && rawResult.count === reportResult.count) {
    console.log('\n✅ SUCCESS: Data matches between raw query and report service!');
  } else {
    console.log('\n❌ ISSUE DETECTED: Data discrepancy found!');
    console.log('\nPossible causes:');
    console.log('  1. Different retrieval modes or sampling');
    console.log('  2. Data quality filtering differences');
    console.log('  3. Time zone conversion issues');
    console.log('  4. Query parameter differences');
  }
  
  // Sample data comparison
  if (rawResult.count > 0 && reportResult.count > 0) {
    console.log('\n=== Sample Data Point Comparison ===');
    console.log('\nFirst data point:');
    console.log(`  Raw: ${rawResult.data[0].DateTime.toISOString()} = ${rawResult.data[0].Value}`);
    console.log(`  Report: ${reportResult.data[0].timestamp.toISOString()} = ${reportResult.data[0].value}`);
    
    console.log('\nLast data point:');
    const rawLast = rawResult.data[rawResult.data.length - 1];
    const reportLast = reportResult.data[reportResult.data.length - 1];
    console.log(`  Raw: ${rawLast.DateTime.toISOString()} = ${rawLast.Value}`);
    console.log(`  Report: ${reportLast.timestamp.toISOString()} = ${reportLast.value}`);
  }
}

async function main() {
  try {
    console.log('='.repeat(100));
    console.log('DATA COMPARISON: Raw Query vs Report Service');
    console.log('Tag: Kagome_AU.TC11_TT004_PV');
    console.log('Time Range: 2002-03-14 06:00 to 2002-03-14 18:00');
    console.log('Retrieval Mode: Cyclic');
    console.log('='.repeat(100));
    
    // Run raw query
    const rawResult = await runRawQuery();
    
    // Generate report data
    const reportResult = await generateReportData();
    
    // Compare results
    await compareResults(rawResult, reportResult);
    
    console.log('\n' + '='.repeat(100));
    console.log('Comparison complete!');
    console.log('='.repeat(100) + '\n');
    
  } catch (error) {
    console.error('Error during comparison:', error);
    process.exit(1);
  }
}

main();
