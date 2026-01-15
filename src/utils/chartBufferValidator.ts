/**
 * Chart Buffer Validator
 * Validates chart buffers before PDF embedding
 * Requirements: 4.1, 4.2, 4.3
 */

import { reportLogger } from './logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  bufferInfo: BufferInfo;
}

export interface BufferInfo {
  size: number;
  format: string;
  dimensions?: { width: number; height: number };
}

export class ChartBufferValidator {
  private readonly PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  private readonly MIN_BUFFER_SIZE = 100; // bytes
  private readonly MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Validate a chart buffer
   */
  validateBuffer(buffer: Buffer, chartName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    reportLogger.debug('Validating chart buffer', {
      chartName,
      bufferLength: buffer?.length || 0
    });

    // Check buffer exists and has content
    if (!buffer || buffer.length === 0) {
      errors.push(`Chart buffer is empty for ${chartName}`);
      return { 
        valid: false, 
        errors, 
        warnings, 
        bufferInfo: { size: 0, format: 'unknown' } 
      };
    }

    // Check buffer size
    if (buffer.length < this.MIN_BUFFER_SIZE) {
      errors.push(`Chart buffer too small (${buffer.length} bytes) for ${chartName}`);
    }

    if (buffer.length > this.MAX_BUFFER_SIZE) {
      warnings.push(`Chart buffer very large (${buffer.length} bytes) for ${chartName}`);
    }

    // Check PNG format
    if (!this.isPNGBuffer(buffer)) {
      errors.push(`Chart buffer is not valid PNG format for ${chartName}`);
      
      // Log first few bytes for debugging
      const firstBytes = buffer.slice(0, Math.min(16, buffer.length));
      reportLogger.error('Invalid PNG buffer - first bytes:', {
        chartName,
        firstBytes: firstBytes.toString('hex'),
        expected: this.PNG_MAGIC_BYTES.toString('hex')
      });
    }

    const bufferInfo = this.getBufferInfo(buffer);

    const result = {
      valid: errors.length === 0,
      errors,
      warnings,
      bufferInfo
    };

    if (!result.valid) {
      reportLogger.error('Chart buffer validation failed', {
        chartName,
        errors,
        bufferInfo
      });
    } else if (warnings.length > 0) {
      reportLogger.warn('Chart buffer validation warnings', {
        chartName,
        warnings,
        bufferInfo
      });
    } else {
      reportLogger.debug('Chart buffer validation passed', {
        chartName,
        bufferInfo
      });
    }

    return result;
  }

  /**
   * Check if buffer is a valid PNG
   */
  isPNGBuffer(buffer: Buffer): boolean {
    if (buffer.length < 8) {
      return false;
    }
    
    const header = buffer.slice(0, 4);
    return header.equals(this.PNG_MAGIC_BYTES);
  }

  /**
   * Get buffer information
   */
  getBufferInfo(buffer: Buffer): BufferInfo {
    const info: BufferInfo = {
      size: buffer.length,
      format: this.isPNGBuffer(buffer) ? 'PNG' : 'unknown'
    };

    // Try to extract PNG dimensions if it's a valid PNG
    if (this.isPNGBuffer(buffer) && buffer.length >= 24) {
      try {
        // PNG IHDR chunk starts at byte 16
        // Width is bytes 16-19, height is bytes 20-23 (big-endian)
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        
        if (width > 0 && width < 10000 && height > 0 && height < 10000) {
          info.dimensions = { width, height };
        }
      } catch (error) {
        // Silently fail dimension extraction
        reportLogger.debug('Could not extract PNG dimensions', { error });
      }
    }

    return info;
  }

  /**
   * Get a human-readable summary of validation results
   */
  getValidationSummary(result: ValidationResult): string {
    if (result.valid) {
      return `Valid ${result.bufferInfo.format} buffer (${result.bufferInfo.size} bytes)`;
    }
    
    return `Invalid buffer: ${result.errors.join(', ')}`;
  }
}

// Export singleton instance
export const chartBufferValidator = new ChartBufferValidator();
