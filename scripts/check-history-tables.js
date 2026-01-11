const sql = require('mssql');

async function checkHistoryTables() {
  try {
    console.log('Checking for history data tables...');
    
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

    // Check for history-related tables
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (LOWER(TABLE_NAME) LIKE '%history%' 
             OR LOWER(TABLE_NAME) LIKE '%analog%' 
             OR LOWER(TABLE_NAME) LIKE '%discrete%'
             OR LOWER(TABLE_NAME) LIKE '%string%'
             OR LOWER(TABLE_NAME) LIKE '%snapshot%')
      ORDER BY TABLE_NAME
    `);
    
    console.log('\nHistory-related tables:');
    for (const table of tables.recordset) {
      console.log(`\n=== ${table.TABLE_NAME} ===`);
      
      try {
        // Get column structure
        const columns = await pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${table.TABLE_NAME}'
          ORDER BY ORDINAL_POSITION
        `);
        
        console.log('Columns:');
        columns.recordset.forEach(col => {
          console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        
        // Try to get sample data
        const sample = await pool.request().query(`SELECT TOP 2 * FROM ${table.TABLE_NAME}`);
        if (sample.recordset.length > 0) {
          console.log('Sample data:');
          sample.recordset.forEach((row, index) => {
            console.log(`  Row ${index + 1}:`, row);
          });
        } else {
          console.log('No data in table');
        }
      } catch (error) {
        console.log(`Error accessing ${table.TABLE_NAME}:`, error.message);
      }
    }

    await pool.close();
    console.log('\n✅ History tables check completed');

  } catch (error) {
    console.error('❌ History tables check failed:', error.message);
  }
}

checkHistoryTables();