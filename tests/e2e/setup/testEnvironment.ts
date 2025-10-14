import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoStorage } from '../../../src/storage/mongodb';
import { MemoryService } from '../../../src/storage/memoryService';
import { MockLLMService } from './mockLLMService';
import { TestDataLoader } from '../fixtures/testDataLoader';
import { QualityMonitor } from './qualityMonitor';
import { logger } from '../../../src/utils/logger';

export interface TestEnvironmentConfig {
  dbName?: string;
  mockLLMConfig?: {
    responseVariability?: number;
    latencySimulation?: boolean;
    errorInjection?: boolean;
  };
  qualityThresholds?: {
    relevance?: number;
    accuracy?: number;
    completeness?: number;
  };
}

export class E2ETestEnvironment {
  private testDb!: MongoMemoryServer;
  private storage!: MongoStorage;
  private memoryService!: MemoryService;
  private mockLLMService!: MockLLMService;
  private testDataLoader!: TestDataLoader;
  private qualityMonitor!: QualityMonitor;
  private config: TestEnvironmentConfig;

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      dbName: 'ai-diagnostic-test',
      mockLLMConfig: {
        responseVariability: 0.1,
        latencySimulation: true,
        errorInjection: false
      },
      qualityThresholds: {
        relevance: 0.8,
        accuracy: 0.85,
        completeness: 0.9
      },
      ...config
    };
  }

  async setup(): Promise<void> {
    logger.info('[E2ETestEnvironment] Setting up test environment...');

    try {
      // Setup isolated test database
      await this.setupDatabase();
      
      // Setup mock LLM service
      await this.setupMockLLMService();
      
      // Setup test data loader
      await this.setupTestDataLoader();
      
      // Setup quality monitoring
      await this.setupQualityMonitor();
      
      logger.info('[E2ETestEnvironment] Test environment setup complete');
    } catch (error) {
      logger.error('[E2ETestEnvironment] Failed to setup test environment:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async setupDatabase(): Promise<void> {
    // Create in-memory MongoDB instance
    this.testDb = await MongoMemoryServer.create({
      instance: {
        dbName: this.config.dbName
      }
    });

    const uri = this.testDb.getUri();
    this.storage = new MongoStorage(uri, this.config.dbName);
    await this.storage.connect();
    
    this.memoryService = new MemoryService(this.storage);
    
    logger.info(`[E2ETestEnvironment] Test database created: ${uri}`);
  }

  private async setupMockLLMService(): Promise<void> {
    this.mockLLMService = new MockLLMService(this.config.mockLLMConfig);
    await this.mockLLMService.initialize();
    
    logger.info('[E2ETestEnvironment] Mock LLM service initialized');
  }

  private async setupTestDataLoader(): Promise<void> {
    this.testDataLoader = new TestDataLoader(this.storage);
    await this.testDataLoader.initialize();
    
    logger.info('[E2ETestEnvironment] Test data loader initialized');
  }

  private async setupQualityMonitor(): Promise<void> {
    this.qualityMonitor = new QualityMonitor(this.config.qualityThresholds);
    await this.qualityMonitor.initialize();
    
    logger.info('[E2ETestEnvironment] Quality monitor initialized');
  }

  async cleanup(): Promise<void> {
    logger.info('[E2ETestEnvironment] Cleaning up test environment...');

    try {
      if (this.qualityMonitor) {
        await this.qualityMonitor.generateReport();
      }

      if (this.mockLLMService) {
        await this.mockLLMService.cleanup();
      }

      if (this.storage) {
        await this.storage.disconnect();
      }

      if (this.testDb) {
        await this.testDb.stop();
      }

      logger.info('[E2ETestEnvironment] Test environment cleanup complete');
    } catch (error) {
      logger.error('[E2ETestEnvironment] Error during cleanup:', error);
    }
  }

  // Getters for test access
  getStorage(): MongoStorage {
    return this.storage;
  }

  getMemoryService(): MemoryService {
    return this.memoryService;
  }

  getMockLLMService(): MockLLMService {
    return this.mockLLMService;
  }

  getTestDataLoader(): TestDataLoader {
    return this.testDataLoader;
  }

  getQualityMonitor(): QualityMonitor {
    return this.qualityMonitor;
  }

  async resetEnvironment(): Promise<void> {
    logger.info('[E2ETestEnvironment] Resetting test environment...');
    
    // Clear all test data
    await this.testDataLoader.clearAllData();
    
    // Reset mock services
    await this.mockLLMService.reset();
    
    // Reset quality metrics
    await this.qualityMonitor.reset();
    
    logger.info('[E2ETestEnvironment] Test environment reset complete');
  }
}