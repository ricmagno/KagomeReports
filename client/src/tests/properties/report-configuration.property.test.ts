import * as fc from 'fast-check';
import { ReportConfig, TimeRange, ChartType } from '../../types/api';

/**
 * Property 9: Report Configuration Round-Trip
 * For any saved report configuration, retrieving and loading it should produce 
 * an equivalent configuration to the original
 * Validates: Requirements 6.1, 6.2, 6.5
 */

// Custom generators for report configuration
const timeRangeGen = fc.record({
  startTime: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  endTime: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  relativeRange: fc.option(fc.constantFrom('last1h', 'last24h', 'last7d', 'last30d'), { nil: undefined }),
}).filter(range => range.startTime <= range.endTime);

const chartTypeGen = fc.array(
  fc.constantFrom<ChartType>('line', 'bar', 'trend'),
  { minLength: 1, maxLength: 3 }
).map(arr => Array.from(new Set(arr))); // Remove duplicates

const reportConfigGen = fc.record({
  id: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 500 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
  timeRange: timeRangeGen,
  chartTypes: chartTypeGen,
  template: fc.constantFrom('default', 'professional', 'minimal'),
  createdBy: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  createdAt: fc.option(fc.date(), { nil: undefined }),
});

// Mock storage for testing
class MockReportStorage {
  private storage = new Map<string, ReportConfig>();

  save(config: ReportConfig): ReportConfig {
    const id = config.id || this.generateId();
    const savedConfig = {
      ...config,
      id,
      createdAt: config.createdAt || new Date(),
    };
    this.storage.set(id, savedConfig);
    return savedConfig;
  }

  load(id: string): ReportConfig | null {
    return this.storage.get(id) || null;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

describe('Feature: historian-reporting, Property 9: Report Configuration Round-Trip', () => {
  let storage: MockReportStorage;

  beforeEach(() => {
    storage = new MockReportStorage();
  });

  test('should preserve all configuration properties through save/load cycle', () => {
    fc.assert(
      fc.property(reportConfigGen, (originalConfig) => {
        // Save the configuration
        const savedConfig = storage.save(originalConfig as ReportConfig);
        
        // Load the configuration
        const loadedConfig = storage.load(savedConfig.id!);
        
        // Verify the configuration was loaded
        expect(loadedConfig).not.toBeNull();
        
        if (loadedConfig) {
          // Verify all essential properties are preserved
          expect(loadedConfig.name).toBe(originalConfig.name);
          expect(loadedConfig.description).toBe(originalConfig.description);
          expect(loadedConfig.tags).toEqual(originalConfig.tags);
          expect(loadedConfig.chartTypes).toEqual(originalConfig.chartTypes);
          expect(loadedConfig.template).toBe(originalConfig.template);
          
          // Verify time range is preserved
          expect(loadedConfig.timeRange.startTime).toEqual(originalConfig.timeRange.startTime);
          expect(loadedConfig.timeRange.endTime).toEqual(originalConfig.timeRange.endTime);
          expect(loadedConfig.timeRange.relativeRange).toBe(originalConfig.timeRange.relativeRange);
          
          // Verify metadata is handled correctly
          expect(loadedConfig.id).toBeDefined();
          expect(loadedConfig.createdAt).toBeDefined();
          
          if (originalConfig.createdBy) {
            expect(loadedConfig.createdBy).toBe(originalConfig.createdBy);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  test('should handle configuration serialization/deserialization correctly', () => {
    fc.assert(
      fc.property(reportConfigGen, (originalConfig) => {
        // Simulate JSON serialization/deserialization (like API calls)
        const serialized = JSON.stringify(originalConfig);
        const deserialized = JSON.parse(serialized);
        
        // Convert date strings back to Date objects (simulating API response handling)
        deserialized.timeRange.startTime = new Date(deserialized.timeRange.startTime);
        deserialized.timeRange.endTime = new Date(deserialized.timeRange.endTime);
        if (deserialized.createdAt) {
          deserialized.createdAt = new Date(deserialized.createdAt);
        }
        
        // Save and load the deserialized configuration
        const savedConfig = storage.save(deserialized as ReportConfig);
        const loadedConfig = storage.load(savedConfig.id!);
        
        expect(loadedConfig).not.toBeNull();
        
        if (loadedConfig) {
          // Verify the configuration survived serialization round-trip
          expect(loadedConfig.name).toBe(originalConfig.name);
          expect(loadedConfig.description).toBe(originalConfig.description);
          expect(loadedConfig.tags).toEqual(originalConfig.tags);
          expect(loadedConfig.chartTypes).toEqual(originalConfig.chartTypes);
          expect(loadedConfig.template).toBe(originalConfig.template);
          
          // Verify dates are handled correctly
          expect(loadedConfig.timeRange.startTime.getTime()).toBe(originalConfig.timeRange.startTime.getTime());
          expect(loadedConfig.timeRange.endTime.getTime()).toBe(originalConfig.timeRange.endTime.getTime());
        }
      }),
      { numRuns: 100 }
    );
  });

  test('should maintain configuration uniqueness by ID', () => {
    fc.assert(
      fc.property(fc.array(reportConfigGen, { minLength: 2, maxLength: 10 }), (configs) => {
        const savedConfigs = configs.map(config => storage.save(config as ReportConfig));
        
        // Verify all saved configurations have unique IDs
        const ids = savedConfigs.map(config => config.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
        
        // Verify each configuration can be loaded independently
        savedConfigs.forEach(savedConfig => {
          const loadedConfig = storage.load(savedConfig.id!);
          expect(loadedConfig).not.toBeNull();
          expect(loadedConfig?.id).toBe(savedConfig.id);
          expect(loadedConfig?.name).toBe(savedConfig.name);
        });
      }),
      { numRuns: 50 }
    );
  });

  test('should handle edge cases in configuration data', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 1 }), // Minimal name
          description: fc.constant(''), // Empty description
          tags: fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 1, maxLength: 1 }), // Single character tags
          timeRange: fc.record({
            startTime: fc.constant(new Date('2020-01-01T00:00:00Z')),
            endTime: fc.constant(new Date('2020-01-01T00:00:01Z')), // 1 second range
          }),
          chartTypes: fc.constant(['line'] as ChartType[]), // Single chart type
          template: fc.constant('default'),
        }),
        (edgeConfig) => {
          const savedConfig = storage.save(edgeConfig as ReportConfig);
          const loadedConfig = storage.load(savedConfig.id!);
          
          expect(loadedConfig).not.toBeNull();
          
          if (loadedConfig) {
            expect(loadedConfig.name).toBe(edgeConfig.name);
            expect(loadedConfig.description).toBe(edgeConfig.description);
            expect(loadedConfig.tags).toEqual(edgeConfig.tags);
            expect(loadedConfig.chartTypes).toEqual(edgeConfig.chartTypes);
            expect(loadedConfig.template).toBe(edgeConfig.template);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should validate configuration completeness', () => {
    fc.assert(
      fc.property(reportConfigGen, (config) => {
        const savedConfig = storage.save(config as ReportConfig);
        const loadedConfig = storage.load(savedConfig.id!);
        
        expect(loadedConfig).not.toBeNull();
        
        if (loadedConfig) {
          // Verify all required fields are present
          expect(loadedConfig.name).toBeTruthy();
          expect(loadedConfig.tags.length).toBeGreaterThan(0);
          expect(loadedConfig.chartTypes.length).toBeGreaterThan(0);
          expect(loadedConfig.template).toBeTruthy();
          expect(loadedConfig.timeRange).toBeDefined();
          expect(loadedConfig.timeRange.startTime).toBeInstanceOf(Date);
          expect(loadedConfig.timeRange.endTime).toBeInstanceOf(Date);
          expect(loadedConfig.timeRange.startTime.getTime()).toBeLessThanOrEqual(
            loadedConfig.timeRange.endTime.getTime()
          );
          
          // Verify ID and timestamp are added
          expect(loadedConfig.id).toBeTruthy();
          expect(loadedConfig.createdAt).toBeInstanceOf(Date);
        }
      }),
      { numRuns: 100 }
    );
  });
});