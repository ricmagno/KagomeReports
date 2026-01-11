const sql = require('mssql');

async function testHistoryViews() {
  try {
    console.log('Testing AVEVA Historian views...');
    
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

    // Test the main History view
    console.log('\n=== Testing History view ===');
    try {
      const historyColumns = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'History'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('History view columns:');
      historyColumns.recordset.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
      });
      
      // Try to get sample data
      const historySample = await pool.request().query(`SELECT TOP 5 * FROM History`);
      if (historySample.recordset.length > 0) {
        console.log('Sample History data:');
        historySample.recordset.forEach((row, index) => {
          console.log(`  Row ${index + 1}:`, row);
        });
      } else {
        console.log('No data in History view');
      }
    } catch (error) {
      console.log('Error testing History view:', error.message);
    }

    // Test AnalogHistory view
    console.log('\n=== Testing AnalogHistory view ===');
    try {
      const analogColumns = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'AnalogHistory'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log('AnalogHistory view columns:');
      analogColumns.recordset.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
      });
      
      // Try to get sample data
      const analogSample = await pool.request().query(`SELECT TOP 5 * FROM AnalogHistory`);
      if (analogSample.recordset.length > 0) {
        console.log('Sample AnalogHistory data:');
        analogSample.recordset.forEach((row, index) => {
          console.log(`  Row ${index + 1}:`, row);
        });
      } else {
        console.log('No data in AnalogHistory view');
      }
    } catch (error) {
      console.log('Error testing AnalogHistory view:', error.message);
    }

    // Test with a specific tag
    console.log('\n=== Testing specific tag query ===');
    try {
      const testTag = 'Analog'; // We know this tag exists
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endTime = new Date();
      
      console.log(`Testing with tag: ${testTag}`);
      console.log(`Time range: ${startTime.toISOString()} to ${endTime.toISOString()}`);
      
      const result = await pool.request()
        .input('TagName', sql.NVarChar, testTag)
        .input('StartTime', sql.DateTime2, startTime)
        .input('EndTime', sql.DateTime2, endTime)
        .query(`
          SELECT TOP 10 * 
          FROM History 
          WHERE TagName = @TagName 
            AND DateTime >= @StartTime 
            AND DateTime <= @EndTime
          ORDER BY DateTime DESC
        `);
      
      if (result.recordset.length > 0) {
        console.log('✅ History query successful!');
        console.log('Columns:', Object.keys(result.recordset[0]));
        console.log('Sample data:');
        result.recordset.forEach((row, index) => {
          console.log(`  Row ${index + 1}:`, row);
        });
      } else {
        console.log('No historical data found for this tag in the time range');
      }
    } catch (error) {
      console.log('Error testing specific tag query:', error.message);
    }

    // Test tag list query
    console.log('\n=== Testing tag list query ===');
    try {
      const tagList = await pool.request().query(`
        SELECT TOP 10 
          TagName,
          Description,
          Unit,
          MinEU,
          MaxEU
        FROM _Tag 
        WHERE TagName IS NOT NULL
        ORDER BY TagName
      `);
      
      if (tagList.recordset.length > 0) {
        console.log('✅ Tag list query successful!');
        console.log('Available tags:');
        tagList.recordset.forEach((tag, index) => {
          console.log(`  ${index + 1}. ${tag.TagName} - ${tag.Description || 'No description'} (${tag.Unit || 'No unit'})`);
        });
      } else {
        console.log('No tags found');
      }
    } catch (error) {
      console.log('Error testing tag list query:', error.message);
    }

    await pool.close();
    console.log('\n✅ History views test completed');

  } catch (error) {
    console.error('❌ History views test failed:', error.message);
  }
}

testHistoryViews();