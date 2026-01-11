const sql = require('mssql');

async function testDatabase() {
  try {
    console.log('Testing AVEVA Historian database connection...');
    
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
    console.log('✅ Connected to database');

    // Test basic query
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✅ Basic query successful');

    // Check available tables
    const tables = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\nAvailable tables:');
    tables.recordset.forEach(row => {
      console.log(`  - ${row.TABLE_NAME}`);
    });

    // Try to find tag-related tables
    console.log('\nLooking for tag-related tables...');
    const tagTables = tables.recordset.filter(row => 
      row.TABLE_NAME.toLowerCase().includes('tag') || 
      row.TABLE_NAME.toLowerCase().includes('ww')
    );
    
    for (const table of tagTables) {
      try {
        console.log(`\nChecking table: ${table.TABLE_NAME}`);
        const columns = await pool.request().query(`
          SELECT COLUMN_NAME, DATA_TYPE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = '${table.TABLE_NAME}'
          ORDER BY ORDINAL_POSITION
        `);
        
        console.log('  Columns:');
        columns.recordset.forEach(col => {
          console.log(`    - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
        });
        
        // Try to get sample data
        const sample = await pool.request().query(`SELECT TOP 3 * FROM ${table.TABLE_NAME}`);
        if (sample.recordset.length > 0) {
          console.log('  Sample data:', sample.recordset[0]);
        }
      } catch (error) {
        console.log(`  Error accessing ${table.TABLE_NAME}:`, error.message);
      }
    }

    await pool.close();
    console.log('\n✅ Database test completed');

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testDatabase();