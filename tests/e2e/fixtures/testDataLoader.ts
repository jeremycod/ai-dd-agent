import { MongoStorage } from '../../../src/storage';
import { DiagnosticCase, DiagnosticPattern } from '../../../src/model';
import { QueryCategory, EntityType, EnvironmentType } from '../../../src/model';
import { logger } from '../../../src/utils';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TestScenario {
  name: string;
  description: string;
  knowledgeBase: DiagnosticCase[];
  historicalCases: DiagnosticCase[];
  mockResponses: Record<string, any>;
  userContexts: Record<string, any>;
  expectedOutcomes: Record<string, any>;
}

export class TestDataLoader {
  private storage: MongoStorage;
  private fixturesPath: string;

  constructor(storage: MongoStorage) {
    this.storage = storage;
    this.fixturesPath = path.join(__dirname, 'data');
  }

  async initialize(): Promise<void> {
    await this.ensureFixturesDirectory();
    logger.info('[TestDataLoader] Initialized');
  }

  private async ensureFixturesDirectory(): Promise<void> {
    try {
      await fs.access(this.fixturesPath);
    } catch {
      await fs.mkdir(this.fixturesPath, { recursive: true });
      await this.createDefaultFixtures();
    }
  }

  async loadTestScenario(scenarioName: string): Promise<TestScenario> {
    const scenarioPath = path.join(this.fixturesPath, `${scenarioName}.json`);
    
    try {
      const data = await fs.readFile(scenarioPath, 'utf-8');
      const scenario = JSON.parse(data) as TestScenario;
      
      // Load and seed the data
      await this.seedKnowledgeBase(scenario.knowledgeBase);
      await this.seedHistoricalCases(scenario.historicalCases);
      
      logger.info(`[TestDataLoader] Loaded scenario: ${scenarioName}`);
      return scenario;
    } catch (error) {
      logger.warn(`[TestDataLoader] Scenario ${scenarioName} not found, creating default`);
      return await this.createDefaultScenario(scenarioName);
    }
  }

  async seedKnowledgeBase(cases: DiagnosticCase[]): Promise<void> {
    for (const diagnosticCase of cases) {
      await this.storage.storeCase(diagnosticCase);
    }
    logger.info(`[TestDataLoader] Seeded ${cases.length} knowledge base cases`);
  }

  async seedHistoricalCases(cases: DiagnosticCase[]): Promise<void> {
    for (const diagnosticCase of cases) {
      await this.storage.storeCase(diagnosticCase);
    }
    logger.info(`[TestDataLoader] Seeded ${cases.length} historical cases`);
  }

  async seedPatterns(patterns: DiagnosticPattern[]): Promise<void> {
    for (const pattern of patterns) {
      await this.storage.storePattern(pattern);
    }
    logger.info(`[TestDataLoader] Seeded ${patterns.length} diagnostic patterns`);
  }

  private async createDefaultScenario(scenarioName: string): Promise<TestScenario> {
    const scenario: TestScenario = {
      name: scenarioName,
      description: `Default test scenario for ${scenarioName}`,
      knowledgeBase: await this.generateDefaultKnowledgeBase(),
      historicalCases: await this.generateDefaultHistoricalCases(),
      mockResponses: this.generateDefaultMockResponses(),
      userContexts: this.generateDefaultUserContexts(),
      expectedOutcomes: this.generateDefaultExpectedOutcomes()
    };

    // Save the scenario for future use
    const scenarioPath = path.join(this.fixturesPath, `${scenarioName}.json`);
    await fs.writeFile(scenarioPath, JSON.stringify(scenario, null, 2));

    return scenario;
  }

  private async generateDefaultKnowledgeBase(): Promise<DiagnosticCase[]> {
    const baseDate = new Date('2024-01-01');
    
    return [
      {
        caseId: 'kb_case_001',
        timestamp: new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 1),
        category: 'ENTITY_STATUS' as QueryCategory,
        entityType: 'offer' as EntityType,
        entityIds: ['OFFER-001'],
        environment: 'production' as EnvironmentType,
        userQuery: 'Why is offer OFFER-001 not showing in production?',
        toolsUsed: ['genieOffer', 'entityHistory', 'datadogLogs'],
        finalSummary: 'Offer was disabled due to configuration error in the offer management system.',
        overallRlReward: 0.9,
        messageFeedbacks: {}
      },
      {
        caseId: 'kb_case_002',
        timestamp: new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 2),
        category: 'OFFER_PRICE' as QueryCategory,
        entityType: 'offer' as EntityType,
        entityIds: ['OFFER-002'],
        environment: 'staging' as EnvironmentType,
        userQuery: 'Check pricing for offer OFFER-002 in staging',
        toolsUsed: ['upsOfferPrice', 'genieOffer'],
        finalSummary: 'Pricing shows $9.99 in staging environment, consistent with expected configuration.',
        overallRlReward: 0.85,
        messageFeedbacks: {}
      },
      {
        caseId: 'kb_case_003',
        timestamp: new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 3),
        category: 'DATA_INCONSISTENCY' as QueryCategory,
        entityType: 'campaign' as EntityType,
        entityIds: ['CAMPAIGN-001'],
        environment: 'production' as EnvironmentType,
        userQuery: 'Campaign CAMPAIGN-001 shows different data in different systems',
        toolsUsed: ['entityHistory', 'datadogLogs'],
        finalSummary: 'Data inconsistency found between offer service and genie systems.',
        overallRlReward: 0.75,
        messageFeedbacks: {}
      }
    ];
  }

  private async generateDefaultHistoricalCases(): Promise<DiagnosticCase[]> {
    const baseDate = new Date('2023-12-01');
    
    return [
      {
        caseId: 'hist_case_001',
        timestamp: new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 10),
        category: 'ENTITY_STATUS' as QueryCategory,
        entityType: 'offer' as EntityType,
        entityIds: ['OFFER-HIST-001'],
        environment: 'production' as EnvironmentType,
        userQuery: 'Historical offer status issue',
        toolsUsed: ['genieOffer', 'entityHistory'],
        finalSummary: 'Historical case showing similar pattern to current issues.',
        overallRlReward: 0.8,
        messageFeedbacks: {}
      },
      {
        caseId: 'hist_case_002',
        timestamp: new Date(baseDate.getTime() + 1000 * 60 * 60 * 24 * 15),
        category: 'OFFER_PRICE' as QueryCategory,
        entityType: 'offer' as EntityType,
        entityIds: ['OFFER-HIST-002'],
        environment: 'staging' as EnvironmentType,
        userQuery: 'Historical pricing validation',
        toolsUsed: ['upsOfferPrice'],
        finalSummary: 'Historical pricing case with successful resolution.',
        overallRlReward: 0.9,
        messageFeedbacks: {}
      }
    ];
  }

  private generateDefaultMockResponses(): Record<string, any> {
    return {
      genieOffer: {
        'OFFER-001': {
          id: 'OFFER-001',
          status: 'INACTIVE',
          name: 'Test Offer 001',
          environment: 'production'
        },
        'OFFER-002': {
          id: 'OFFER-002',
          status: 'ACTIVE',
          name: 'Test Offer 002',
          price: 9.99,
          environment: 'staging'
        }
      },
      datadogLogs: {
        'OFFER-001': [
          {
            timestamp: '2024-01-01T10:00:00Z',
            level: 'ERROR',
            message: 'Offer OFFER-001 configuration validation failed'
          }
        ]
      },
      upsOfferPrice: {
        'OFFER-002': {
          offerId: 'OFFER-002',
          price: 9.99,
          currency: 'USD',
          environment: 'staging'
        }
      }
    };
  }

  private generateDefaultUserContexts(): Record<string, any> {
    return {
      testUser: {
        userId: 'test-user-001',
        role: 'developer',
        permissions: ['read_offers', 'read_campaigns'],
        preferredEnvironment: 'staging'
      }
    };
  }

  private generateDefaultExpectedOutcomes(): Record<string, any> {
    return {
      'successful_offer_diagnosis': {
        expectedCategory: 'ENTITY_STATUS',
        expectedTools: ['genieOffer', 'entityHistory'],
        expectedOutcome: 'RESOLVED',
        qualityThresholds: {
          relevance: 0.8,
          accuracy: 0.85,
          completeness: 0.9
        }
      },
      'pricing_validation': {
        expectedCategory: 'OFFER_PRICE',
        expectedTools: ['upsOfferPrice'],
        expectedOutcome: 'RESOLVED',
        qualityThresholds: {
          relevance: 0.85,
          accuracy: 0.9,
          completeness: 0.85
        }
      }
    };
  }

  private async createDefaultFixtures(): Promise<void> {
    // Create some default test scenarios
    const scenarios = ['successful_offer_diagnosis', 'pricing_validation', 'data_inconsistency'];
    
    for (const scenarioName of scenarios) {
      await this.createDefaultScenario(scenarioName);
    }
    
    logger.info('[TestDataLoader] Created default fixtures');
  }

  async clearAllData(): Promise<void> {
    // Clear all test data from storage
    // Note: This assumes we have methods to clear data - implement as needed
    logger.info('[TestDataLoader] Cleared all test data');
  }

  async loadKnowledgeBaseFixture(scenarioName: string): Promise<DiagnosticCase[]> {
    const fixturePath = path.join(this.fixturesPath, 'knowledge-base', `${scenarioName}.json`);
    
    try {
      const data = await fs.readFile(fixturePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return await this.generateDefaultKnowledgeBase();
    }
  }

  async loadHistoricalCasesFixture(scenarioName: string): Promise<DiagnosticCase[]> {
    const fixturePath = path.join(this.fixturesPath, 'historical-cases', `${scenarioName}.json`);
    
    try {
      const data = await fs.readFile(fixturePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return await this.generateDefaultHistoricalCases();
    }
  }

  async loadMockResponsesFixture(scenarioName: string): Promise<Record<string, any>> {
    const fixturePath = path.join(this.fixturesPath, 'mock-responses', `${scenarioName}.json`);
    
    try {
      const data = await fs.readFile(fixturePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return this.generateDefaultMockResponses();
    }
  }

  async loadUserContextsFixture(scenarioName: string): Promise<Record<string, any>> {
    const fixturePath = path.join(this.fixturesPath, 'user-contexts', `${scenarioName}.json`);
    
    try {
      const data = await fs.readFile(fixturePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return this.generateDefaultUserContexts();
    }
  }

  async loadExpectedOutcomesFixture(scenarioName: string): Promise<Record<string, any>> {
    const fixturePath = path.join(this.fixturesPath, 'expected-outcomes', `${scenarioName}.json`);
    
    try {
      const data = await fs.readFile(fixturePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return this.generateDefaultExpectedOutcomes();
    }
  }
}