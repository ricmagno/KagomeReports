import fs from 'fs';
import path from 'path';
import { isWithinInterval, subMinutes, format } from 'date-fns';

const dataPath = path.join(__dirname, 'tc11_data.csv');
const causalityReportPath = path.join(__dirname, 'cooling_causality_report.md');

// Configuration
const COOLING_TAG = 'Kagome_AU.TC11_TT001_PV';
const COOLING_THRESHOLD = 40; // Celsius (as requested by user)
const PRE_EVENT_WINDOW_MINUTES = 15;

interface SensorData {
  tagName: string;
  timestamp: Date;
  value: number;
}

interface CorrelationResult {
  tagName: string;
  category: string;
  avgDuringSpikes: number;
  avgBaseline: number;
  deviationPerc: number;
  frequency: number;
}

async function analyzeCausality() {
  console.log('Starting Cooling Causality Analysis...');

  // 1. Identify all unique tags
  const dataRaw = fs.readFileSync(dataPath, 'utf-8');
  const lines = dataRaw.split('\n');
  const allTags = new Set<string>();
  const sensorMap: Map<string, SensorData[]> = new Map();

  console.log('Loading full dataset for cross-correlation...');
  for (const line of lines) {
    if (!line.trim() || line.startsWith('TagName')) continue;
    const [tagName, dateStr, valueStr] = line.split(',');
    const value = parseFloat(valueStr);
    if (isNaN(value)) continue;

    allTags.add(tagName);
    if (!sensorMap.has(tagName)) sensorMap.set(tagName, []);
    sensorMap.get(tagName)!.push({ tagName, timestamp: new Date(dateStr), value });
  }

  // 2. Identify Cooling Spike Periods
  console.log(`Identifying Cooling Spikes (> ${COOLING_THRESHOLD}°C)...`);
  const coolingData = sensorMap.get(COOLING_TAG) || [];
  const spikes = coolingData.filter(d => d.value > COOLING_THRESHOLD);
  
  if (spikes.length === 0) {
    console.error('No cooling spikes found with the given threshold.');
    return;
  }

  // Group contiguous spikes into single "Events"
  const spikeEvents: { start: Date; end: Date; peak: number }[] = [];
  let currentEvent: { start: Date; end: Date; peak: number } | null = null;

  for (let i = 0; i < spikes.length; i++) {
    const s = spikes[i];
    if (!currentEvent || (s.timestamp.getTime() - currentEvent.end.getTime()) > 5 * 60 * 1000) {
      if (currentEvent) spikeEvents.push(currentEvent);
      currentEvent = { start: s.timestamp, end: s.timestamp, peak: s.value };
    } else {
      currentEvent.end = s.timestamp;
      if (s.value > currentEvent.peak) currentEvent.peak = s.value;
    }
  }
  if (currentEvent) spikeEvents.push(currentEvent);

  console.log(`Found ${spikeEvents.length} distinct cooling warning events.`);

  // 3. Analyze precursors and co-occurrences
  const candidateTags = Array.from(allTags).filter(t => !t.includes('TT') && !t.includes('_TR'));
  const correlations: Map<string, { sumSpike: number; sumBaseline: number; countSpike: number; countBaseline: number }> = new Map();

  console.log('Analyzing non-temperature tags (PT, FT, LT, ST)...');

  for (const event of spikeEvents) {
    const windowStart = subMinutes(event.start, PRE_EVENT_WINDOW_MINUTES);
    const windowEnd = event.start; // Pre-event window

    for (const tagName of candidateTags) {
      const tagData = sensorMap.get(tagName) || [];
      const inWindow = tagData.filter(d => isWithinInterval(d.timestamp, { start: windowStart, end: windowEnd }));
      const baseline = tagData.filter(d => !spikeEvents.some(e => isWithinInterval(d.timestamp, { start: subMinutes(e.start, 30), end: e.end })));

      if (!correlations.has(tagName)) {
        correlations.set(tagName, { sumSpike: 0, sumBaseline: 0, countSpike: 0, countBaseline: 0 });
      }

      const stats = correlations.get(tagName)!;
      if (inWindow.length > 0) {
        stats.sumSpike += inWindow.reduce((a, b) => a + b.value, 0) / inWindow.length;
        stats.countSpike++;
      }
      if (baseline.length > 0) {
        stats.sumBaseline += baseline.reduce((a, b) => a + b.value, 0) / baseline.length;
        stats.countBaseline++;
      }
    }
  }

  // 4. Ranking
  const results: CorrelationResult[] = Array.from(correlations.entries()).map(([tagName, stats]) => {
    const avgSpike = stats.countSpike > 0 ? stats.sumSpike / stats.countSpike : 0;
    const avgBase = stats.countBaseline > 0 ? stats.sumBaseline / stats.countBaseline : 0;
    const deviation = avgBase !== 0 ? ((avgSpike - avgBase) / Math.abs(avgBase)) * 100 : 0;
    
    let category = 'Unknown';
    if (tagName.includes('PT')) category = 'Pressure';
    else if (tagName.includes('FT')) category = 'Flow';
    else if (tagName.includes('LT')) category = 'Level';
    else if (tagName.includes('ST')) category = 'Speed';
    else if (tagName.includes('CT')) category = 'Conductivity';

    return { tagName, category, avgDuringSpikes: avgSpike, avgBaseline: avgBase, deviationPerc: deviation, frequency: stats.countSpike / spikeEvents.length };
  }).filter(r => Math.abs(r.deviationPerc) > 5) // Ignore minor deviations
    .sort((a, b) => Math.abs(b.deviationPerc) - Math.abs(a.deviationPerc));

  // 5. Build Report
  const report: string[] = [
    '# Cooling Spike Causality Report',
    `*Generated on: ${new Date().toISOString()}*`,
    '\n## Methodology',
    `- Threshold: \`TT001_PV > 40°C\``,
    `- Analyzed Windows: **15 minutes leading up** to the temperature spike.`,
    `- Baseline: Data points at least 30 minutes away from any cooling spike.`,
    '\n## Top Correlated Signs',
    'The following sensors show the most significant deviation from their baseline in the minutes preceding a cooling failure.',
    '\n| Tag | Category | Baseline Avg | Pre-Spike Avg | Deviation | Confidence |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |'
  ];

  for (const r of results.slice(0, 10)) {
    const alert = Math.abs(r.deviationPerc) > 50 ? '**🚨 HIGH**' : (Math.abs(r.deviationPerc) > 20 ? '**⚠️ MODERATE**' : 'LOW');
    report.push(`| ${r.tagName.replace('Kagome_AU.TC11_', '')} | ${r.category} | ${r.avgBaseline.toFixed(2)} | ${r.avgDuringSpikes.toFixed(2)} | ${r.deviationPerc.toFixed(1)}% | ${alert} |`);
  }

  report.push('\n## Diagnosis & Observations');
  
  // High pressure PT correlation check
  const pt001 = results.find(r => r.tagName.includes('PT001'));
  if (pt001 && Math.abs(pt001.deviationPerc) > 30) {
    report.push(`### 1. Pressure Surge (PT001)\nPressure ` + (pt001.deviationPerc > 0 ? 'surges' : 'drops') + ` by **${pt001.deviationPerc.toFixed(1)}%** right before cooling fails. This typically indicates a pump trip or a solenoid valve closing prematurely.`);
  }

  const ltTags = results.filter(r => r.category === 'Level' && Math.abs(r.deviationPerc) > 15);
  if (ltTags.length > 0) {
    report.push(`### 2. Level Instability\nMultiple LT (Level) tags show **${ltTags[0].deviationPerc.toFixed(1)}%** deviation. This could mean the supply tank is running low or surging, causing the heat exchanger to lose efficiency.`);
  }

  fs.writeFileSync(causalityReportPath, report.join('\n'));
  console.log(`Analysis complete! Report saved to ${causalityReportPath}`);
}

analyzeCausality();
