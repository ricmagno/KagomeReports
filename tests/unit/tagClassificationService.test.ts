/**
 * Unit tests for Tag Classification Service
 * 
 * Tests specific examples and edge cases for tag classification logic.
 */

import { classifyTag, classifyTags } from '../../src/services/tagClassificationService';
import { TimeSeriesData, QualityCode } from '../../src/types/historian';

describe('Tag Classification Service', () => {
  describe('classifyTag', () => {
    describe('Digital Tag Detection', () => {
      it('should classify 0/1 binary data as digital with high confidence', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 1, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
          { timestamp: new Date('2024-01-01T03:00:00Z'), value: 1, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('PUMP_STATUS');
        expect(result.type).toBe('digital');
        expect(result.confidence).toBe(1.0);
      });

      it('should classify 0/100 binary data as digital with high confidence', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'VALVE_OPEN' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 100, quality: QualityCode.Good, tagName: 'VALVE_OPEN' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'VALVE_OPEN' },
          { timestamp: new Date('2024-01-01T03:00:00Z'), value: 100, quality: QualityCode.Good, tagName: 'VALVE_OPEN' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('VALVE_OPEN');
        expect(result.type).toBe('digital');
        expect(result.confidence).toBe(1.0);
      });

      it('should NOT classify 0/2 as digital (not a standard binary pattern)', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'STATE' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 2, quality: QualityCode.Good, tagName: 'STATE' },
        ];

        const result = classifyTag(data);

        expect(result.type).toBe('analog');
      });
    });

    describe('Analog Tag Detection', () => {
      it('should classify continuous temperature data as analog', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 25.1, quality: QualityCode.Good, tagName: 'TEMP_01' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 25.3, quality: QualityCode.Good, tagName: 'TEMP_01' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 25.5, quality: QualityCode.Good, tagName: 'TEMP_01' },
          { timestamp: new Date('2024-01-01T03:00:00Z'), value: 25.7, quality: QualityCode.Good, tagName: 'TEMP_01' },
          { timestamp: new Date('2024-01-01T04:00:00Z'), value: 25.9, quality: QualityCode.Good, tagName: 'TEMP_01' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('TEMP_01');
        expect(result.type).toBe('analog');
        // With 5 unique values, it defaults to analog with 0.5 confidence
        expect(result.confidence).toBe(0.5);
      });

      it('should classify data with >10 unique values as analog with high confidence', () => {
        const data: TimeSeriesData[] = Array.from({ length: 15 }, (_, i) => ({
          timestamp: new Date(`2024-01-01T${String(i).padStart(2, '0')}:00:00Z`),
          value: 20 + i * 0.5,
          quality: QualityCode.Good,
          tagName: 'PRESSURE_01'
        }));

        const result = classifyTag(data);

        expect(result.tagName).toBe('PRESSURE_01');
        expect(result.type).toBe('analog');
        expect(result.confidence).toBe(0.95);
      });

      it('should classify data with continuous distribution as analog', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10.0, quality: QualityCode.Good, tagName: 'FLOW_01' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 10.5, quality: QualityCode.Good, tagName: 'FLOW_01' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 11.0, quality: QualityCode.Good, tagName: 'FLOW_01' },
          { timestamp: new Date('2024-01-01T03:00:00Z'), value: 11.5, quality: QualityCode.Good, tagName: 'FLOW_01' },
          { timestamp: new Date('2024-01-01T04:00:00Z'), value: 12.0, quality: QualityCode.Good, tagName: 'FLOW_01' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('FLOW_01');
        expect(result.type).toBe('analog');
        // With 5 unique values, it defaults to analog with 0.5 confidence
        expect(result.confidence).toBe(0.5);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty data array', () => {
        const data: TimeSeriesData[] = [];

        const result = classifyTag(data);

        expect(result.type).toBe('analog');
        expect(result.confidence).toBe(0.0);
        expect(result.tagName).toBe('UNKNOWN');
      });

      it('should handle single data point', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 25.5, quality: QualityCode.Good, tagName: 'TEMP_01' }
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('TEMP_01');
        expect(result.type).toBe('analog');
        expect(result.confidence).toBe(0.3); // Low confidence for constant value
      });

      it('should handle all identical values', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 50.0, quality: QualityCode.Good, tagName: 'LEVEL_01' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 50.0, quality: QualityCode.Good, tagName: 'LEVEL_01' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 50.0, quality: QualityCode.Good, tagName: 'LEVEL_01' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('LEVEL_01');
        expect(result.type).toBe('analog');
        expect(result.confidence).toBe(0.3); // Low confidence for constant value
      });

      it('should handle 3 unique values (edge case between digital and analog)', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'STATE' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 1, quality: QualityCode.Good, tagName: 'STATE' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 2, quality: QualityCode.Good, tagName: 'STATE' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('STATE');
        expect(result.type).toBe('analog');
        expect(result.confidence).toBe(0.5); // Low confidence, uncertain classification
      });

      it('should handle sparse data with few unique values', () => {
        const data: TimeSeriesData[] = [
          { timestamp: new Date('2024-01-01T00:00:00Z'), value: 10, quality: QualityCode.Good, tagName: 'SPARSE' },
          { timestamp: new Date('2024-01-01T01:00:00Z'), value: 20, quality: QualityCode.Good, tagName: 'SPARSE' },
          { timestamp: new Date('2024-01-01T02:00:00Z'), value: 30, quality: QualityCode.Good, tagName: 'SPARSE' },
          { timestamp: new Date('2024-01-01T03:00:00Z'), value: 40, quality: QualityCode.Good, tagName: 'SPARSE' },
        ];

        const result = classifyTag(data);

        expect(result.tagName).toBe('SPARSE');
        expect(result.type).toBe('analog');
        // Confidence should be moderate (0.5) since it's uncertain
        expect(result.confidence).toBe(0.5);
      });
    });
  });

  describe('classifyTags', () => {
    it('should classify multiple tags in batch', () => {
      const tagData = new Map<string, TimeSeriesData[]>([
        [
          'TEMP_01',
          [
            { timestamp: new Date('2024-01-01T00:00:00Z'), value: 25.1, quality: QualityCode.Good, tagName: 'TEMP_01' },
            { timestamp: new Date('2024-01-01T01:00:00Z'), value: 25.3, quality: QualityCode.Good, tagName: 'TEMP_01' },
            { timestamp: new Date('2024-01-01T02:00:00Z'), value: 25.5, quality: QualityCode.Good, tagName: 'TEMP_01' },
          ]
        ],
        [
          'PUMP_STATUS',
          [
            { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
            { timestamp: new Date('2024-01-01T01:00:00Z'), value: 1, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
            { timestamp: new Date('2024-01-01T02:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
          ]
        ]
      ]);

      const results = classifyTags(tagData);

      expect(results.size).toBe(2);
      expect(results.get('TEMP_01')?.type).toBe('analog');
      expect(results.get('PUMP_STATUS')?.type).toBe('digital');
    });

    it('should handle empty map', () => {
      const tagData = new Map<string, TimeSeriesData[]>();

      const results = classifyTags(tagData);

      expect(results.size).toBe(0);
    });

    it('should handle errors gracefully and continue processing', () => {
      const tagData = new Map<string, TimeSeriesData[]>([
        ['TEMP_01', []],  // Empty data will cause low confidence
        [
          'PUMP_STATUS',
          [
            { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
            { timestamp: new Date('2024-01-01T01:00:00Z'), value: 1, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
          ]
        ]
      ]);

      const results = classifyTags(tagData);

      expect(results.size).toBe(2);
      expect(results.get('TEMP_01')?.confidence).toBe(0.0);
      expect(results.get('PUMP_STATUS')?.type).toBe('digital');
    });

    it('should correctly count analog and digital tags', () => {
      const tagData = new Map<string, TimeSeriesData[]>([
        [
          'TEMP_01',
          Array.from({ length: 15 }, (_, i) => ({
            timestamp: new Date(`2024-01-01T${String(i).padStart(2, '0')}:00:00Z`),
            value: 20 + i * 0.5,
            quality: QualityCode.Good,
            tagName: 'TEMP_01'
          }))
        ],
        [
          'PRESSURE_01',
          Array.from({ length: 15 }, (_, i) => ({
            timestamp: new Date(`2024-01-01T${String(i).padStart(2, '0')}:00:00Z`),
            value: 100 + i * 1.5,
            quality: QualityCode.Good,
            tagName: 'PRESSURE_01'
          }))
        ],
        [
          'PUMP_STATUS',
          [
            { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
            { timestamp: new Date('2024-01-01T01:00:00Z'), value: 1, quality: QualityCode.Good, tagName: 'PUMP_STATUS' },
          ]
        ],
        [
          'VALVE_OPEN',
          [
            { timestamp: new Date('2024-01-01T00:00:00Z'), value: 0, quality: QualityCode.Good, tagName: 'VALVE_OPEN' },
            { timestamp: new Date('2024-01-01T01:00:00Z'), value: 100, quality: QualityCode.Good, tagName: 'VALVE_OPEN' },
          ]
        ]
      ]);

      const results = classifyTags(tagData);

      const analogCount = Array.from(results.values()).filter(c => c.type === 'analog').length;
      const digitalCount = Array.from(results.values()).filter(c => c.type === 'digital').length;

      expect(results.size).toBe(4);
      expect(analogCount).toBe(2);
      expect(digitalCount).toBe(2);
    });
  });
});
