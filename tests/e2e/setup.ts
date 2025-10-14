import { getGlobalTestEnvironment } from './globalSetup';
import { logger } from '../../src/utils';

// Global test environment instance
let testEnv: any;

beforeAll(async () => {
  testEnv = getGlobalTestEnvironment();
  logger.info('[E2E Setup] Test environment ready for test suite');
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.resetEnvironment();
    logger.info('[E2E Setup] Test environment reset after test suite');
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.resetEnvironment();
  }
});

// Make test environment available globally
(global as any).testEnv = testEnv;