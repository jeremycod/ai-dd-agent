// Mock jose before any imports
jest.mock('jose', () => ({
  importJWK: jest.fn()
}));

// Mock logger before any imports
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('auth/jwtSecret', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    // Set a valid JWK for testing
    process.env.GENIE_JWT_JWK = '{"kty":"oct","k":"dGVzdC1rZXktZm9yLXRlc3Rpbmc","alg":"A256GCM"}';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('environment validation', () => {
    it('should require GENIE_JWT_JWK environment variable', () => {
      delete process.env.GENIE_JWT_JWK;
      
      expect(() => {
        require('../../../src/utils/auth/jwtSecret');
      }).toThrow('GENIE_JWT_JWK environment variable is required');
    });
  });

  describe('loadSymmetricKey', () => {
    it('should parse JWK and call importJWK', async () => {
      const mockKey = new Uint8Array(32);
      const mockImportJWK = require('jose').importJWK;
      mockImportJWK.mockResolvedValue(mockKey);

      const { loadSymmetricKey } = require('../../../src/utils/auth/jwtSecret');
      await loadSymmetricKey();

      expect(mockImportJWK).toHaveBeenCalledWith({
        kty: 'oct',
        k: 'dGVzdC1rZXktZm9yLXRlc3Rpbmc',
        alg: 'A256GCM'
      });
    });

    it('should handle importJWK errors', async () => {
      const mockImportJWK = require('jose').importJWK;
      mockImportJWK.mockRejectedValue(new Error('Import failed'));

      const { loadSymmetricKey } = require('../../../src/utils/auth/jwtSecret');
      
      await expect(loadSymmetricKey()).rejects.toThrow(
        'Critical: Failed to load JWT symmetric key for encryption.'
      );
    });
  });

  describe('getSymmetricKey', () => {
    it('should throw error when key not loaded', () => {
      const { getSymmetricKey } = require('../../../src/utils/auth/jwtSecret');
      
      expect(() => getSymmetricKey()).toThrow(
        'JWT symmetric key not loaded. Call loadSymmetricKey() first.'
      );
    });
  });
});