# Cooling Spike Causality Report
*Generated on: 2026-04-02T02:41:43.101Z*

## Methodology
- Threshold: `TT001_PV > 40°C`
- Analyzed Windows: **15 minutes leading up** to the temperature spike.
- Baseline: Data points at least 30 minutes away from any cooling spike.

## Top Correlated Signs
The following sensors show the most significant deviation from their baseline in the minutes preceding a cooling failure.

| Tag | Category | Baseline Avg | Pre-Spike Avg | Deviation | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| FT004_PV | Flow | 7.07 | 3215.70 | 45376.7% | **🚨 HIGH** |
| PT003_PV | Pressure | 18.64 | 527.20 | 2728.7% | **🚨 HIGH** |
| FT002_PV | Flow | 325.89 | 3983.92 | 1122.5% | **🚨 HIGH** |
| FT003_PV | Flow | 570.53 | 6059.13 | 962.0% | **🚨 HIGH** |
| CT001_PV | Conductivity | 2.29 | 10.62 | 364.3% | **🚨 HIGH** |
| PT005_PV | Pressure | 20.13 | 87.76 | 335.9% | **🚨 HIGH** |
| PT002_PV | Pressure | 2.97 | 7.69 | 159.0% | **🚨 HIGH** |
| LT002_PV | Level | 31.67 | 62.66 | 97.8% | **🚨 HIGH** |
| FT001_PV | Flow | 6924.38 | 12955.85 | 87.1% | **🚨 HIGH** |
| LT007_PV | Level | 60.61 | 23.80 | -60.7% | **🚨 HIGH** |

## Diagnosis & Observations
### 2. Level Instability
Multiple LT (Level) tags show **97.8%** deviation. This could mean the supply tank is running low or surging, causing the heat exchanger to lose efficiency.