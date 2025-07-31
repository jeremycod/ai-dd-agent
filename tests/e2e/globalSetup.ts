import { E2ETestEnvironment } from './setup/testEnvironment';
import { logger } from '../../src/utils';

let globalTestEnvironment: E2ETestEnvironment | null = null;

export async function setupGlobalTestEnvironment(): Promise<E2ETestEnvironment> {
  if (globalTestEnvironment) {
    return globalTestEnvironment;
  }

  logger.info('[GlobalSetup] Initializing global E2E test environment...');

  globalTestEnvironment = new E2ETestEnvironment({
    dbName: 'ai-diagnostic-e2e-test',
    mockLLMConfig: {
      responseVariability: 0.05, // Lower variability for consistent tests
      latencySimulation: false, // Disable for faster tests
      errorInjection: false
    },
    qualityThresholds: {
      relevance: 0.8,
      accuracy: 0.85,
      completeness: 0.9,
      // coherence: 0.8,
      // hallucination: 0.1
    }
  });

  await globalTestEnvironment.setup();
  
  logger.info('[GlobalSetup] Global E2E test environment ready');
  return globalTestEnvironment;
}

export async function teardownGlobalTestEnvironment(): Promise<void> {
  if (globalTestEnvironment) {
    logger.info('[GlobalTeardown] Cleaning up global E2E test environment...');
    await globalTestEnvironment.cleanup();
    globalTestEnvironment = null;
    logger.info('[GlobalTeardown] Global E2E test environment cleanup complete');
  }
}

export function getGlobalTestEnvironment(): E2ETestEnvironment {
  if (!globalTestEnvironment) {
    throw new Error('Global test environment not initialized. Call setupGlobalTestEnvironment() first.');
  }
  return globalTestEnvironment;
}

// Jest global setup/teardown hooks
export default async function globalSetup(): Promise<void> {
  await setupGlobalTestEnvironment();
}

export async function globalTeardown(): Promise<void> {
  await teardownGlobalTestEnvironment();
}