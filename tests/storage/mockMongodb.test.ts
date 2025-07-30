import { MockMongoStorage } from '../../src/storage/mockMongodb';
import { DiagnosticCase, DiagnosticPattern } from '../../src/model';
import { QueryCategory, EntityType, EnvironmentType } from '../../src/model/types/general';

describe('MockMongoStorage', () => {
  let storage: MockMongoStorage;

  beforeEach(() => {
    storage = new MockMongoStorage();
  });

  describe('connection methods', () => {
    it('should connect without error', async () => {
      await expect(storage.connect()).resolves.toBeUndefined();
    });

    it('should disconnect without error', async () => {
      await expect(storage.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('case storage', () => {
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

    it('should store a new case', async () => {
      await storage.storeCase(mockCase);
      
      const results = await storage.findSimilarCases(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].caseId).toBe('test-case-1');
    });

    it('should update existing case', async () => {
      await storage.storeCase(mockCase);
      
      const updatedCase = { ...mockCase, finalSummary: 'Updated summary' };
      await storage.storeCase(updatedCase);
      
      const results = await storage.findSimilarCases(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType
      );
      
      expect(results).toHaveLength(1);
      expect(results[0].finalSummary).toBe('Updated summary');
    });

    it('should find similar cases by criteria', async () => {
      const case1 = { ...mockCase, caseId: 'case-1' };
      const case2 = { ...mockCase, caseId: 'case-2', category: 'DATA_INCONSISTENCY' as QueryCategory };
      const case3 = { ...mockCase, caseId: 'case-3', timestamp: new Date('2024-01-02') };
      
      await storage.storeCase(case1);
      await storage.storeCase(case2);
      await storage.storeCase(case3);
      
      const results = await storage.findSimilarCases(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].caseId).toBe('case-3'); // Most recent first
      expect(results[1].caseId).toBe('case-1');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.storeCase({ ...mockCase, caseId: `case-${i}` });
      }
      
      const results = await storage.findSimilarCases(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType,
        3
      );
      
      expect(results).toHaveLength(3);
    });
  });

  describe('pattern storage', () => {
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

    it('should store a new pattern', async () => {
      await storage.storePattern(mockPattern);
      
      const result = await storage.getPattern(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType
      );
      
      expect(result).not.toBeNull();
      expect(result?.patternId).toBe('pattern-1');
    });

    it('should update existing pattern', async () => {
      await storage.storePattern(mockPattern);
      
      const updatedPattern = { ...mockPattern, successRate: 0.9 };
      await storage.storePattern(updatedPattern);
      
      const result = await storage.getPattern(
        'ENTITY_STATUS' as QueryCategory,
        'offer' as EntityType,
        'production' as EnvironmentType
      );
      
      expect(result?.successRate).toBe(0.9);
    });

    it('should return null for non-existent pattern', async () => {
      const result = await storage.getPattern(
        'DATA_INCONSISTENCY' as QueryCategory,
        'campaign' as EntityType,
        'staging' as EnvironmentType
      );
      
      expect(result).toBeNull();
    });

    it('should get top patterns sorted by success rate', async () => {
      const pattern1 = { ...mockPattern, patternId: 'p1', successRate: 0.5 };
      const pattern2 = { ...mockPattern, patternId: 'p2', successRate: 0.9, category: 'DATA_INCONSISTENCY' as QueryCategory };
      const pattern3 = { ...mockPattern, patternId: 'p3', successRate: 0.7, entityType: 'campaign' as EntityType };
      
      await storage.storePattern(pattern1);
      await storage.storePattern(pattern2);
      await storage.storePattern(pattern3);
      
      const results = await storage.getTopPatterns(2);
      
      expect(results).toHaveLength(2);
      expect(results[0].successRate).toBe(0.9);
      expect(results[1].successRate).toBe(0.7);
    });

    it('should sort by usage count when success rates are equal', async () => {
      const pattern1 = { ...mockPattern, patternId: 'p1', successRate: 0.8, usageCount: 5 };
      const pattern2 = { ...mockPattern, patternId: 'p2', successRate: 0.8, usageCount: 15, category: 'DATA_INCONSISTENCY' as QueryCategory };
      
      await storage.storePattern(pattern1);
      await storage.storePattern(pattern2);
      
      const results = await storage.getTopPatterns();
      
      expect(results[0].usageCount).toBe(15);
      expect(results[1].usageCount).toBe(5);
    });
  });
});