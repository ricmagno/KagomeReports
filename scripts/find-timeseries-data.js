const sql = require('mssql');

async function findTimeSeriesData() {
  try {
    console.log('Looking for time-series data tables...');
    
    const config = {
      server: '192.168.235.17',
      user: 'historian',
      password: '8&(@Zb7RETf2fw8O21*!Ok^1@%GaI2jy',
      database: 'Runtime',
      options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    const pool = await sql.connect(config);

    // Look for wwRetrievalMode function or similar
    console.log('\n=== Checking for AVEVA Historian functions ===');
    try {
      const functions = await pool.request().query(`
        SELECT ROUTINE_NAME, ROUTINE_TYPE
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_NAME LIKE '%ww%' OR ROUTINE_NAME LIKE '%Retrieval%'
        ORDER BY ROUTINE_NAME
      `);
      
      console.log('AVEVA Historian functions:');
      functions.recordset.forEach(func => {
        console.log(`  - ${func.ROUTINE_NAME} (${func.ROUTINE_TYPE})`);
      });
    } catch (error) {
      console.log('Error checking functions:', error.message);
    }

    // Try to use wwRetrievalMode function with a known tag
    console.log('\n=== Testing wwRetrievalMode function ===');
    try {
      const testTag = 'Analog'; // We saw this tag in the _Tag table
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endTime = new Date();
      
      console.log(`Testing with tag: ${testTag}`);
      console.log(`Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      const result = await pool.request()
        .input('TagName', sql.NVarChar, testTag)
        .input('StartTime', sql.DateTime2, startTime)
        .input('EndTime', sql.DateTime2, endTime)
        .input('RetrievalMode', sql.Int, 1) // 1 = Full mode
        .query(`
          SELECT TOP 10 * FROM wwRetrievalMode(@TagName, @StartTime, @EndTime, @RetrievalMode)
        `);
      
      if (result.recordset.length > 0) {
        console.log('✅ wwRetrievalMode function works!');
        console.log('Columns:', Object.keys(result.recordset[0]));
        console.log('Sample data:');
        result.recordset.forEach((row, index) => {
          console.log(`  Row ${index + 1}:`, row);
        });
      } else {
        console.log('No data returned from wwRetrievalMode');
      }
    } catch (error) {
      console.log('Error testing wwRetrievalMode:', error.message);
    }

    // Try alternative approaches
    console.log('\n=== Looking for other time-series approaches ===');
    
    // Check if there are any views
    try {
      const views = await pool.request().query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.VIEWS
        WHERE TABLE_NAME LIKE '%ww%' OR TABLE_NAME LIKE '%History%' OR TABLE_NAME LIKE '%Data%'
        ORDER BY TABLE_NAME
      `);
      
      console.log('Relevant views:');
      views.recordset.forEach(view => {
        console.log(`  - ${view.TABLE_NAME}`);
      });
    } catch (error) {
      console.log('Error checking views:', error.message);
    }

    // Try to find stored procedures
    try {
      const procedures = await pool.request().query(`
        SELECT ROUTINE_NAME
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_TYPE = 'PROCEDURE'
          AND (ROUTINE_NAME LIKE '%ww%' OR ROUTINE_NAME LIKE '%History%' OR ROUTINE_NAME LIKE '%Data%')
        ORDER BY ROUTINE_NAME
      `);
      
      console.log('Relevant stored procedures:');
      procedures.recordset.forEach(proc => {
        console.log(`  - ${proc.ROUTINE_NAME}`);
      });
    } catch (error) {
      console.log('Error checking procedures:', error.message);
    }

    await pool.close();
    console.log('\n✅ Time-series data search completed');

  } catch (error) {
    console.error('❌ Time-series data search failed:', error.message);
  }
}

findTimeSeriesData();