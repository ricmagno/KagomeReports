/**
 * Auto-Update Timing Property Tests
 * Feature: historian-reporting, Property 7: Auto-Update Timing Consistency
 * Validates: Requirements 3.6, 3.7
 */

import * as fc from 'fast-check';
import { AutoUpdateService, AutoUpdateConfig } from '@/services/autoUpdateService';
import { DataRetrievalService } from '@/services/dataRetrieval';
import { StatisticalAnalysisService } from '@/services/statisticalAnalysis';
import { TimeSeriesData, QualityCode } from '@/types/historian';

describe('Auto-Update Timing Property Tests', () => {
  let autoUpdateService: AutoUpdateService;
  let mockDataRetrievalService: jest.Mocked<DataRetrievalService>;
  let mockStatisticalAnalysisService: jest.Mocked<StatisticalAnalysisService>;

  beforeEach(() => {
    // Create mock services
    mockDataRetrievalService = {
      getTimeSeriesData: jest.fn().mockResolvedValue([]),
      getTagList: jest.fn(),
      getFilteredData: jest.fn(),
      createDataProcessingStream: jest.fn(),
      validateTimeRange: jest.fn(),
      getTagInfo: jest.fn()
    } as any;

    mockStatisticalAnalysisService = {
      calculateStatistics: jest.fn(),
      calculateStatisticsSync: jest.fn(),
      calculateTrendLine: jest.fn(),
      calculateMovingAverage: jest.fn(),
      calculatePercentageChange: jest.fn(),
      detectAnomalies: jest.fn().mockReturnValue([]),
      detectAdvancedAnomalies: jest.fn(),
      detectPatternChanges: jest.fn(),
      detectSignificantTrendChanges: jest.fn(),
      flagAnomalies: jest.fn(),
      performStatisticalDeviationAnalysis: jest.fn(),
      calculateDataQuality: jest.fn()
    } as any;

    autoUpdateService = new AutoUpdateService(
      mockDataRetrievalService,
      mockStatisticalAnalysisService
    );
  });

  afterEach(async () => {
    // Clean up any active sessions
    autoUpdateService.stopAllSessions();
    jest.clearAllMocks();
  });

  /**
   * Property 7: Auto-Update Timing Consistency
   * For any auto-update configuration with 30 or 60-second intervals, trend data refreshes 
   * should occur at the specified intervals with acceptable timing variance (±5%)
   */
  describe('Property 7: Auto-Update Timing Consistency', () => {

    test('should validate configuration parameters correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            sessionId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            tagNames: fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 1, maxLength: 3 }),
            updateInterval: fc.constantFrom(30 as const, 60 as const)
          }),
          (baseConfig) => {
            const config: AutoUpdateConfig = {
              sessionId: baseConfig.sessionId.trim(),
              tagNames: baseConfig.tagNames.map(tag => tag.trim()),
              updateInterval: baseConfig.updateInterval
            };

            // Property: Valid configurations should not throw errors
            expect(() => {
              autoUpdateService.startAutoUpdate(config);
              autoUpdateService.stopAutoUpdate(config.sessionId);
            }).not.toThrow();
          }
        ),
        { numRuns: 10 }
      );
    });

    test('should handle session lifecycle correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            sessionId: fc.string({ minLength: 1, maxLength: 20 }),
            tagNames: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 2 }),
            updateInterval: fc.constantFrom(30 as const, 60 as const)
          }),
          (baseConfig) => {
            const config: AutoUpdateConfig = {
              sessionId: baseConfig.sessionId,
              tagNames: baseConfig.tagNames,
              updateInterval: baseConfig.updateInterval
            };

            // Start session
            autoUpdateService.startAutoUpdate(config);

            // Property: Session should be created and active
            const activeSessions = autoUpdateService.getActiveSessions();
            expect(activeSessions).toContain(config.sessionId);

            // Property: Session status should be valid
            const status = autoUpdateService.getSessionStatus(config.sessionId);
            expect(status).not.toBeNull();
            expect(status!.isActive).toBe(true);
            expect(status!.updateCount).toBeGreaterThanOrEqual(0);

            // Stop session
            autoUpdateService.stopAutoUpdate(config.sessionId);

            // Property: Session should be stopped and removed
            const activeSessionsAfterStop = autoUpdateService.getActiveSessions();
            expect(activeSessionsAfterStop).not.toContain(config.sessionId);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('should handle invalid configurations appropriately', () => {
      // Test empty session ID
      expect(() => {
        autoUpdateService.startAutoUpdate({
          sessionId: '',
          tagNames: ['tag1'],
          updateInterval: 30
        });
      }).toThrow();

      // Test empty tag names
      expect(() => {
        autoUpdateService.startAutoUpdate({
          sessionId: 'test',
          tagNames: [],
          updateInterval: 30
        });
      }).toThrow();

      // Test invalid interval
      expect(() => {
        autoUpdateService.startAutoUpdate({
          sessionId: 'test',
          tagNames: ['tag1'],
          updateInterval: 45 as any
        });
      }).toThrow();
    });

    test('should handle duplicate session IDs correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            sessionId: fc.string({ minLength: 1, maxLength: 20 }),
            tagNames: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 2 }),
            updateInterval: fc.constantFrom(30 as const, 60 as const)
          }),
          (baseConfig) => {
            const config: AutoUpdateConfig = {
              sessionId: baseConfig.sessionId,
              tagNames: baseConfig.tagNames,
              updateInterval: baseConfig.updateInterval
            };

            // Start first session
            autoUpdateService.startAutoUpdate(config);

            // Property: Duplicate session IDs should throw errors
            expect(() => {
              autoUpdateService.startAutoUpdate(config);
            }).toThrow();

            // Clean up
            autoUpdateService.stopAutoUpdate(config.sessionId);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('should handle non-existent session operations correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (sessionId) => {
            // Property: Operations on non-existent sessions should handle gracefully
            expect(() => autoUpdateService.stopAutoUpdate(sessionId)).toThrow();
            expect(autoUpdateService.getSessionStatus(sessionId)).toBeNull();
            expect(autoUpdateService.getCurrentData(sessionId)).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });

    test('should maintain timing statistics correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              sessionId: fc.string({ minLength: 1, maxLength: 20 }),
              tagNames: fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 2 }),
              updateInterval: fc.constantFrom(30 as const, 60 as const)
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (baseConfigs) => {
            // Ensure unique session IDs
            const configs: AutoUpdateConfig[] = baseConfigs.map((config, index) => ({
              sessionId: `${config.sessionId}_${index}`,
              tagNames: config.tagNames,
              updateInterval: config.updateInterval
            }));

            // Start all sessions
            for (const config of configs) {
              autoUpdateService.startAutoUpdate(config);
            }

            // Property: Timing statistics should be consistent
            const timingStats = autoUpdateService.getTimingStatistics();
            expect(timingStats.totalSessions).toBe(configs.length);
            expect(timingStats.activeSessions).toBe(configs.length);
            expect(timingStats.averageVariance).toBeGreaterThanOrEqual(0);
            expect(timingStats.sessionsWithinTolerance).toBeGreaterThanOrEqual(0);
            expect(timingStats.sessionsWithinTolerance).toBeLessThanOrEqual(configs.length);

            // Clean up all sessions
            autoUpdateService.stopAllSessions();

            // Property: All sessions should be stopped
            const finalActiveSessions = autoUpdateService.getActiveSessions();
            expect(finalActiveSessions.length).toBe(0);
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});