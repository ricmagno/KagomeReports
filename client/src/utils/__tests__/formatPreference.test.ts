/**
 * Unit tests for format preference storage utility
 * 
 * Tests the localStorage-based persistence of export format preferences,
 * including error handling for localStorage failures.
 */

import {
  getFormatPreference,
  setFormatPreference,
  clearFormatPreference,
  hasFormatPreference,
} from '../formatPreference';

describe('formatPreference', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string };
  
  beforeEach(() => {
    // Create a fresh localStorage mock for each test
    localStorageMock = {};
    
    // Mock localStorage methods
    Storage.prototype.getItem = jest.fn((key: string) => localStorageMock[key] || null);
    Storage.prototype.setItem = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    Storage.prototype.removeItem = jest.fn((key: string) => {
      delete localStorageMock[key];
    });
    
    // Clear console.warn mock
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('getFormatPreference', () => {
    it('should return "json" as default when no preference exists', () => {
      const format = getFormatPreference();
      expect(format).toBe('json');
    });
    
    it('should return stored "json" preference', () => {
      localStorageMock['reportExportFormatPreference'] = 'json';
      const format = getFormatPreference();
      expect(format).toBe('json');
    });
    
    it('should return stored "powerbi" preference', () => {
      localStorageMock['reportExportFormatPreference'] = 'powerbi';
      const format = getFormatPreference();
      expect(format).toBe('powerbi');
    });
    
    it('should return default when stored value is invalid', () => {
      localStorageMock['reportExportFormatPreference'] = 'invalid-format';
      const format = getFormatPreference();
      expect(format).toBe('json');
    });
    
    it('should return default when localStorage throws error', () => {
      Storage.prototype.getItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });
      
      const format = getFormatPreference();
      expect(format).toBe('json');
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to read format preference from localStorage:',
        expect.any(Error)
      );
    });
    
    it('should handle localStorage quota exceeded error', () => {
      Storage.prototype.getItem = jest.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });
      
      const format = getFormatPreference();
      expect(format).toBe('json');
      expect(console.warn).toHaveBeenCalled();
    });
  });
  
  describe('setFormatPreference', () => {
    it('should store "json" preference', () => {
      setFormatPreference('json');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'reportExportFormatPreference',
        'json'
      );
      expect(localStorageMock['reportExportFormatPreference']).toBe('json');
    });
    
    it('should store "powerbi" preference', () => {
      setFormatPreference('powerbi');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'reportExportFormatPreference',
        'powerbi'
      );
      expect(localStorageMock['reportExportFormatPreference']).toBe('powerbi');
    });
    
    it('should overwrite existing preference', () => {
      localStorageMock['reportExportFormatPreference'] = 'json';
      setFormatPreference('powerbi');
      expect(localStorageMock['reportExportFormatPreference']).toBe('powerbi');
    });
    
    it('should handle localStorage error gracefully', () => {
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });
      
      // Should not throw
      expect(() => setFormatPreference('json')).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to save format preference to localStorage:',
        expect.any(Error)
      );
    });
    
    it('should handle quota exceeded error gracefully', () => {
      Storage.prototype.setItem = jest.fn(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });
      
      expect(() => setFormatPreference('powerbi')).not.toThrow();
      expect(console.warn).toHaveBeenCalled();
    });
  });
  
  describe('clearFormatPreference', () => {
    it('should remove stored preference', () => {
      localStorageMock['reportExportFormatPreference'] = 'powerbi';
      clearFormatPreference();
      expect(localStorage.removeItem).toHaveBeenCalledWith('reportExportFormatPreference');
      expect(localStorageMock['reportExportFormatPreference']).toBeUndefined();
    });
    
    it('should not throw when no preference exists', () => {
      expect(() => clearFormatPreference()).not.toThrow();
    });
    
    it('should handle localStorage error gracefully', () => {
      Storage.prototype.removeItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });
      
      expect(() => clearFormatPreference()).not.toThrow();
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to clear format preference from localStorage:',
        expect.any(Error)
      );
    });
  });
  
  describe('hasFormatPreference', () => {
    it('should return false when no preference exists', () => {
      expect(hasFormatPreference()).toBe(false);
    });
    
    it('should return true when "json" preference exists', () => {
      localStorageMock['reportExportFormatPreference'] = 'json';
      expect(hasFormatPreference()).toBe(true);
    });
    
    it('should return true when "powerbi" preference exists', () => {
      localStorageMock['reportExportFormatPreference'] = 'powerbi';
      expect(hasFormatPreference()).toBe(true);
    });
    
    it('should return false when stored value is invalid', () => {
      localStorageMock['reportExportFormatPreference'] = 'invalid';
      expect(hasFormatPreference()).toBe(false);
    });
    
    it('should return false when localStorage throws error', () => {
      Storage.prototype.getItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });
      
      expect(hasFormatPreference()).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });
  });
  
  describe('integration scenarios', () => {
    it('should persist preference across get/set calls', () => {
      // Set preference
      setFormatPreference('powerbi');
      
      // Get preference
      const format = getFormatPreference();
      expect(format).toBe('powerbi');
    });
    
    it('should return default after clearing preference', () => {
      // Set preference
      setFormatPreference('powerbi');
      expect(getFormatPreference()).toBe('powerbi');
      
      // Clear preference
      clearFormatPreference();
      
      // Should return default
      expect(getFormatPreference()).toBe('json');
      expect(hasFormatPreference()).toBe(false);
    });
    
    it('should handle multiple format changes', () => {
      setFormatPreference('json');
      expect(getFormatPreference()).toBe('json');
      
      setFormatPreference('powerbi');
      expect(getFormatPreference()).toBe('powerbi');
      
      setFormatPreference('json');
      expect(getFormatPreference()).toBe('json');
    });
    
    it('should work correctly when localStorage is unavailable', () => {
      // Simulate localStorage being unavailable
      Storage.prototype.getItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });
      Storage.prototype.setItem = jest.fn(() => {
        throw new Error('localStorage unavailable');
      });
      
      // Should still work with defaults
      expect(getFormatPreference()).toBe('json');
      expect(hasFormatPreference()).toBe(false);
      
      // Should not throw when setting
      expect(() => setFormatPreference('powerbi')).not.toThrow();
      
      // Should still return default (since set failed)
      expect(getFormatPreference()).toBe('json');
    });
  });
  
  describe('edge cases', () => {
    it('should handle null value in localStorage', () => {
      localStorageMock['reportExportFormatPreference'] = null as any;
      expect(getFormatPreference()).toBe('json');
    });
    
    it('should handle undefined value in localStorage', () => {
      localStorageMock['reportExportFormatPreference'] = undefined as any;
      expect(getFormatPreference()).toBe('json');
    });
    
    it('should handle empty string in localStorage', () => {
      localStorageMock['reportExportFormatPreference'] = '';
      expect(getFormatPreference()).toBe('json');
      expect(hasFormatPreference()).toBe(false);
    });
    
    it('should handle whitespace in localStorage', () => {
      localStorageMock['reportExportFormatPreference'] = '  json  ';
      expect(getFormatPreference()).toBe('json'); // Should return default, not trim
    });
    
    it('should be case-sensitive', () => {
      localStorageMock['reportExportFormatPreference'] = 'JSON';
      expect(getFormatPreference()).toBe('json'); // Should return default
      expect(hasFormatPreference()).toBe(false);
    });
  });
});
