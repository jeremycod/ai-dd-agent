// Mock all problematic imports before any other imports
jest.mock('../../src/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('mongodb', () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn().mockReturnValue({
      collection: jest.fn().mockReturnValue({
        createIndex: jest.fn(),
        replaceOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn()
            })
          })
        }),
        findOne: jest.fn(),
        updateOne: jest.fn(),
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn()
        })
      })
    })
  }))
}));

import { MongoStorage } from '../../src/storage/mongodb';
import { DiagnosticCase, DiagnosticPattern } from '../../src/model';
import { QueryCategory, EntityType, EnvironmentType } from '../../src/model/types/general';

describe('MongoStorage', () => {
  let storage: MongoStorage;
  let mockClient: any;
  let mockDb: any;
  let mockCasesCollection: any;
  let mockPatternsCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { MongoClient } = require('mongodb');
    
    // Create fresh mocks for each test
    mockCasesCollection = {
      createIndex: jest.fn().mockResolvedValue(undefined),
      replaceOne: jest.fn().mockResolvedValue({ acknowledged: true, upsertedCount: 1, modifiedCount: 0 }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
          })
        })
      }),
      findOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1, matchedCount: 1 }),
      aggregate: jest.fn().mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      })
    };
    
    mockPatternsCollection = {
      createIndex: jest.fn().mockResolvedValue(undefined),
      replaceOne: jest.fn().mockResolvedValue({ acknowledged: true, upsertedCount: 1, modifiedCount: 0 }),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
          })
        })
      }),
      findOne: jest.fn().mockResolvedValue(null)
    };
    
    mockDb = {
      collection: jest.fn().mockImplementation((name: string) => {
        if (name === 'diagnostic_cases') return mockCasesCollection;
        if (name === 'diagnostic_patterns') return mockPatternsCollection;
        return mockCasesCollection;
      })
    };
    
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      db: jest.fn().mockReturnValue(mockDb)
    };
    
    // Mock the MongoClient constructor to return our mock
    MongoClient.mockImplementation(() => mockClient);
    
    storage = new MongoStorage('mongodb://test');
  });

  describe('connection management', () => {
    it('should connect and create indexes', async () => {
      mockClient.connect.mockResolvedValue(undefined);
      mockCasesCollection.createIndex.mockResolvedValue(undefined);
      mockPatternsCollection.createIndex.mockResolvedValue(undefined);

      await storage.connect();

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockCasesCollection.createIndex).toHaveBeenCalledTimes(3);
      expect(mockPatternsCollection.createIndex).toHaveBeenCalledTimes(2);
    });

    it('should disconnect', async () => {
      mockClient.close.mockResolvedValue(undefined);

      await storage.disconnect();

      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe('case operations', () => {
    const mockCase: DiagnosticCase = {
      caseId: 'test-case-1',
      timestamp: new Date('2024-01-01'),
      category: 'ENTITY_STATUS' as QueryCategory,
      entityType: 'offer' as EntityType,
      entityIds: ['offer-123'],
      environment: 'production' as EnvironmentType,
      userQuery: 'Test query',
      toolsUsed: ['tool1', 'tool2'],
      finalSummary: 'Test summary',
      overallRlReward: 0.8,
      messageFeedbacks: {}
    };

    it('should store case', async () => {
      const mockResult = { acknowledged: true, upsertedCount: 1, modifiedCount: 0 };
      mockCasesCollection.replaceOne.mockResolvedValue(mockResult);

      await storage.storeCase(mockCase);

      expect(mockCasesCollection.replaceOne).toHaveBeenCalledWith(
        { caseId: 'test-case-1' },
        mockCase,
        { upsert: true }
      );
    });

    it('should find similar cases', async () => {
      const mockResults = [mockCase];
      mockCasesCollection.find().sort().limit().toArray.mockResolvedValue(mockResults);

      const results = await storage.findSimilarCases(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType,
        5
      );

      expect(mockCasesCollection.find).toHaveBeenCalledWith({
        category: 'ENTITY_STATUS',
        entityType: 'offer',
        environment: 'production'
      });
      expect(results).toEqual(mockResults);
    });

    it('should update case with feedback', async () => {
      const mockResult = { acknowledged: true, modifiedCount: 1, matchedCount: 1 };
      const feedbacks = { message1: { type: 'positive' as const, timestamp: new Date() } };
      
      mockCasesCollection.findOne
        .mockResolvedValueOnce(mockCase)
        .mockResolvedValueOnce({ ...mockCase, messageFeedbacks: feedbacks });
      mockCasesCollection.updateOne.mockResolvedValue(mockResult);

      const result = await storage.updateCaseWithFeedback('test-case-1', feedbacks, 0.9);

      expect(mockCasesCollection.updateOne).toHaveBeenCalledWith(
        { caseId: 'test-case-1' },
        { $set: { 'messageFeedbacks.message1': feedbacks.message1, overallRlReward: 0.9 } }
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('pattern operations', () => {
    const mockPattern: DiagnosticPattern = {
      patternId: 'pattern-1',
      category: 'ENTITY_STATUS' as QueryCategory,
      entityType: 'offer' as EntityType,
      environment: 'production' as EnvironmentType,
      commonTools: ['tool1', 'tool2'],
      successRate: 0.8,
      usageCount: 10,
      lastUpdated: new Date('2024-01-01')
    };

    it('should store pattern', async () => {
      const mockResult = { acknowledged: true, upsertedCount: 1, modifiedCount: 0 };
      mockPatternsCollection.replaceOne.mockResolvedValue(mockResult);

      await storage.storePattern(mockPattern);

      expect(mockPatternsCollection.replaceOne).toHaveBeenCalledWith(
        { 
          category: mockPattern.category, 
          entityType: mockPattern.entityType, 
          environment: mockPattern.environment 
        },
        mockPattern,
        { upsert: true }
      );
    });

    it('should get pattern', async () => {
      mockPatternsCollection.findOne.mockResolvedValue(mockPattern);

      const result = await storage.getPattern(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType
      );

      expect(mockPatternsCollection.findOne).toHaveBeenCalledWith({
        category: 'ENTITY_STATUS',
        entityType: 'offer',
        environment: 'production'
      });
      expect(result).toEqual(mockPattern);
    });
  });
});