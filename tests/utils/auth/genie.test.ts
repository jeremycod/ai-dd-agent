describe('auth/genie', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getToken', () => {
    it('should return token from environment variable', () => {
      process.env.JWT_TOKEN = 'test-token-123';
      const { getToken } = require('../../../src/utils/auth/genie');
      const result = getToken();
      expect(result).toBe('test-token-123');
    });

    it('should return null when no token in environment', () => {
      delete process.env.JWT_TOKEN;
      const { getToken } = require('../../../src/utils/auth/genie');
      const result = getToken();
      expect(result).toBeNull();
    });
  });

  describe('setToken', () => {
    it('should set token in process.env', () => {
      const { setToken } = require('../../../src/utils/auth/genie');
      const token = 'new-test-token';
      
      setToken(token);
      
      expect(process.env.JWT_TOKEN).toBe(token);
    });
  });

  describe('removeToken', () => {
    it('should remove token from process.env', () => {
      process.env.JWT_TOKEN = 'token-to-remove';
      const { removeToken } = require('../../../src/utils/auth/genie');
      
      removeToken();
      
      expect(process.env.JWT_TOKEN).toBeUndefined();
    });
  });
});