// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Mock environment variables that are required
process.env.GENIE_JWT_JWK = '{"kty":"oct","k":"dGVzdC1rZXktZm9yLXRlc3Rpbmc","alg":"A256GCM"}';