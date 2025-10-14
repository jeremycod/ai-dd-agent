// Mock all problematic imports first
jest.mock('../../src/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../../src/storage/mongodb');
jest.mock('../../src/services', () => ({
  AIServiceFactory: {
    getInstance: jest.fn().mockReturnValue({
      createEmbeddingService: jest.fn().mockReturnValue({
        generateQueryEmbedding: jest.fn()
      })
    })
  },
  ToolEffectivenessAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeToolContribution: jest.fn().mockReturnValue({
      contributionScore: 0.8,
      wasUsefulForDiagnosis: true,
      reasoning: ['Tool provided useful data']
    })
  })),
  DiagnosisRelevanceAnalyzer: jest.fn(),
  ProgressiveToolSelector: jest.fn().mockImplementation(() => ({
    selectToolsForCase: jest.fn().mockReturnValue({
      tier1: ['tool1'],
      tier2: ['tool2'],
      tier3: ['tool3']
    })
  }))
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));

import { MemoryService } from '../../src/storage/memoryService';
import { MongoStorage } from '../../src/storage/mongodb';
import { AgentState, DiagnosticCase } from '../../src/model';
import { QueryCategory, EntityType, EnvironmentType } from '../../src/model/types/general';

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let mockStorage: jest.Mocked<MongoStorage>;
  let mockEmbeddingService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorage = new MongoStorage('test') as jest.Mocked<MongoStorage>;
    mockStorage.storeCase = jest.fn();
    mockStorage.storeCaseWithEmbedding = jest.fn();
    mockStorage.findSimilarCases = jest.fn();
    mockStorage.findSimilarCasesByEmbedding = jest.fn();
    mockStorage.getPattern = jest.fn();
    mockStorage.storePattern = jest.fn();
    mockStorage.updateCaseWithFeedback = jest.fn();

    memoryService = new MemoryService(mockStorage);
    
    // Get the mocked embedding service
    const { AIServiceFactory } = require('../../src/services');
    mockEmbeddingService = AIServiceFactory.getInstance().createEmbeddingService();
  });

  describe('storeCaseFromState', () => {
    const mockState: Partial<AgentState> = {
      userQuery: 'Test query',
      queryCategory: 'ENTITY_STATUS' as QueryCategory,
      entityType: 'offer' as EntityType,
      entityIds: ['offer-123'],
      environment: 'production' as EnvironmentType,
      finalSummary: 'Test summary',
      overallRlReward: 0.8,
      messageFeedbacks: { 
        msg1: { 
          type: 'positive' as const, 
          timestamp: new Date(),
          rating: 5 
        } 
      },
      analysisResults: {
        datadogLogs: 'result1',
        entityHistory: 'result2'
      },
      currentEpisodeActions: [
        { 
          nodeName: 'fetchData', 
          actionDescription: 'Fetching data',
          timestamp: new Date() 
        }
      ]
    };

    it('should store case with embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockEmbeddingService.generateQueryEmbedding.mockResolvedValue(mockEmbedding);
      mockStorage.storeCaseWithEmbedding.mockResolvedValue(undefined);
      mockStorage.getPattern.mockResolvedValue(null);
      mockStorage.storePattern.mockResolvedValue(undefined);

      await memoryService.storeCaseFromState(mockState as AgentState);

      expect(mockEmbeddingService.generateQueryEmbedding).toHaveBeenCalledWith('Test query');
      expect(mockStorage.storeCaseWithEmbedding).toHaveBeenCalled();
      expect(mockStorage.storePattern).toHaveBeenCalled();
    });

    it('should skip storage if missing required fields', async () => {
      const incompleteState = { userQuery: 'Test' } as AgentState;

      await memoryService.storeCaseFromState(incompleteState);

      expect(mockStorage.storeCase).not.toHaveBeenCalled();
      expect(mockStorage.storeCaseWithEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('retrieveSimilarCases', () => {
    const mockState: Partial<AgentState> = {
      userQuery: 'Test query',
      queryCategory: 'ENTITY_STATUS' as QueryCategory,
      entityType: 'offer' as EntityType,
      environment: 'production' as EnvironmentType
    };

    it('should use vector search when available', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockCases = [{ 
        caseId: 'case1',
        timestamp: new Date(),
        category: 'ENTITY_STATUS' as QueryCategory,
        entityType: 'offer' as EntityType,
        entityIds: ['offer-1'],
        environment: 'production' as EnvironmentType,
        userQuery: 'Test',
        toolsUsed: ['tool1'],
        messageFeedbacks: {}
      }] as DiagnosticCase[];
      
      mockEmbeddingService.generateQueryEmbedding.mockResolvedValue(mockEmbedding);
      mockStorage.findSimilarCasesByEmbedding.mockResolvedValue(mockCases);

      const results = await memoryService.retrieveSimilarCases(mockState as AgentState);

      expect(results).toEqual(mockCases);
    });

    it('should return empty array for incomplete state', async () => {
      const incompleteState = { userQuery: 'Test' } as AgentState;

      const results = await memoryService.retrieveSimilarCases(incompleteState);

      expect(results).toEqual([]);
    });
  });

  describe('updateCaseWithFeedback', () => {
    it('should update case with feedback', async () => {
      const feedbacks = { 
        msg1: { 
          type: 'positive' as const, 
          timestamp: new Date(),
          rating: 5 
        } 
      };
      mockStorage.updateCaseWithFeedback.mockResolvedValue({ acknowledged: true });

      await memoryService.updateCaseWithFeedback('case-123', feedbacks, 0.9);

      expect(mockStorage.updateCaseWithFeedback).toHaveBeenCalledWith('case-123', feedbacks, 0.9);
    });
  });
});