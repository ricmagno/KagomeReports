import fs from 'fs';
import path from 'path';
import { parse, subMinutes, isWithinInterval, format } from 'date-fns';

// Paths
const issuesPath = path.join(__dirname, 'Issues.csv');
const dataPath = path.join(__dirname, 'tc11_data.csv');
const reportPath = path.join(__dirname, 'analysis_report.md');

// Configuration
const TT_TAGS = [
  'Kagome_AU.TC11_TT001_PV', 
  'Kagome_AU.TC11_TT006_PV', 
  'Kagome_AU.TC11_TT004_PV', 
  'Kagome_AU.TC11_TT009_PV'
];

const FT_TAGS = [
  'Kagome_AU.TC11_FT002_PV', 
  'Kagome_AU.TC11_FT003_PV'  
];

const CRITICAL_TAGS = [...TT_TAGS, ...FT_TAGS];

const LOOKBACK_MINUTES = 30;
const MIN_FLOW_THRESHOLD = 500; // L/h
const CRITICAL_TEMP_STERIL = 105; // Celsius
const WARNING_TEMP_COOLING = 45; // Celsius

interface IssueEvent {
  lot: string;
  timestamp: Date;
  status: string;
}

interface SensorData {
  tagName: string;
  timestamp: Date;
  value: number;
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

async function analyze() {
  console.log('Starting Refined Correlation Analysis...');

  // 1. Load Issues
  const issuesRaw = fs.readFileSync(issuesPath, 'utf-8');
  const issueLines = issuesRaw.split('\n').filter(l => l.trim().length > 0);
  const wastedEvents: IssueEvent[] = [];

  for (let i = 1; i < issueLines.length; i++) {
    const line = issueLines[i];
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const status = parts[3]?.replace(/"/g, '').trim();
    const dateStr = parts[5]?.replace(/"/g, '').trim();
    
    if (status && status.includes('Wasted') && dateStr) {
      try {
        const timestamp = parse(dateStr, 'dd/MM/yyyy HH:mm:ss', new Date());
        if (!isNaN(timestamp.getTime())) {
          wastedEvents.push({ lot: parts[0], timestamp, status });
        }
      } catch (e) {}
    }
  }

  // 2. Load Sensor Data
  const dataRaw = fs.readFileSync(dataPath, 'utf-8');
  const dataLines = dataRaw.split('\n');
  const sensorMap: Map<string, SensorData[]> = new Map();

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const [tagName, dateStr, valueStr] = line.split(',');
    if (CRITICAL_TAGS.includes(tagName)) {
      const timestamp = new Date(dateStr);
      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;

      if (!sensorMap.has(tagName)) sensorMap.set(tagName, []);
      sensorMap.get(tagName)!.push({ tagName, timestamp, value });
    }
  }

  // 3. Analysis and Report Generation
  const report: string[] = [
    '# TC11 Refined Correlation Analysis Report (Flow & Temperature)',
    `*Generated on: ${new Date().toISOString()}*`,
    '\n## Objectives',
    `Look for causal links between Flow Stability and Temperature Drops in the ${LOOKBACK_MINUTES} minutes lead-up to "Wasted" events.`,
    '\n---'
  ];

  let totalEvents = 0;
  let summaryPatterns = {
    sterilDrop: 0,
    coolingSpike: 0,
    flowInterruption: 0,
    flowInstability: 0
  };

  for (const event of wastedEvents) {
    const startTime = subMinutes(event.timestamp, LOOKBACK_MINUTES);
    const endTime = event.timestamp;
    
    // Check if we have data for this window
    const sampleTag = TT_TAGS[0];
    const hasData = (sensorMap.get(sampleTag) || []).some(d => isWithinInterval(d.timestamp, { start: startTime, end: endTime }));
    if (!hasData) continue;

    totalEvents++;
    report.push(`\n### Event: Lot ${event.lot} @ ${format(event.timestamp, 'yyyy-MM-dd HH:mm:ss')}`);
    report.push('| Tag Category | Tag Name | Min | Max | Avg | StdDev | Alert |');
    report.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

    let eventSterilDrop = false;
    let eventCoolingSpike = false;
    let eventFlowInterruption = false;
    let eventFlowInstability = false;

    // Analyze TT Tags
    for (const tagName of TT_TAGS) {
      const data = (sensorMap.get(tagName) || []).filter(d => isWithinInterval(d.timestamp, { start: startTime, end: endTime }));
      if (data.length === 0) continue;
      const values = data.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = calculateStdDev(values);

      let alert = 'Normal';
      if ((tagName.includes('TT004') || tagName.includes('TT009')) && min < CRITICAL_TEMP_STERIL) {
        alert = '**⚠️ TEMP DROP**';
        eventSterilDrop = true;
      } else if ((tagName.includes('TT001') || tagName.includes('TT006')) && max > WARNING_TEMP_COOLING) {
        alert = '**⚠️ COOLING SPIKE**';
        eventCoolingSpike = true;
      }

      report.push(`| Temperature | ${tagName.replace('Kagome_AU.TC11_', '')} | ${min.toFixed(2)} | ${max.toFixed(2)} | ${avg.toFixed(2)} | ${stdDev.toFixed(2)} | ${alert} |`);
    }

    // Analyze FT Tags
    for (const tagName of FT_TAGS) {
      const data = (sensorMap.get(tagName) || []).filter(d => isWithinInterval(d.timestamp, { start: startTime, end: endTime }));
      if (data.length === 0) continue;
      const values = data.map(d => d.value);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = calculateStdDev(values);

      let alert = 'Normal';
      if (min < MIN_FLOW_THRESHOLD) {
        alert = '**🚨 FLOW DROP**';
        eventFlowInterruption = true;
      } else if (stdDev > (avg * 0.15)) { // Variation > 15% of avg
        alert = '**⚠️ INSTABILITY**';
        eventFlowInstability = true;
      }

      report.push(`| Flow | ${tagName.replace('Kagome_AU.TC11_', '')} | ${min.toFixed(2)} | ${max.toFixed(2)} | ${avg.toFixed(2)} | ${stdDev.toFixed(2)} | ${alert} |`);
    }

    if (eventSterilDrop) summaryPatterns.sterilDrop++;
    if (eventCoolingSpike) summaryPatterns.coolingSpike++;
    if (eventFlowInterruption) summaryPatterns.flowInterruption++;
    if (eventFlowInstability) summaryPatterns.flowInstability++;
  }

  report.push('\n---', '\n## Findings Summary');
  report.push(`- Total Events with Sensor Data: **${totalEvents}**`);
  report.push(`- **${summaryPatterns.sterilDrop} (${Math.round(summaryPatterns.sterilDrop/totalEvents*100)}%)** events showed critical **Sterilization Drops** (<${CRITICAL_TEMP_STERIL}°C).`);
  report.push(`- **${summaryPatterns.flowInterruption} (${Math.round(summaryPatterns.flowInterruption/totalEvents*100)}%)** events showed significant **Flow Interruptions** (<${MIN_FLOW_THRESHOLD} L/h).`);
  report.push(`- **${summaryPatterns.flowInstability} (${Math.round(summaryPatterns.flowInstability/totalEvents*100)}%)** events showed **Flow Instability** (StdDev > 15% of mean).`);
  report.push(`- **${summaryPatterns.coolingSpike} (${Math.round(summaryPatterns.coolingSpike/totalEvents*100)}%)** events showed **Cooling System stress** (>${WARNING_TEMP_COOLING}°C).`);

  report.push('\n### Causality Observation');
  const doubleCount = wastingEventsBoth(wastedEvents, sensorMap);
  report.push(`Out of ${totalEvents} events, **${doubleCount}** showed **both** a Flow Interruption and a Temperature Drop in the same 30min window. This strongly suggests that flow loss is the primary driver of sterilization failure.`);

  fs.writeFileSync(reportPath, report.join('\n'));
  console.log(`Analysis complete! Results in ${reportPath}`);
}

function wastingEventsBoth(wastedEvents: any[], sensorMap: Map<string, SensorData[]>) {
  let count = 0;
  for (const event of wastedEvents) {
    const startTime = subMinutes(event.timestamp, LOOKBACK_MINUTES);
    const endTime = event.timestamp;
    
    let hasFlowDrop = false;
    for (const tn of FT_TAGS) {
      const d = (sensorMap.get(tn) || []).filter(row => isWithinInterval(row.timestamp, { start: startTime, end: endTime }));
      if (d.some(r => r.value < MIN_FLOW_THRESHOLD)) hasFlowDrop = true;
    }

    let hasTempDrop = false;
    for (const tn of ['Kagome_AU.TC11_TT004_PV', 'Kagome_AU.TC11_TT009_PV']) {
      const d = (sensorMap.get(tn) || []).filter(row => isWithinInterval(row.timestamp, { start: startTime, end: endTime }));
      if (d.some(r => r.value < CRITICAL_TEMP_STERIL)) hasTempDrop = true;
    }

    if (hasFlowDrop && hasTempDrop) count++;
  }
  return count;
}

analyze();
