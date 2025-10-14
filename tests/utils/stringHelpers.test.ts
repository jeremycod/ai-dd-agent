import { trimErrorMessage } from '../../src/utils/stringHelpers';

describe('stringHelpers', () => {
  describe('trimErrorMessage', () => {
    it('should trim stack trace from error message', () => {
      const errorWithStack = `Error: Something went wrong
    at Object.test (/path/to/file.js:10:5)
    at Module._compile (module.js:456:26)`;
      
      const result = trimErrorMessage(errorWithStack);
      expect(result).toBe('Error: Something went wrong');
    });

    it('should return original message if no stack trace', () => {
      const simpleError = 'Simple error message';
      const result = trimErrorMessage(simpleError);
      expect(result).toBe('Simple error message');
    });

    it('should handle multiline error without stack', () => {
      const multilineError = `Error: Something went wrong
Additional error details
More information`;
      
      const result = trimErrorMessage(multilineError);
      expect(result).toBe(multilineError);
    });

    it('should handle empty string', () => {
      const result = trimErrorMessage('');
      expect(result).toBe('');
    });

    it('should handle null input', () => {
      const result = trimErrorMessage(null as any);
      expect(result).toBe('');
    });

    it('should handle undefined input', () => {
      const result = trimErrorMessage(undefined as any);
      expect(result).toBe('');
    });

    it('should handle non-string input', () => {
      const result = trimErrorMessage(123 as any);
      expect(result).toBe('');
    });

    it('should preserve error message with stack trace in middle', () => {
      const errorMessage = `Error: Something went wrong
Some details
    at Object.test (/path/to/file.js:10:5)
    at Module._compile (module.js:456:26)`;
      
      const result = trimErrorMessage(errorMessage);
      expect(result).toBe('Error: Something went wrong\nSome details');
    });
  });
});