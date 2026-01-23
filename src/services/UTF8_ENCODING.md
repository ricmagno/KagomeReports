# UTF-8 Encoding in Export/Import

## Overview

The report configuration export/import functionality uses UTF-8 encoding throughout to ensure proper handling of Unicode characters across all platforms (Windows, macOS, Linux).

## Why UTF-8?

UTF-8 is the universal character encoding standard that:
- Supports all Unicode characters (including international characters, emojis, special symbols)
- Is backward compatible with ASCII
- Is the default encoding for JSON
- Works consistently across all platforms
- Is the standard for web and modern applications

## Implementation Details

### Export (JSON)

**JSON.stringify and UTF-8:**
- `JSON.stringify()` in Node.js produces UTF-8 encoded strings by default
- All JavaScript strings are internally represented as UTF-16, but when serialized to JSON, they are converted to UTF-8
- No explicit encoding specification is needed

**Buffer Operations:**
```typescript
// File size calculation uses UTF-8 encoding explicitly
const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
```

**Metadata:**
- Export metadata includes `encoding: 'UTF-8'` field to document the encoding
- This helps importers verify they're handling the correct encoding

### Import (JSON)

**JSON.parse and UTF-8:**
- `JSON.parse()` in Node.js automatically handles UTF-8 encoded strings
- When a UTF-8 encoded JSON file is read as a string, JSON.parse correctly decodes all Unicode characters
- No explicit decoding is needed

**File Size Validation:**
```typescript
// File size calculation uses UTF-8 encoding
const sizeBytes = Buffer.byteLength(fileContent, 'utf8');
```

## Cross-Platform Compatibility

### Character Handling

UTF-8 ensures that characters are handled consistently across platforms:

**Example: International Characters**
```json
{
  "reportName": "Température Réacteur",
  "tags": ["温度センサー", "Датчик_давления"],
  "description": "Report with émojis 🌡️📊"
}
```

All these characters are properly preserved during export and import on any platform.

### File System Encoding

**Windows:**
- File system uses UTF-16, but Node.js handles conversion automatically
- JSON files are written and read as UTF-8

**macOS/Linux:**
- File system typically uses UTF-8 natively
- No conversion needed

## Testing UTF-8 Encoding

### Test Cases

1. **Basic ASCII Characters:**
   - Export/import configuration with only ASCII characters
   - Verify round-trip preservation

2. **Latin Extended Characters:**
   - Export/import with accented characters (é, ñ, ü, etc.)
   - Verify proper encoding/decoding

3. **Non-Latin Scripts:**
   - Export/import with Chinese, Japanese, Arabic, Cyrillic characters
   - Verify character preservation

4. **Special Symbols:**
   - Export/import with mathematical symbols, currency symbols
   - Verify proper handling

5. **Emojis:**
   - Export/import with emoji characters
   - Verify multi-byte character handling

### Example Test

```typescript
describe('UTF-8 Encoding', () => {
  it('should preserve Unicode characters in round-trip', async () => {
    const config = {
      name: 'Test Report 测试报告',
      tags: ['Température', 'Давление', '温度'],
      description: 'Report with émojis 🌡️📊',
    };

    // Export
    const exported = await exportService.exportConfiguration(config, {
      format: 'json',
    });

    // Import
    const imported = await importService.importConfiguration(exported.data);

    // Verify all characters are preserved
    expect(imported.config.name).toBe(config.name);
    expect(imported.config.tags).toEqual(config.tags);
    expect(imported.config.description).toBe(config.description);
  });
});
```

## Troubleshooting

### Issue: Characters Appear Garbled

**Cause:** File was not read as UTF-8

**Solution:** Ensure file reading uses UTF-8 encoding:
```typescript
// Correct
const content = fs.readFileSync('config.json', 'utf8');

// Incorrect (uses default encoding which may not be UTF-8)
const content = fs.readFileSync('config.json');
```

### Issue: Emoji or Special Characters Missing

**Cause:** System or editor doesn't support UTF-8

**Solution:**
- Verify the file is saved as UTF-8 (not UTF-16 or other encoding)
- Use a UTF-8 compatible text editor
- Check that the terminal/console supports UTF-8 display

### Issue: File Size Calculation Incorrect

**Cause:** Using string length instead of byte length

**Solution:**
```typescript
// Correct - counts bytes in UTF-8 encoding
const sizeBytes = Buffer.byteLength(content, 'utf8');

// Incorrect - counts characters (not bytes)
const sizeChars = content.length;
```

Note: Multi-byte characters (like emojis) take more than 1 byte in UTF-8, so byte length ≠ character length.

## Best Practices

1. **Always specify UTF-8 explicitly** when reading/writing files:
   ```typescript
   fs.readFileSync(path, 'utf8')
   fs.writeFileSync(path, content, 'utf8')
   ```

2. **Use Buffer.byteLength for size calculations:**
   ```typescript
   const bytes = Buffer.byteLength(string, 'utf8')
   ```

3. **Include encoding metadata in exports:**
   ```typescript
   exportMetadata: {
     encoding: 'UTF-8',
     // ... other metadata
   }
   ```

4. **Test with international characters:**
   - Include test cases with various Unicode characters
   - Test on different platforms (Windows, macOS, Linux)

5. **Document encoding in API responses:**
   ```typescript
   res.setHeader('Content-Type', 'application/json; charset=utf-8')
   ```

## References

- [UTF-8 Specification](https://en.wikipedia.org/wiki/UTF-8)
- [Node.js Buffer Documentation](https://nodejs.org/api/buffer.html)
- [JSON Specification (RFC 8259)](https://tools.ietf.org/html/rfc8259)
- [Unicode Standard](https://unicode.org/standard/standard.html)
