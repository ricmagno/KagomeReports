/**
 * Simple diagnostic script to compare raw query vs application data
 */

const sql = require('mssql');

const config = {
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

async function runDiagnostics() {
  console.log('='.repeat(80));
  console.log('DATA QUALITY DIAGNOSTIC');
  console.log('Tag: Kagome_AU.TC11_TT004_PV');
  console.log('Time: 2002-03-14 06:00 to 18:00');
  console.log('='.repeat(80));
  console.log('');

  try {
    const pool = await sql.connect(config);
    console.log('✓ Connected to database\n');

    // Test 1: Raw query from test_query.sql
    console.log('TEST 1: Raw SQL Query (from test_query.sql)');
    console.log('-'.repeat(80));
    
    const rawQuery = `
      SELECT DateTime, TagName, Value, Quality, wwRetrievalMode
      FROM History
      WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
      AND DateTime >= '2002-03-14 06:00'
      AND DateTime <= '2002-03-14 18:00'
      AND wwRetrievalMode = 'Cyclic'
      ORDER BY DateTime
    `;
    
    const rawResult = await pool.request().query(rawQuery);
    console.log(`Rows returned: ${rawResult.recordset.length}`);
    
    if (rawResult.recordset.length > 0) {
      console.log('\nFirst 5 rows:');
      rawResult.recordset.slice(0, 5).forEach((row, i) => {
        console.log(`  ${i+1}. ${row.DateTime.toISOString()} | Value: ${row.Value} | Quality: ${row.Quality} | Mode: ${row.wwRetrievalMode}`);
      });
      
      // Analyze quality codes
      const qualityCounts = {};
      rawResult.recordset.forEach(row => {
        const q = row.Quality;
        qualityCounts[q] = (qualityCounts[q] || 0) + 1;
      });
      
      console.log('\nQuality Code Distribution:');
      Object.entries(qualityCounts).forEach(([code, count]) => {
        const pct = ((count / rawResult.recordset.length) * 100).toFixed(1);
        const label = code === '192' ? 'Good' : code === '0' ? 'Bad' : code === '64' ? 'Uncertain' : 'Other';
        console.log(`  Quality ${code} (${label}): ${count} (${pct}%)`);
      });
      
      // Calculate statistics
      const values = rawResult.recordset.map(r => r.Value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      
      console.log('\nStatistics:');
      console.log(`  Min: ${min.toFixed(2)}`);
      console.log(`  Max: ${max.toFixed(2)}`);
      console.log(`  Avg: ${avg.toFixed(2)}`);
    }
    
    console.log('\n');
    
    // Test 2: Query without wwRetrievalMode filter
    console.log('TEST 2: Query WITHOUT wwRetrievalMode filter');
    console.log('-'.repeat(80));
    
    const noModeQuery = `
      SELECT TOP 10 DateTime, TagName, Value, Quality, wwRetrievalMode
      FROM History
      WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
      AND DateTime >= '2002-03-14 06:00'
      AND DateTime <= '2002-03-14 18:00'
      ORDER BY DateTime
    `;
    
    const noModeResult = await pool.request().query(noModeQuery);
    console.log(`Rows returned: ${noModeResult.recordset.length}`);
    
    if (noModeResult.recordset.length > 0) {
      console.log('\nSample rows:');
      noModeResult.recordset.forEach((row, i) => {
        console.log(`  ${i+1}. ${row.DateTime.toISOString()} | Value: ${row.Value} | Quality: ${row.Quality} | Mode: ${row.wwRetrievalMode}`);
      });
    }
    
    console.log('\n');
    
    // Test 3: Check what retrieval modes are available
    console.log('TEST 3: Available Retrieval Modes');
    console.log('-'.repeat(80));
    
    const modesQuery = `
      SELECT DISTINCT wwRetrievalMode, COUNT(*) as count
      FROM History
      WHERE TagName = 'Kagome_AU.TC11_TT004_PV'
      AND DateTime >= '2002-03-14 06:00'
      AND DateTime <= '2002-03-14 18:00'
      GROUP BY wwRetrievalMode
      ORDER BY count DESC
    `;
    
    const modesResult = await pool.request().query(modesQuery);
    console.log('Available modes for this time range:');
    modesResult.recordset.forEach(row => {
      console.log(`  ${row.wwRetrievalMode}: ${row.count} rows`);
    });
    
    await pool.close();
    
    console.log('\n' + '='.repeat(80));
    console.log('DIAGNOSTIC COMPLETE');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nThis might indicate:');
    console.error('  1. Database connection issue');
    console.error('  2. Incorrect database credentials');
    console.error('  3. Network connectivity problem');
    console.error('  4. Database server not accessible');
  }
}

runDiagnostics();
