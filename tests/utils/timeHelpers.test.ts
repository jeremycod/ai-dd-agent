import { getDynamicTimeRangeFallback } from '../../src/utils/timeHelpers';

describe('timeHelpers', () => {
  describe('getDynamicTimeRangeFallback', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return 24h for Monday', () => {
      // Monday, January 1, 2024
      jest.setSystemTime(new Date('2024-01-01T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('24h');
    });

    it('should return 24h for Tuesday', () => {
      // Tuesday, January 2, 2024
      jest.setSystemTime(new Date('2024-01-02T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('24h');
    });

    it('should return 24h for Wednesday', () => {
      // Wednesday, January 3, 2024
      jest.setSystemTime(new Date('2024-01-03T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('24h');
    });

    it('should return 24h for Thursday', () => {
      // Thursday, January 4, 2024
      jest.setSystemTime(new Date('2024-01-04T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('24h');
    });

    it('should return 24h for Friday', () => {
      // Friday, January 5, 2024
      jest.setSystemTime(new Date('2024-01-05T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('24h');
    });

    it('should return 48h for Saturday', () => {
      // Saturday, January 6, 2024
      jest.setSystemTime(new Date('2024-01-06T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('48h');
    });

    it('should return 72h for Sunday', () => {
      // Sunday, January 7, 2024
      jest.setSystemTime(new Date('2024-01-07T10:00:00Z'));
      const result = getDynamicTimeRangeFallback();
      expect(result).toBe('72h');
    });
  });
});