/**
 * Tag Classification Service
 * 
 * Determines whether tags are analog (continuous) or digital (binary) based on
 * data characteristics. This classification is used to determine which analytics
 * to apply to each tag (e.g., trend lines and SPC charts for analog tags only).
 * 
 * Classification Algorithm:
 * - Binary patterns (0/1, 0/100) → Digital
 * - Many unique values (>10) → Analog
 * - Continuous distribution → Analog
 * - Default → Analog (with low confidence)
 */

import { TimeSeriesData } from '@/types/historian';
import { logger } from '@/utils/logger';

/**
 * Tag classification result
 */
export interface TagClassification {
  tagName: string;
  type: 'analog' | 'digital';
  confidence: number; // 0-1, how confident the classification is
}

/**
 * Tag Classification Service interface
 */
export interface TagClassificationService {
  /**
   * Classify a tag based on its data characteristics
   */
  classifyTag(data: TimeSeriesData[]): TagClassification;
  
  /**
   * Classify multiple tags in batch
   */
  classifyTags(tagData: Map<string, TimeSeriesData[]>): Map<string, TagClassification>;
}

/**
 * Classify a single tag based on its time-series data
 * 
 * @param data - Time-series data points for the tag
 * @returns Classification result with type and confidence
 * 
 * @example
 * ```typescript
 * const data = [
 *   { timestamp: new Date(), value: 0, quality: 192, tagName: 'PUMP_STATUS' },
 *   { timestamp: new Date(), value: 1, quality: 192, tagName: 'PUMP_STATUS' }
 * ];
 * const result = classifyTag(data);
 * // result: { tagName: 'PUMP_STATUS', type: 'digital', confidence: 1.0 }
 * ```
 */
export function classifyTag(data: TimeSeriesData[]): TagClassification {
  if (!data || data.length === 0) {
    logger.warn('Empty data array provided for tag classification');
    return {
      tagName: 'UNKNOWN',
      type: 'analog',
      confidence: 0.0
    };
  }

  const tagName = data[0]?.tagName || 'UNKNOWN';

  // Extract unique values
  const uniqueValues = new Set(data.map(d => d.value));
  
  // If only 2 unique values and they are 0/1 or similar binary pattern
  if (uniqueValues.size === 2) {
    const values = Array.from(uniqueValues).sort((a, b) => a - b);
    
    // Check for common binary patterns: 0/1, 0/100
    if ((values[0] === 0 && values[1] === 1) || 
        (values[0] === 0 && values[1] === 100)) {
      logger.debug(`Tag ${tagName} classified as digital (binary pattern: ${values[0]}/${values[1]})`);
      return { tagName, type: 'digital', confidence: 1.0 };
    }
  }
  
  // If more than 10 unique values, likely analog
  if (uniqueValues.size > 10) {
    logger.debug(`Tag ${tagName} classified as analog (${uniqueValues.size} unique values)`);
    return { tagName, type: 'analog', confidence: 0.95 };
  }
  
  // Check for continuous distribution
  const values = data.map(d => d.value);
  const range = Math.max(...values) - Math.min(...values);
  
  // If range is zero (all same value), default to analog with low confidence
  if (range === 0) {
    logger.debug(`Tag ${tagName} has constant value, defaulting to analog with low confidence`);
    return { tagName, type: 'analog', confidence: 0.3 };
  }
  
  const avgGap = range / uniqueValues.size;
  
  // If gaps are small relative to range, likely analog
  if (avgGap < range * 0.1) {
    logger.debug(`Tag ${tagName} classified as analog (continuous distribution, avgGap: ${avgGap.toFixed(2)})`);
    return { tagName, type: 'analog', confidence: 0.8 };
  }
  
  // Default to analog with low confidence
  logger.warn(`Tag ${tagName} classification uncertain, defaulting to analog (${uniqueValues.size} unique values, range: ${range})`);
  return { tagName, type: 'analog', confidence: 0.5 };
}

/**
 * Classify multiple tags in batch
 * 
 * @param tagData - Map of tag names to their time-series data
 * @returns Map of tag names to their classification results
 * 
 * @example
 * ```typescript
 * const tagData = new Map([
 *   ['TEMP_01', [{ timestamp: new Date(), value: 25.5, quality: 192, tagName: 'TEMP_01' }]],
 *   ['PUMP_STATUS', [{ timestamp: new Date(), value: 0, quality: 192, tagName: 'PUMP_STATUS' }]]
 * ]);
 * const results = classifyTags(tagData);
 * // results: Map { 'TEMP_01' => { type: 'analog', ... }, 'PUMP_STATUS' => { type: 'digital', ... } }
 * ```
 */
export function classifyTags(tagData: Map<string, TimeSeriesData[]>): Map<string, TagClassification> {
  const classifications = new Map<string, TagClassification>();
  
  for (const [tagName, data] of tagData.entries()) {
    try {
      const classification = classifyTag(data);
      classifications.set(tagName, classification);
    } catch (error) {
      logger.error(`Error classifying tag ${tagName}:`, error);
      // On error, default to analog with zero confidence
      classifications.set(tagName, {
        tagName,
        type: 'analog',
        confidence: 0.0
      });
    }
  }
  
  logger.info(`Classified ${classifications.size} tags: ${
    Array.from(classifications.values()).filter(c => c.type === 'analog').length
  } analog, ${
    Array.from(classifications.values()).filter(c => c.type === 'digital').length
  } digital`);
  
  return classifications;
}

/**
 * Default export of the service implementation
 */
export const TagClassificationServiceImpl: TagClassificationService = {
  classifyTag,
  classifyTags
};
