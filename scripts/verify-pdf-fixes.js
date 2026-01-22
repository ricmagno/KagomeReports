/**
 * Verification script for PDF rendering fixes
 * This script checks that all the fixes have been applied correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying PDF Rendering Fixes...\n');

let allPassed = true;

// Check 1: Chart resolution in chartGeneration.ts
console.log('✓ Check 1: Chart resolution increased to 1200x600');
const chartGenPath = path.join(__dirname, '../src/services/chartGeneration.ts');
const chartGenContent = fs.readFileSync(chartGenPath, 'utf8');

if ((chartGenContent.includes('this.defaultWidth = (env.CHART_WIDTH as number) || 1200') || 
     chartGenContent.includes('this.defaultWidth = 1200')) && 
    (chartGenContent.includes('this.defaultHeight = (env.CHART_HEIGHT as number) || 600') ||
     chartGenContent.includes('this.defaultHeight = 600'))) {
  console.log('  ✅ PASS: Chart default dimensions are 1200x600\n');
} else {
  console.log('  ❌ FAIL: Chart dimensions not updated correctly\n');
  allPassed = false;
}

// Check 2: Chart generation calls in reportGeneration.ts
console.log('✓ Check 2: Chart generation calls use 1200x600');
const reportGenPath = path.join(__dirname, '../src/services/reportGeneration.ts');
const reportGenContent = fs.readFileSync(reportGenPath, 'utf8');

const chartCallMatches = reportGenContent.match(/width:\s*1200,\s*height:\s*600/g);
if (chartCallMatches && chartCallMatches.length >= 2) {
  console.log(`  ✅ PASS: Found ${chartCallMatches.length} chart generation calls with correct dimensions\n`);
} else {
  console.log('  ❌ FAIL: Chart generation calls not updated correctly\n');
  allPassed = false;
}

// Check 3: Chart width in addChartsSection
console.log('✓ Check 3: Chart display width increased to 515px');
if (reportGenContent.includes('const chartWidth = 515')) {
  console.log('  ✅ PASS: Chart width is 515px (full page width)\n');
} else {
  console.log('  ❌ FAIL: Chart width not updated\n');
  allPassed = false;
}

// Check 4: SPC table headers use ASCII
console.log('✓ Check 4: SPC table headers use ASCII (Mean, StdDev)');
if (reportGenContent.includes("'Mean', 'StdDev'") && 
    !reportGenContent.includes("'X̄', 'σest'")) {
  console.log('  ✅ PASS: SPC table uses ASCII headers\n');
} else {
  console.log('  ❌ FAIL: SPC table still uses Unicode symbols\n');
  allPassed = false;
}

// Check 5: Statistics annotation positioning
console.log('✓ Check 5: Statistics annotation positioned correctly');
if (chartGenContent.includes('xScale.max - (xScale.max - xScale.min) * 0.05') &&
    chartGenContent.includes('yScale.max - (yScale.max - yScale.min) * 0.05')) {
  console.log('  ✅ PASS: Statistics box positioned 5% from edges\n');
} else {
  console.log('  ❌ FAIL: Statistics annotation positioning not fixed\n');
  allPassed = false;
}

// Check 6: Legend configuration
console.log('✓ Check 6: Legend configuration optimized');
if (chartGenContent.includes('boxWidth: 15') && 
    chartGenContent.includes('padding: 8') &&
    chartGenContent.includes('maxHeight: 60')) {
  console.log('  ✅ PASS: Legend has reduced boxWidth, padding, and maxHeight\n');
} else {
  console.log('  ❌ FAIL: Legend configuration not optimized\n');
  allPassed = false;
}

// Check 7: Header spacing
console.log('✓ Check 7: Header spacing increased');
if (reportGenContent.includes('doc.y = 90;  // Increased from 75')) {
  console.log('  ✅ PASS: Header spacing increased to 90px\n');
} else {
  console.log('  ❌ FAIL: Header spacing not increased\n');
  allPassed = false;
}

// Check 8: Executive Summary alignment
console.log('✓ Check 8: Executive Summary has explicit positioning');
const execSummaryMatch = reportGenContent.match(/text\('Executive Summary', 40\)/);
if (execSummaryMatch) {
  console.log('  ✅ PASS: Executive Summary has explicit x position\n');
} else {
  console.log('  ❌ FAIL: Executive Summary positioning not fixed\n');
  allPassed = false;
}

// Check 9: Statistical Summary alignment
console.log('✓ Check 9: Statistical Summary has explicit positioning');
const statSummaryMatch = reportGenContent.match(/text\('Statistical Summary', 40\)/);
if (statSummaryMatch) {
  console.log('  ✅ PASS: Statistical Summary has explicit x position\n');
} else {
  console.log('  ❌ FAIL: Statistical Summary positioning not fixed\n');
  allPassed = false;
}

// Summary
console.log('═══════════════════════════════════════════════════════');
if (allPassed) {
  console.log('✅ ALL CHECKS PASSED! PDF rendering fixes are complete.');
  console.log('\nNext steps:');
  console.log('1. Run integration tests: npm test -- tests/integration/analytics-integration.test.ts');
  console.log('2. Generate a test report to verify visual quality');
  console.log('3. Print the test report to verify print quality');
} else {
  console.log('❌ SOME CHECKS FAILED! Please review the fixes.');
  process.exit(1);
}
console.log('═══════════════════════════════════════════════════════\n');
