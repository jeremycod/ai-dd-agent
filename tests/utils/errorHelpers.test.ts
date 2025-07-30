import { safeJsonStringify } from '../../src/utils/errorHelpers';
import { ZodError } from 'zod';

describe('errorHelpers', () => {
  describe('safeJsonStringify', () => {
    it('should stringify simple objects', () => {
      const obj = { name: 'test', value: 123 };
      const result = safeJsonStringify(obj);
      expect(result).toBe('{\n  "name": "test",\n  "value": 123\n}');
    });

    it('should handle circular references', () => {
      const obj: any = { name: 'test' };
      obj.self = obj;
      const result = safeJsonStringify(obj);
      expect(result).toContain('"name": "test"');
      expect(result).not.toContain('circular');
    });

    it('should handle Error instances', () => {
      const error = new Error('Test error');
      const result = safeJsonStringify(error);
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('Error');
      expect(parsed.message).toBe('Test error');
      expect(parsed.stack).toBeDefined();
    });

    it('should handle ZodError instances', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['field'],
          message: 'Expected string, received number'
        }
      ]);
      const result = safeJsonStringify(zodError);
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('ZodError');
      expect(parsed.issues).toBeDefined();
      expect(parsed.issues).toHaveLength(1);
    });

    it('should handle custom indent', () => {
      const obj = { test: 'value' };
      const result = safeJsonStringify(obj, 4);
      expect(result).toContain('    "test"');
    });

    it('should handle null and undefined', () => {
      expect(safeJsonStringify(null)).toBe('null');
      expect(safeJsonStringify(undefined)).toBe(undefined);
    });
  });
});