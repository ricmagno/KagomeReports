#!/usr/bin/env ts-node

/**
 * Check AVEVA Historian Database Schema
 * This script queries the actual database to discover the correct column names
 */

import { getHistorianConnection } from '../src/services/historianConnection';
import { dbLogger } from '../src/utils/logger';

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking AVEVA Historian database schema...');
    
    const connection = getHistorianConnection();
    
    // Check if we can connect
    console.log('📡 Testing database connection...');
    const healthQuery = 'SELECT 1 as test';
    await connection.executeQuery(healthQuery, {});
    console.log('✅ Database connection successful');
    
    // Check available tables
    console.log('\n📋 Checking available tables...');
    const tablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;
    
    const tablesResult = await connection.executeQuery(tablesQuery, {});
    console.log('Available tables:');
    tablesResult.recordset.forEach((row: any) => {
      console.log(`  - ${row.TABLE_NAME}`);
    });
    
    // Check Tag table structure (if it exists)
    console.log('\n🏷️  Checking Tag table structure...');
    try {
      const tagColumnsQuery = `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'Tag'
        ORDER BY ORDINAL_POSITION
      `;
      
      const tagColumnsResult = await connection.executeQuery(tagColumnsQuery, {});
      if (tagColumnsResult.recordset.length > 0) {
        console.log('Tag table columns:');
        tagColumnsResult.recordset.forEach((row: any) => {
          console.log(`  - ${row.COLUMN_NAME} (${row.DATA_TYPE}, nullable: ${row.IS_NULLABLE})`);
        });
      } else {
        console.log('❌ Tag table not found or no columns returned');
      }
    } catch (error) {
      console.log('❌ Error checking Tag table:', error instanceof Error ? error.message : error);
    }
    
    // Check History table structure (if it exists)
    console.log('\n📊 Checking History table structure...');
    try {
      const historyColumnsQuery = `
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'History'
        ORDER BY ORDINAL_POSITION
      `;
      
      const historyColumnsResult = await connection.executeQuery(historyColumnsQuery, {});
      if (historyColumnsResult.recordset.length > 0) {
        console.log('History table columns:');
        historyColumnsResult.recordset.forEach((row: any) => {
          console.log(`  - ${row.COLUMN_NAME} (${row.DATA_TYPE}, nullable: ${row.IS_NULLABLE})`);
        });
      } else {
        console.log('❌ History table not found or no columns returned');
      }
    } catch (error) {
      console.log('❌ Error checking History table:', error instanceof Error ? error.message : error);
    }
    
    // Try to find tables with similar names
    console.log('\n🔍 Looking for tables with "tag" or "history" in the name...');
    const similarTablesQuery = `
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND (LOWER(TABLE_NAME) LIKE '%tag%' OR LOWER(TABLE_NAME) LIKE '%hist%')
      ORDER BY TABLE_NAME
    `;
    
    const similarTablesResult = await connection.executeQuery(similarTablesQuery, {});
    if (similarTablesResult.recordset.length > 0) {
      console.log('Tables with "tag" or "hist" in name:');
      similarTablesResult.recordset.forEach((row: any) => {
        console.log(`  - ${row.TABLE_NAME}`);
      });
    } else {
      console.log('No tables found with "tag" or "hist" in name');
    }
    
    // Try a simple query to see what data is available
    console.log('\n🧪 Testing simple queries...');
    
    // Try different possible table names for tags
    const possibleTagTables = ['Tag', 'Tags', 'wwTagname', 'wwTag', 'TagDef', 'TagDefinition'];
    
    for (const tableName of possibleTagTables) {
      try {
        console.log(`\n  Testing table: ${tableName}`);
        const testQuery = `SELECT TOP 5 * FROM ${tableName}`;
        const result = await connection.executeQuery(testQuery, {});
        
        if (result.recordset.length > 0) {
          console.log(`  ✅ ${tableName} exists with ${result.recordset.length} sample rows`);
          console.log('  Sample columns:', Object.keys(result.recordset[0]));
          
          // Show first row as example
          console.log('  Sample data:', result.recordset[0]);
        }
      } catch (error) {
        console.log(`  ❌ ${tableName} not accessible:`, error instanceof Error ? error.message : error);
      }
    }
    
    // Try different possible table names for history
    const possibleHistoryTables = ['History', 'wwHistory', 'HistoryData', 'TimeSeriesData', 'wwRetrievalMode'];
    
    for (const tableName of possibleHistoryTables) {
      try {
        console.log(`\n  Testing table: ${tableName}`);
        const testQuery = `SELECT TOP 5 * FROM ${tableName}`;
        const result = await connection.executeQuery(testQuery, {});
        
        if (result.recordset.length > 0) {
          console.log(`  ✅ ${tableName} exists with ${result.recordset.length} sample rows`);
          console.log('  Sample columns:', Object.keys(result.recordset[0]));
          
          // Show first row as example
          console.log('  Sample data:', result.recordset[0]);
        }
      } catch (error) {
        console.log(`  ❌ ${tableName} not accessible:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log('\n✅ Database schema check completed');
    
  } catch (error) {
    console.error('❌ Database schema check failed:', error);
    process.exit(1);
  }
}

// Run the check
checkDatabaseSchema()
  .then(() => {
    console.log('\n🎉 Schema check completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Schema check failed:', error);
    process.exit(1);
  });