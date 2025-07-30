import { logger } from '../../src/utils/logger';
import winston from 'winston';

describe('logger', () => {
  it('should be a winston logger instance', () => {
    expect(logger).toBeInstanceOf(winston.Logger);
  });

  it('should have info level configured', () => {
    expect(logger.level).toBe('info');
  });

  it('should have console and file transports', () => {
    const transports = logger.transports;
    expect(transports).toHaveLength(2);
    
    const hasConsole = transports.some(t => t instanceof winston.transports.Console);
    const hasFile = transports.some(t => t instanceof winston.transports.File);
    
    expect(hasConsole).toBe(true);
    expect(hasFile).toBe(true);
  });

  it('should have proper format configuration', () => {
    expect(logger.format).toBeDefined();
  });

  it('should be able to log messages', () => {
    // Simple test to verify logger works
    expect(() => {
      logger.info('Test message');
    }).not.toThrow();
  });
});