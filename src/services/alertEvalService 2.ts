import { logger } from '../utils/logger';
import { alertManagementService } from './alertManagementService';
import { smsService } from './smsService';
import { opcuaService } from './opcuaService';

/**
 * Service to evaluate alerts by periodically polling OPC UA
 */
export class AlertEvalService {
    private intervalId: NodeJS.Timeout | null = null;
    private isEvaliating: boolean = false;

    // Store the previous state of each alarm to detect edges (0 -> 1)
    private previousAlarmStates: Record<string, boolean> = {};

    constructor() { }

    /**
     * Start the background alert evaluation
     * @param intervalMs Polling interval in milliseconds
     */
    start(intervalMs: number = 5000): void {
        if (this.intervalId) {
            logger.warn('AlertEvalService is already running');
            return;
        }

        logger.info(`Starting AlertEvalService with polling interval ${intervalMs}ms`);
        this.intervalId = setInterval(() => {
            this.evaluateAlerts().catch(err => {
                logger.error('Error during alert evaluation cycle:', err);
            });
        }, intervalMs);
    }

    /**
     * Stop the background alert evaluation
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('AlertEvalService stopped');
        }
    }

    /**
     * Perform one evaluation cycle
     */
    private async evaluateAlerts(): Promise<void> {
        if (this.isEvaliating) {
            return; // Skip if previous cycle is still running
        }

        this.isEvaliating = true;

        try {
            // Get all active alert configs
            const configs = await alertManagementService.getActiveAlertConfigs();
            if (configs.length === 0) {
                return; // Nothing to do
            }

            // Pre-fetch patterns for active configs
            const patternIds = Array.from(new Set(configs.map(c => c.patternId)));
            const patternsMap = new Map<string, any>();
            for (const pId of patternIds) {
                if (!pId) continue;
                const pattern = await alertManagementService.getAlertPatternById(pId);
                if (pattern) patternsMap.set(pId, pattern);
            }

            // Group tags to read efficiently
            const nodeIdsToRead: string[] = [];
            const configToNodesMap: Map<string, { HH: string; H: string; L: string; LL: string; PV: string }> = new Map();

            for (const config of configs) {
                const pattern = patternsMap.get(config.patternId);
                if (!pattern) {
                    logger.warn(`Pattern ${config.patternId} not found for config ${config.id}`);
                    continue;
                }

                // Determine namespace prefix. Usually 2. Adjust if necessary or extract from something else.
                // KAGOME OPC UA variables are like ns=2;s=PR_T1.PLC.sms.T1_PT001_PV
                // If tagBase is "ns=2;s=Device.SCADA.NV11_FT001", then append ".PV" (or pattern suffix)

                const getFullNodeId = (suffix: string) => {
                    // Prepend dot if the user suffix doesn't start with one and tag doesn't end with one
                    // The simplest approach based on the original code is appending a dot
                    const prefix = suffix.startsWith('.') ? '' : '.';
                    return `${config.tagBase}${prefix}${suffix}`;
                };

                const nodes = {
                    HH: getFullNodeId(pattern.hhEventSuffix),
                    H: getFullNodeId(pattern.hEventSuffix),
                    L: getFullNodeId(pattern.lEventSuffix),
                    LL: getFullNodeId(pattern.llEventSuffix),
                    PV: getFullNodeId(pattern.pvSuffix) // Always read PV to include in message
                };

                configToNodesMap.set(config.id, nodes);

                if (config.monitorHH) nodeIdsToRead.push(nodes.HH);
                if (config.monitorH) nodeIdsToRead.push(nodes.H);
                if (config.monitorL) nodeIdsToRead.push(nodes.L);
                if (config.monitorLL) nodeIdsToRead.push(nodes.LL);

                // Read PV if any monitor is active
                if (config.monitorHH || config.monitorH || config.monitorL || config.monitorLL) {
                    nodeIdsToRead.push(nodes.PV);
                }
            }

            if (nodeIdsToRead.length === 0) {
                return;
            }

            // Read all variables in one batch
            // Unique nodes to avoid duplicate reads
            const uniqueNodes = Array.from(new Set(nodeIdsToRead));

            let values: any[];
            try {
                values = await opcuaService.readValues(uniqueNodes);
            } catch (err) {
                // If OPC isn't connected or fails, we can't evaluate. Wait for next cycle.
                return;
            }

            const valueMap = new Map<string, any>();
            uniqueNodes.forEach((nodeId, index) => {
                valueMap.set(nodeId, values[index]);
            });

            // Evaluate per config
            for (const config of configs) {
                const nodes = configToNodesMap.get(config.id);
                if (!nodes) continue;

                const pvValue = valueMap.get(nodes.PV);

                // Check HH
                if (config.monitorHH) {
                    this.checkAlarm(config, 'High High (HH)', nodes.HH, pvValue, valueMap.get(nodes.HH));
                }

                // Check H
                if (config.monitorH) {
                    this.checkAlarm(config, 'High (H)', nodes.H, pvValue, valueMap.get(nodes.H));
                }

                // Check L
                if (config.monitorL) {
                    this.checkAlarm(config, 'Low (L)', nodes.L, pvValue, valueMap.get(nodes.L));
                }

                // Check LL
                if (config.monitorLL) {
                    this.checkAlarm(config, 'Low Low (LL)', nodes.LL, pvValue, valueMap.get(nodes.LL));
                }
            }

        } finally {
            this.isEvaliating = false;
        }
    }

    private async checkAlarm(config: any, alarmTypeStr: string, alarmNodeId: string, pvValue: any, alarmValue: any) {
        // Boolean values in OPC UA might come as true/false or 1/0
        const isAlarmActive = !!alarmValue;

        const stateKey = `${config.id}_${alarmNodeId}`;
        const wasAlarmActive = this.previousAlarmStates[stateKey] || false;

        // Trigger only on edge transition (0 -> 1)
        if (isAlarmActive && !wasAlarmActive) {
            logger.info(`ALARM TRIGGERED: ${config.tagBase} ${alarmTypeStr}`);

            // Get AlertList to find recipients
            const alertList = await alertManagementService.getAlertListById(config.alertListId);
            if (alertList && alertList.members && alertList.members.length > 0) {
                const phones = alertList.members
                    .map(m => m.phone)
                    .filter(phone => phone && phone.trim().length > 0) as string[];

                if (phones.length > 0) {
                    const message = `🚨 ALARM: ${config.name || config.tagBase}! Triggered: ${alarmTypeStr}. Current PV: ${pvValue !== undefined ? pvValue : 'Unknown'}. Please check the system!`;

                    // Send SMS asynchronously
                    smsService.sendSms(phones, message).catch(err => {
                        logger.error('Failed to send SMS for alarm', { error: err });
                    });
                }
            }
        } else if (!isAlarmActive && wasAlarmActive) {
            logger.info(`ALARM CLEARED: ${config.tagBase} ${alarmTypeStr}`);
        }

        this.previousAlarmStates[stateKey] = isAlarmActive;
    }
}

export const alertEvalService = new AlertEvalService();
