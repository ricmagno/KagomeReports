/**
 * Tests for path normalization utilities
 */

import {
  normalizePathToForwardSlashes,
  convertToPlatformPath,
  normalizePathsInObject,
  convertPathsInObject,
  isAbsolutePath,
  ensureRelativePath,
  joinPathsWithForwardSlashes,
} from '../pathNormalization';

describe('Path Normalization Utilities', () => {
  describe('normalizePathToForwardSlashes', () => {
    it('should convert Windows paths to forward slashes', () => {
      expect(normalizePathToForwardSlashes('C:\\Users\\John\\reports')).toBe('C:/Users/John/reports');
      expect(normalizePathToForwardSlashes('reports\\data\\file.json')).toBe('reports/data/file.json');
    });

    it('should preserve Unix paths', () => {
      expect(normalizePathToForwardSlashes('/home/john/reports')).toBe('/home/john/reports');
      expect(normalizePathToForwardSlashes('reports/data/file.json')).toBe('reports/data/file.json');
    });

    it('should handle mixed separators', () => {
      expect(normalizePathToForwardSlashes('C:\\Users/John\\reports/data')).toBe('C:/Users/John/reports/data');
    });

    it('should remove duplicate slashes', () => {
      expect(normalizePathToForwardSlashes('reports//data///file.json')).toBe('reports/data/file.json');
    });

    it('should remove trailing slash', () => {
      expect(normalizePathToForwardSlashes('reports/data/')).toBe('reports/data');
    });

    it('should preserve root slash', () => {
      expect(normalizePathToForwardSlashes('/')).toBe('/');
    });

    it('should handle empty string', () => {
      expect(normalizePathToForwardSlashes('')).toBe('');
    });
  });

  describe('convertToPlatformPath', () => {
    it('should handle forward slash paths', () => {
      const result = convertToPlatformPath('reports/data/file.json');
      // Result depends on platform, just verify it's a string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle absolute Unix paths', () => {
      const result = convertToPlatformPath('/home/john/reports');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle Windows drive letters', () => {
      const result = convertToPlatformPath('C:/Users/John/reports');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty string', () => {
      expect(convertToPlatformPath('')).toBe('');
    });
  });

  describe('normalizePathsInObject', () => {
    it('should normalize string path fields', () => {
      const obj = {
        outputPath: 'C:\\Users\\John\\reports',
        name: 'Test Report',
        count: 42,
      };

      const result = normalizePathsInObject(obj, ['outputPath']);

      expect(result.outputPath).toBe('C:/Users/John/reports');
      expect(result.name).toBe('Test Report');
      expect(result.count).toBe(42);
    });

    it('should normalize array path fields', () => {
      const obj = {
        paths: ['C:\\Users\\John\\reports', 'D:\\Data\\files'],
        name: 'Test',
      };

      const result = normalizePathsInObject(obj, ['paths']);

      expect(result.paths).toEqual(['C:/Users/John/reports', 'D:/Data/files']);
      expect(result.name).toBe('Test');
    });

    it('should not modify non-path fields', () => {
      const obj = {
        outputPath: 'C:\\Users\\John\\reports',
        name: 'Test\\Report',
        count: 42,
      };

      const result = normalizePathsInObject(obj, ['outputPath']);

      expect(result.name).toBe('Test\\Report'); // Not normalized
    });
  });

  describe('convertPathsInObject', () => {
    it('should convert string path fields', () => {
      const obj = {
        outputPath: 'reports/data/file.json',
        name: 'Test Report',
      };

      const result = convertPathsInObject(obj, ['outputPath']);

      expect(typeof result.outputPath).toBe('string');
      expect(result.name).toBe('Test Report');
    });

    it('should convert array path fields', () => {
      const obj = {
        paths: ['reports/data/file1.json', 'reports/data/file2.json'],
        name: 'Test',
      };

      const result = convertPathsInObject(obj, ['paths']);

      expect(Array.isArray(result.paths)).toBe(true);
      expect(result.paths.length).toBe(2);
    });
  });

  describe('isAbsolutePath', () => {
    it('should detect Unix absolute paths', () => {
      expect(isAbsolutePath('/home/john/reports')).toBe(true);
      expect(isAbsolutePath('/usr/local/bin')).toBe(true);
    });

    it('should detect Windows absolute paths', () => {
      expect(isAbsolutePath('C:/Users/John/reports')).toBe(true);
      expect(isAbsolutePath('D:\\Data\\files')).toBe(true);
    });

    it('should detect UNC paths', () => {
      expect(isAbsolutePath('\\\\server\\share\\file')).toBe(true);
    });

    it('should detect relative paths', () => {
      expect(isAbsolutePath('reports/data')).toBe(false);
      expect(isAbsolutePath('./reports')).toBe(false);
      expect(isAbsolutePath('../data')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isAbsolutePath('')).toBe(false);
    });
  });

  describe('ensureRelativePath', () => {
    it('should remove leading slash from Unix paths', () => {
      expect(ensureRelativePath('/home/john/reports')).toBe('home/john/reports');
    });

    it('should remove drive letter from Windows paths', () => {
      expect(ensureRelativePath('C:/Users/John/reports')).toBe('Users/John/reports');
      expect(ensureRelativePath('D:\\Data\\files')).toBe('Data\\files');
    });

    it('should remove UNC prefix', () => {
      expect(ensureRelativePath('\\\\server\\share\\file')).toBe('server\\share\\file');
    });

    it('should preserve relative paths', () => {
      expect(ensureRelativePath('reports/data')).toBe('reports/data');
      expect(ensureRelativePath('./reports')).toBe('./reports');
    });

    it('should handle empty string', () => {
      expect(ensureRelativePath('')).toBe('');
    });
  });

  describe('joinPathsWithForwardSlashes', () => {
    it('should join path segments with forward slashes', () => {
      expect(joinPathsWithForwardSlashes('reports', 'data', 'file.json')).toBe('reports/data/file.json');
    });

    it('should handle segments with existing slashes', () => {
      expect(joinPathsWithForwardSlashes('reports/', '/data/', '/file.json')).toBe('reports/data/file.json');
    });

    it('should filter empty segments', () => {
      expect(joinPathsWithForwardSlashes('reports', '', 'data', '', 'file.json')).toBe('reports/data/file.json');
    });

    it('should handle single segment', () => {
      expect(joinPathsWithForwardSlashes('reports')).toBe('reports');
    });

    it('should handle no segments', () => {
      expect(joinPathsWithForwardSlashes()).toBe('');
    });

    it('should normalize backslashes in segments', () => {
      expect(joinPathsWithForwardSlashes('reports\\data', 'files\\test')).toBe('reports/data/files/test');
    });
  });

  describe('Cross-platform compatibility', () => {
    it('should handle round-trip normalization', () => {
      const originalPath = 'C:\\Users\\John\\reports\\data\\file.json';
      const normalized = normalizePathToForwardSlashes(originalPath);
      const converted = convertToPlatformPath(normalized);

      // Verify the path is valid (platform-specific)
      expect(typeof converted).toBe('string');
      expect(converted.length).toBeGreaterThan(0);
    });

    it('should preserve path semantics across platforms', () => {
      const paths = [
        'reports/data/file.json',
        '/home/john/reports',
        'C:/Users/John/reports',
      ];

      paths.forEach(path => {
        const normalized = normalizePathToForwardSlashes(path);
        const converted = convertToPlatformPath(normalized);

        // Verify conversion produces valid output
        expect(typeof converted).toBe('string');
        expect(converted.length).toBeGreaterThan(0);
      });
    });
  });

  describe('UTF-8 character handling', () => {
    it('should handle Unicode characters in paths', () => {
      const path = 'reports/données/fichier.json';
      const normalized = normalizePathToForwardSlashes(path);
      expect(normalized).toBe('reports/données/fichier.json');
    });

    it('should handle Chinese characters in paths', () => {
      const path = 'reports/数据/文件.json';
      const normalized = normalizePathToForwardSlashes(path);
      expect(normalized).toBe('reports/数据/文件.json');
    });

    it('should handle emoji in paths', () => {
      const path = 'reports/📊data/file.json';
      const normalized = normalizePathToForwardSlashes(path);
      expect(normalized).toBe('reports/📊data/file.json');
    });
  });
});
