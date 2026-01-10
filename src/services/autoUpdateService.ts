/**
 * Auto-Update Service for Cyclic Data Refresh
 * Provides real-time data updates with configurable intervals
 * Requirements: 3.6, 3.7
 */

import { EventEmitter } from 'events';
import { DataRetrievalService } from './dataRetrieval';
import { StatisticalAnalysisService } from './statisticalAnalysis';
import { TimeSeriesData, TimeRange, TagInfo } from '@/types/historian';
import { dbLogger } from '@/utils/logger';
import { createError } from '@/middleware/errorHandler';

export interface AutoUpdateConfig {
  sessionId: string;
  tagNames: string[];
  updateInterval: 30 | 60; // seconds
  maxDataPoints?: number;
  enableTrendAnalysis?: boolean;
  enableAnomalyDetection?: boolean;
  anomalyThreshold?: number;
  onDataUpdate?: (data: AutoUpdateResult) => void;
  onError?: (error: Error) => void;
}

export interface AutoUpdateResult {
  sessionId: string;
  timestamp: Date;
  newDataPoints: TimeSeriesData[];
  totalDataPoints: number;
  trendAnalysis?: {
    slope: number;
    correlation: number;
    equation: string;
  } | undefined;
  anomalies?: Array<{
    timestamp: Date;
    value: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> | undefined;
  timingMetrics: {
    expectedInterval: number;
    actualInterval: number;
    variance: number;
    isWithinTolerance: boolean;
  };
}

export interface AutoUpdateSession {
  config: AutoUpdateConfig;
  intervalId: NodeJS.Timeout;
  startTime: Date;
  lastUpdateTime: Date;
  updateCount: number;
  dataBuffer: Map<string, TimeSeriesData[]>;
  isActive: boolean;
  timingHistory: number[];
}

export class AutoUpdateService extends EventEmitter {
  private sessions: Map<string, AutoUpdateSession> = new Map();
  private dataRetrievalService: DataRetrievalService;
  private statisticalAnalysisService: StatisticalAnalysisService;
  private autoUpdateLogger = dbLogger.child({ service: 'AutoUpdateService' });
  private readonly TIMING_TOLERANCE = 0.05; // 5% tolerance for timing variance

  constructor(
    dataRetrievalService: DataRetrievalService,
    statisticalAnalysisService: StatisticalAnalysisService
  ) {
    super();
    this.dataRetrievalService = dataRetrievalService;
    this.statisticalAnalysisService = statisticalAnalysisService;
  }

  /**
   * Start auto-update for a session
   */
  startAutoUpdate(config: AutoUpdateConfig): void {
    if (this.sessions.has(config.sessionId)) {
      throw createError(`Auto-update session ${config.sessionId} already exists`, 400);
    }

    // Validate configuration
    this.validateConfig(config);

    const session: AutoUpdateSession = {
      config,
      intervalId: null as any,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      updateCount: 0,
      dataBuffer: new Map(),
      isActive: false,
      timingHistory: []
    };

    // Initialize data buffer for each tag
    for (const tagName of config.tagNames) {
      session.dataBuffer.set(tagName, []);
    }

    this.sessions.set(config.sessionId, session);

    // Start the update cycle
    this.startUpdateCycle(session);

    this.autoUpdateLogger.info('Auto-update session started', {
      sessionId: config.sessionId,
      interval: config.updateInterval,
      tagCount: config.tagNames.length
    });

    this.emit('sessionStarted', { sessionId: config.sessionId, config });
  }

  /**
   * Stop auto-update for a session
   */
  stopAutoUpdate(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw createError(`Auto-update session ${sessionId} not found`, 404);
    }

    if (session.intervalId) {
      clearInterval(session.intervalId);
    }

    session.isActive = false;
    this.sessions.delete(sessionId);

    this.autoUpdateLogger.info('Auto-update session stopped', {
      sessionId,
      duration: Date.now() - session.startTime.getTime(),
      updateCount: session.updateCount
    });

    this.emit('sessionStopped', { sessionId, updateCount: session.updateCount });
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys()).filter(sessionId => {
      const session = this.sessions.get(sessionId);
      return session?.isActive;
    });
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): {
    isActive: boolean;
    updateCount: number;
    lastUpdateTime: Date;
    averageInterval: number;
    timingVariance: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const averageInterval = session.timingHistory.length > 0 
      ? session.timingHistory.reduce((sum, interval) => sum + interval, 0) / session.timingHistory.length
      : 0;

    const expectedInterval = session.config.updateInterval * 1000;
    const timingVariance = averageInterval > 0 
      ? Math.abs(averageInterval - expectedInterval) / expectedInterval
      : 0;

    return {
      isActive: session.isActive,
      updateCount: session.updateCount,
      lastUpdateTime: session.lastUpdateTime,
      averageInterval,
      timingVariance
    };
  }

  /**
   * Get current data for a session
   */
  getCurrentData(sessionId: string): Map<string, TimeSeriesData[]> | null {
    const session = this.sessions.get(sessionId);
    return session ? new Map(session.dataBuffer) : null;
  }

  private validateConfig(config: AutoUpdateConfig): void {
    if (!config.sessionId || config.sessionId.trim().length === 0) {
      throw createError('Session ID is required', 400);
    }

    if (!config.tagNames || config.tagNames.length === 0) {
      throw createError('At least one tag name is required', 400);
    }

    if (config.updateInterval !== 30 && config.updateInterval !== 60) {
      throw createError('Update interval must be 30 or 60 seconds', 400);
    }

    if (config.maxDataPoints && config.maxDataPoints < 10) {
      throw createError('Maximum data points must be at least 10', 400);
    }

    if (config.anomalyThreshold && (config.anomalyThreshold <= 0 || config.anomalyThreshold > 10)) {
      throw createError('Anomaly threshold must be between 0 and 10', 400);
    }
  }

  private startUpdateCycle(session: AutoUpdateSession): void {
    session.isActive = true;
    const intervalMs = session.config.updateInterval * 1000;

    // Perform initial data fetch
    this.performUpdate(session).catch(error => {
      this.handleUpdateError(session, error);
    });

    // Set up recurring updates
    session.intervalId = setInterval(async () => {
      try {
        await this.performUpdate(session);
      } catch (error) {
        this.handleUpdateError(session, error);
      }
    }, intervalMs);
  }

  private async performUpdate(session: AutoUpdateSession): Promise<void> {
    const updateStartTime = Date.now();
    const currentTime = new Date();

    try {
      // Calculate timing metrics
      const timingMetrics = this.calculateTimingMetrics(session, currentTime);

      // Fetch new data for each tag
      const newDataPoints: TimeSeriesData[] = [];
      const timeRange: TimeRange = {
        startTime: session.lastUpdateTime,
        endTime: currentTime
      };

      for (const tagName of session.config.tagNames) {
        try {
          const tagData = await this.dataRetrievalService.getTimeSeriesData(tagName, timeRange);
          
          // Filter out data points we already have
          const existingData = session.dataBuffer.get(tagName) || [];
          const lastTimestamp = existingData.length > 0 
            ? Math.max(...existingData.map(d => d.timestamp.getTime()))
            : 0;

          const newPoints = tagData.filter(point => point.timestamp.getTime() > lastTimestamp);
          
          if (newPoints.length > 0) {
            // Append new data points (incremental update)
            const updatedData = [...existingData, ...newPoints];
            
            // Limit buffer size if configured
            if (session.config.maxDataPoints && updatedData.length > session.config.maxDataPoints) {
              const trimmedData = updatedData.slice(-session.config.maxDataPoints);
              session.dataBuffer.set(tagName, trimmedData);
            } else {
              session.dataBuffer.set(tagName, updatedData);
            }

            newDataPoints.push(...newPoints);
          }
        } catch (error) {
          this.autoUpdateLogger.warn(`Failed to fetch data for tag ${tagName}:`, error);
        }
      }

      // Perform analysis if enabled and we have new data
      let trendAnalysis;
      let anomalies;

      if (newDataPoints.length > 0) {
        // Trend analysis
        if (session.config.enableTrendAnalysis) {
          trendAnalysis = await this.performTrendAnalysis(session);
        }

        // Anomaly detection
        if (session.config.enableAnomalyDetection) {
          anomalies = await this.performAnomalyDetection(session, newDataPoints);
        }
      }

      // Create update result
      const result: AutoUpdateResult = {
        sessionId: session.config.sessionId,
        timestamp: currentTime,
        newDataPoints,
        totalDataPoints: Array.from(session.dataBuffer.values())
          .reduce((total, data) => total + data.length, 0),
        trendAnalysis,
        anomalies,
        timingMetrics
      };

      // Update session state
      session.lastUpdateTime = currentTime;
      session.updateCount++;

      // Emit update event
      this.emit('dataUpdate', result);

      // Call callback if provided
      if (session.config.onDataUpdate) {
        session.config.onDataUpdate(result);
      }

      const updateDuration = Date.now() - updateStartTime;
      this.autoUpdateLogger.debug('Auto-update completed', {
        sessionId: session.config.sessionId,
        newDataPoints: newDataPoints.length,
        updateDuration,
        timingVariance: timingMetrics.variance
      });

    } catch (error) {
      throw error;
    }
  }

  private calculateTimingMetrics(session: AutoUpdateSession, currentTime: Date): {
    expectedInterval: number;
    actualInterval: number;
    variance: number;
    isWithinTolerance: boolean;
  } {
    const expectedInterval = session.config.updateInterval * 1000; // Convert to milliseconds
    const actualInterval = currentTime.getTime() - session.lastUpdateTime.getTime();
    
    // Store timing history for variance calculation
    if (session.updateCount > 0) { // Skip first update
      session.timingHistory.push(actualInterval);
      
      // Keep only last 10 intervals for rolling average
      if (session.timingHistory.length > 10) {
        session.timingHistory.shift();
      }
    }

    const variance = Math.abs(actualInterval - expectedInterval) / expectedInterval;
    const isWithinTolerance = variance <= this.TIMING_TOLERANCE;

    return {
      expectedInterval,
      actualInterval,
      variance,
      isWithinTolerance
    };
  }

  private async performTrendAnalysis(session: AutoUpdateSession): Promise<{
    slope: number;
    correlation: number;
    equation: string;
  } | undefined> {
    try {
      // Combine data from all tags for trend analysis
      const allData: TimeSeriesData[] = [];
      for (const data of session.dataBuffer.values()) {
        allData.push(...data);
      }

      if (allData.length < 2) {
        return undefined;
      }

      // Sort by timestamp
      allData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Use only recent data for trend analysis (last 100 points)
      const recentData = allData.slice(-100);
      const trendResult = this.statisticalAnalysisService.calculateTrendLine(recentData);

      return {
        slope: trendResult.slope,
        correlation: trendResult.correlation,
        equation: trendResult.equation
      };
    } catch (error) {
      this.autoUpdateLogger.warn('Trend analysis failed:', error);
      return undefined;
    }
  }

  private async performAnomalyDetection(
    session: AutoUpdateSession, 
    newDataPoints: TimeSeriesData[]
  ): Promise<Array<{
    timestamp: Date;
    value: number;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> | undefined> {
    try {
      const threshold = session.config.anomalyThreshold || 2.5;
      const anomalies = this.statisticalAnalysisService.detectAnomalies(newDataPoints, threshold);

      return anomalies.map(anomaly => ({
        timestamp: anomaly.timestamp,
        value: anomaly.value,
        severity: anomaly.severity,
        description: anomaly.description
      }));
    } catch (error) {
      this.autoUpdateLogger.warn('Anomaly detection failed:', error);
      return undefined;
    }
  }

  private handleUpdateError(session: AutoUpdateSession, error: any): void {
    this.autoUpdateLogger.error('Auto-update error:', {
      sessionId: session.config.sessionId,
      error: error.message
    });

    this.emit('updateError', {
      sessionId: session.config.sessionId,
      error
    });

    if (session.config.onError) {
      session.config.onError(error);
    }
  }

  /**
   * Stop all active sessions
   */
  stopAllSessions(): void {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      try {
        this.stopAutoUpdate(sessionId);
      } catch (error) {
        this.autoUpdateLogger.warn(`Failed to stop session ${sessionId}:`, error);
      }
    }
  }

  /**
   * Get timing statistics for all sessions
   */
  getTimingStatistics(): {
    totalSessions: number;
    activeSessions: number;
    averageVariance: number;
    sessionsWithinTolerance: number;
  } {
    const activeSessions = this.getActiveSessions();
    let totalVariance = 0;
    let sessionsWithinTolerance = 0;

    for (const sessionId of activeSessions) {
      const status = this.getSessionStatus(sessionId);
      if (status) {
        totalVariance += status.timingVariance;
        if (status.timingVariance <= this.TIMING_TOLERANCE) {
          sessionsWithinTolerance++;
        }
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: activeSessions.length,
      averageVariance: activeSessions.length > 0 ? totalVariance / activeSessions.length : 0,
      sessionsWithinTolerance
    };
  }
}

// Export singleton instance
export const autoUpdateService = new AutoUpdateService(
  new DataRetrievalService(),
  new StatisticalAnalysisService()
);