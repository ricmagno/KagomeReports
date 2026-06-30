import { DataValue } from 'node-opcua';
import { logger } from '../utils/logger';
import { alertManagementService } from './alertManagementService';
import { smsService } from './smsService';
import { opcuaService } from './opcuaService';

/**
 * Service to evaluate alerts via OPC UA subscriptions (push-based).
 * Replaces the previous setInterval polling approach.
 */
export class AlertEvalService {
    private previousAlarmStates: Record<string, boolean> = {};
    private cachedPvValues: Map<string, any> = new Map();
    private isRunning = false;

    constructor() { }

    /**
     * Start subscription-based alert evaluation.
     * Registers connect/reconnect hooks on opcuaService so subscriptions are
     * re-established automatically when the OPC UA session comes up or recovers.
     */
    async start(): Promise<void> {
        opcuaService.onConnect(() => {
            this.setupSubscriptions().catch(err =>
                logger.error('AlertEvalService: failed to set up subscriptions after connect:', err)
            );
        });

        opcuaService.onReconnect(() => {
            this.refresh().catch(err =>
                logger.error('AlertEvalService: failed to refresh subscriptions after reconnect:', err)
            );
        });

        // If a session is already active, set up subscriptions immediately.
        if (opcuaService.hasSession()) {
            await this.setupSubscriptions();
        } else {
            logger.info('AlertEvalService: no OPC UA session yet — subscriptions will activate on first connect');
        }
    }

    /**
     * Stop all subscriptions and clear state.
     */
    async stop(): Promise<void> {
        await opcuaService.terminateSubscription();
        this.cachedPvValues.clear();
        this.previousAlarmStates = {};
        this.isRunning = false;
        logger.info('AlertEvalService stopped');
    }

    /**
     * Rebuild subscriptions (called after a config change or OPC UA reconnect).
     */
    async refresh(): Promise<void> {
        logger.info('AlertEvalService: refreshing subscriptions');
        await this.stop();
        await this.setupSubscriptions();
    }

    private async setupSubscriptions(): Promise<void> {
        if (this.isRunning) {
            logger.warn('AlertEvalService: setupSubscriptions called while already running — skipping');
            return;
        }

        const configs = await alertManagementService.getActiveAlertConfigs();
        if (configs.length === 0) {
            logger.info('AlertEvalService: no active alert configs — subscriptions not started');
            return;
        }

        // Pre-fetch all patterns once
        const patternIds = Array.from(new Set(configs.map(c => c.patternId).filter(Boolean)));
        const patternsMap = new Map<string, any>();
        for (const pId of patternIds) {
            const pattern = await alertManagementService.getAlertPatternById(pId);
            if (pattern) patternsMap.set(pId, pattern);
        }

        await opcuaService.createSubscription(1000);
        this.isRunning = true;

        const getFullNodeId = (tagBase: string, suffix: string): string => {
            const prefix = suffix.startsWith('.') ? '' : '.';
            return `${tagBase}${prefix}${suffix}`;
        };

        for (const config of configs) {
            const pattern = patternsMap.get(config.patternId);
            if (!pattern) {
                logger.warn(`AlertEvalService: pattern ${config.patternId} not found for config ${config.id}`);
                continue;
            }

            const nodes = {
                HH: getFullNodeId(config.tagBase, pattern.hhEventSuffix),
                H: getFullNodeId(config.tagBase, pattern.hEventSuffix),
                L: getFullNodeId(config.tagBase, pattern.lEventSuffix),
                LL: getFullNodeId(config.tagBase, pattern.llEventSuffix),
                PV: getFullNodeId(config.tagBase, pattern.pvSuffix),
            };

            const hasAnyMonitor = config.monitorHH || config.monitorH || config.monitorL || config.monitorLL;

            // Subscribe to the PV so alarm messages include the current process value
            if (hasAnyMonitor) {
                opcuaService.monitorNode(nodes.PV, 500, (dv: DataValue) => {
                    this.cachedPvValues.set(nodes.PV, dv.value?.value);
                });
            }

            if (config.monitorHH) {
                opcuaService.monitorNode(nodes.HH, 500, (dv: DataValue) =>
                    this.handleAlarm(config, 'High High (HH)', nodes.HH, nodes.PV, dv.value?.value)
                );
            }
            if (config.monitorH) {
                opcuaService.monitorNode(nodes.H, 500, (dv: DataValue) =>
                    this.handleAlarm(config, 'High (H)', nodes.H, nodes.PV, dv.value?.value)
                );
            }
            if (config.monitorL) {
                opcuaService.monitorNode(nodes.L, 500, (dv: DataValue) =>
                    this.handleAlarm(config, 'Low (L)', nodes.L, nodes.PV, dv.value?.value)
                );
            }
            if (config.monitorLL) {
                opcuaService.monitorNode(nodes.LL, 500, (dv: DataValue) =>
                    this.handleAlarm(config, 'Low Low (LL)', nodes.LL, nodes.PV, dv.value?.value)
                );
            }
        }

        logger.info(`AlertEvalService: subscriptions active for ${configs.length} alert config(s)`);
    }

    private handleAlarm(config: any, alarmTypeStr: string, alarmNodeId: string, pvNodeId: string, alarmValue: any): void {
        const isAlarmActive = !!alarmValue;
        const stateKey = `${config.id}_${alarmNodeId}`;
        const wasAlarmActive = this.previousAlarmStates[stateKey] || false;

        if (isAlarmActive && !wasAlarmActive) {
            logger.info(`ALARM TRIGGERED: ${config.tagBase} ${alarmTypeStr}`);
            const pvValue = this.cachedPvValues.get(pvNodeId);

            alertManagementService.getAlertListById(config.alertListId)
                .then(alertList => {
                    if (!alertList?.members?.length) return;
                    const phones = alertList.members
                        .map((m: any) => m.phone)
                        .filter((p: any) => p && p.trim().length > 0) as string[];
                    if (phones.length === 0) return;

                    const message = `🚨 ALARM: ${config.name || config.tagBase}! Triggered: ${alarmTypeStr}. Current PV: ${pvValue !== undefined ? pvValue : 'Unknown'}. Please check the system!`;
                    return smsService.sendSms(phones, message);
                })
                .catch(err => logger.error('Failed to send SMS for alarm', { error: err }));

        } else if (!isAlarmActive && wasAlarmActive) {
            logger.info(`ALARM CLEARED: ${config.tagBase} ${alarmTypeStr}`);
        }

        this.previousAlarmStates[stateKey] = isAlarmActive;
    }
}

export const alertEvalService = new AlertEvalService();
