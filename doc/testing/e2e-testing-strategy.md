# End-to-End Testing Strategy for AI Agentic RAG Systems

## Table of Contents
1. [Overview](#overview)
2. [Testing Architecture](#testing-architecture)
3. [Test Categories](#test-categories)
4. [Implementation Guide](#implementation-guide)
5. [Quality Metrics](#quality-metrics)
6. [Best Practices](#best-practices)
7. [Tools and Infrastructure](#tools-and-infrastructure)

## Overview

End-to-end testing for AI Agentic RAG (Retrieval-Augmented Generation) systems requires a comprehensive approach that validates the entire workflow from user input to final response, including retrieval quality, LLM reasoning, and system reliability.

### Key Challenges
- **Non-deterministic AI responses** require probabilistic testing approaches
- **Complex multi-step workflows** need scenario-based validation
- **RAG quality** depends on retrieval relevance and generation accuracy
- **Performance at scale** with concurrent users and large knowledge bases
- **Context preservation** across multi-turn conversations

## Testing Architecture

### Test Environment Setup

```typescript
// tests/e2e/setup/testEnvironment.ts
export class E2ETestEnvironment {
  private testDb: MongoMemoryServer;
  private mockLLMService: MockLLMService;
  private testDataLoader: TestDataLoader;
  private qualityMonitor: QualityMonitor;

  async setup() {
    // Isolated test database
    this.testDb = await MongoMemoryServer.create();
    
    // Deterministic LLM responses for consistent testing
    this.mockLLMService = new MockLLMService({
      responseVariability: 0.1, // 10% response variation
      latencySimulation: true,
      errorInjection: true
    });
    
    // Curated test datasets
    await this.testDataLoader.loadTestCases();
    await this.testDataLoader.loadKnowledgeBase();
    
    // Quality monitoring
    this.qualityMonitor = new QualityMonitor();
  }

  async teardown() {
    await this.testDb.stop();
    await this.mockLLMService.cleanup();
    await this.qualityMonitor.generateReport();
  }
}
```

### Test Data Management

```typescript
// tests/e2e/fixtures/testDataManager.ts
export class TestDataManager {
  private scenarios: Map<string, TestScenario> = new Map();

  async setupTestScenario(scenarioName: string): Promise<TestScenario> {
    const scenario = await this.loadScenario(scenarioName);
    
    // Setup knowledge base with versioned data
    await this.seedKnowledgeBase(scenario.knowledgeBase);
    
    // Create historical cases for RAG testing
    await this.seedHistoricalCases(scenario.historicalCases);
    
    // Configure mock API responses
    await this.setupMockResponses(scenario.mockResponses);
    
    // Setup user personas and contexts
    await this.setupUserContexts(scenario.userContexts);
    
    return scenario;
  }

  async loadScenario(name: string): Promise<TestScenario> {
    return {
      name,
      description: `E2E test scenario for ${name}`,
      knowledgeBase: await this.loadKnowledgeBaseFixture(name),
      historicalCases: await this.loadHistoricalCasesFixture(name),
      mockResponses: await this.loadMockResponsesFixture(name),
      userContexts: await this.loadUserContextsFixture(name),
      expectedOutcomes: await this.loadExpectedOutcomesFixture(name)
    };
  }
}
```

## Test Categories

### 1. Workflow Integration Tests

Test complete user journeys from query to resolution.

```typescript
// tests/e2e/workflows/diagnosticWorkflow.test.ts
describe('Diagnostic Workflow E2E', () => {
  const testScenarios = [
    {
      name: 'successful_offer_diagnosis',
      userQuery: 'Why is offer ABC-123 not showing in production?',
      expectedFlow: ['parse_query', 'memory_retrieval', 'fetch_data', 'analyze', 'respond'],
      expectedTools: ['datadogLogs', 'genieOffer', 'entityHistory'],
      expectedCategory: 'ENTITY_STATUS',
      expectedOutcome: 'RESOLVED',
      qualityThresholds: {
        relevance: 0.8,
        completeness: 0.9,
        accuracy: 0.85
      }
    },
    {
      name: 'ambiguous_query_clarification',
      userQuery: 'Something is broken with offers',
      expectedFlow: ['parse_query', 'ask_clarification'],
      expectedOutcome: 'NEEDS_CLARIFICATION',
      expectedClarificationQuestions: [
        'Which specific offer?',
        'In which environment?',
        'What specific issue are you seeing?'
      ]
    },
    {
      name: 'multi_entity_complex_diagnosis',
      userQuery: 'Compare offers ABC-123 and XYZ-789 pricing in staging vs production',
      expectedFlow: ['parse_query', 'memory_retrieval', 'fetch_parallel_data', 'compare_analysis', 'respond'],
      expectedTools: ['upsOfferPrice', 'genieOffer', 'offerComparison'],
      expectedEntities: ['ABC-123', 'XYZ-789'],
      expectedEnvironments: ['staging', 'production']
    }
  ];

  testScenarios.forEach(scenario => {
    it(`should handle ${scenario.name}`, async () => {
      // Setup test environment
      const testEnv = await testDataManager.setupTestScenario(scenario.name);
      
      try {
        // Execute complete workflow
        const result = await agent.processQuery({
          query: scenario.userQuery,
          userId: 'test-user',
          sessionId: `test-session-${scenario.name}`
        });

        // Verify workflow execution path
        expect(result.executionPath).toEqual(scenario.expectedFlow);
        
        // Verify tools were used correctly
        if (scenario.expectedTools) {
          expect(result.toolsUsed).toEqual(expect.arrayContaining(scenario.expectedTools));
        }
        
        // Verify categorization
        if (scenario.expectedCategory) {
          expect(result.queryCategory).toBe(scenario.expectedCategory);
        }
        
        // Verify outcome
        expect(result.outcome).toBe(scenario.expectedOutcome);
        
        // Verify response quality
        if (scenario.qualityThresholds) {
          const quality = await qualityAnalyzer.analyzeResponse(result.response, testEnv.groundTruth);
          expect(quality.relevance).toBeGreaterThan(scenario.qualityThresholds.relevance);
          expect(quality.completeness).toBeGreaterThan(scenario.qualityThresholds.completeness);
          expect(quality.accuracy).toBeGreaterThan(scenario.qualityThresholds.accuracy);
        }
        
        // Verify memory storage
        const storedCase = await memoryService.getCase(result.caseId);
        expect(storedCase).toBeDefined();
        expect(storedCase.category).toBe(scenario.expectedCategory);
        
        // Verify learning occurred
        const patterns = await memoryService.getRelevantPatterns({
          queryCategory: scenario.expectedCategory,
          entityType: result.entityType,
          environment: result.environment
        });
        expect(patterns.length).toBeGreaterThan(0);
        
      } finally {
        await testDataManager.cleanupTestScenario();
      }
    });
  });
});
```

### 2. RAG Quality Tests

Validate retrieval relevance and generation quality.

```typescript
// tests/e2e/rag/retrievalQuality.test.ts
describe('RAG Retrieval Quality', () => {
  const retrievalTestCases = [
    {
      query: 'offer pricing issues in staging environment',
      expectedRetrievals: [
        { caseId: 'case_pricing_001', minSimilarity: 0.8 },
        { caseId: 'case_staging_002', minSimilarity: 0.7 }
      ],
      unexpectedRetrievals: ['case_campaign_001', 'case_production_003'],
      maxRetrievals: 5,
      diversityThreshold: 0.3 // Ensure diverse results
    },
    {
      query: 'entity configuration problems',
      expectedCategories: ['ENTITY_CONFIGURATION', 'ENTITY_STATUS'],
      minRelevantRetrievals: 3,
      semanticSimilarityThreshold: 0.75
    }
  ];

  retrievalTestCases.forEach(testCase => {
    it(`should retrieve relevant cases for: ${testCase.query}`, async () => {
      // Setup knowledge base
      await setupKnowledgeBase(testCase.knowledgeBase);
      
      // Execute retrieval
      const results = await memoryService.retrieveSimilarCases({
        userQuery: testCase.query,
        queryCategory: testCase.expectedCategories?.[0]
      });

      // Verify retrieval count
      expect(results.length).toBeLessThanOrEqual(testCase.maxRetrievals);
      expect(results.length).toBeGreaterThan(0);
      
      // Verify similarity scores
      results.forEach(result => {
        expect(result.similarityScore).toBeGreaterThan(testCase.semanticSimilarityThreshold || 0.7);
      });
      
      // Verify expected retrievals
      if (testCase.expectedRetrievals) {
        testCase.expectedRetrievals.forEach(expected => {
          const found = results.find(r => r.caseId === expected.caseId);
          expect(found).toBeDefined();
          expect(found.similarityScore).toBeGreaterThan(expected.minSimilarity);
        });
      }
      
      // Verify no unexpected retrievals
      if (testCase.unexpectedRetrievals) {
        const retrievedIds = results.map(r => r.caseId);
        testCase.unexpectedRetrievals.forEach(unexpected => {
          expect(retrievedIds).not.toContain(unexpected);
        });
      }
      
      // Verify diversity (avoid too similar results)
      if (testCase.diversityThreshold) {
        const diversity = calculateResultDiversity(results);
        expect(diversity).toBeGreaterThan(testCase.diversityThreshold);
      }
    });
  });

  it('should handle edge cases in retrieval', async () => {
    const edgeCases = [
      { query: '', expectedResults: 0 },
      { query: 'nonexistent entity XYZ999', expectedResults: 0 },
      { query: 'a'.repeat(1000), expectedResults: 0 }, // Very long query
      { query: '!@#$%^&*()', expectedResults: 0 } // Special characters
    ];

    for (const edgeCase of edgeCases) {
      const results = await memoryService.retrieveSimilarCases({
        userQuery: edgeCase.query
      });
      expect(results.length).toBe(edgeCase.expectedResults);
    }
  });
});
```

### 3. LLM Response Quality Tests

Evaluate AI-generated responses for quality and accuracy.

```typescript
// tests/e2e/llm/responseQuality.test.ts
describe('LLM Response Quality', () => {
  const qualityMetrics = {
    relevance: (response: string, context: any) => {
      // Measure how well response addresses the query
      return calculateSemanticSimilarity(response, context.query);
    },
    
    completeness: (response: string, requiredElements: string[]) => {
      // Check if response covers all required elements
      const coverage = requiredElements.filter(element => 
        response.toLowerCase().includes(element.toLowerCase())
      );
      return coverage.length / requiredElements.length;
    },
    
    accuracy: (response: string, groundTruth: any) => {
      // Verify factual accuracy against known data
      return verifyFactualClaims(response, groundTruth);
    },
    
    hallucination: (response: string, sourceData: any) => {
      // Detect information not present in source data
      return detectUnsupportedClaims(response, sourceData);
    },
    
    coherence: (response: string) => {
      // Measure logical flow and readability
      return analyzeTextCoherence(response);
    }
  };

  it('should generate high-quality responses across scenarios', async () => {
    const qualityTestCases = await loadResponseQualityTestCases();
    const results = [];
    
    for (const testCase of qualityTestCases) {
      // Execute query with full context
      const response = await agent.processQuery(testCase.query, {
        context: testCase.context,
        retrievedCases: testCase.retrievedCases,
        sourceData: testCase.sourceData
      });
      
      // Measure all quality dimensions
      const quality = {
        relevance: qualityMetrics.relevance(response.text, testCase),
        completeness: qualityMetrics.completeness(response.text, testCase.requiredElements),
        accuracy: qualityMetrics.accuracy(response.text, testCase.groundTruth),
        hallucination: qualityMetrics.hallucination(response.text, testCase.sourceData),
        coherence: qualityMetrics.coherence(response.text)
      };
      
      results.push({ testCase: testCase.name, quality });
      
      // Assert individual quality thresholds
      expect(quality.relevance).toBeGreaterThan(0.8);
      expect(quality.completeness).toBeGreaterThan(0.9);
      expect(quality.accuracy).toBeGreaterThan(0.85);
      expect(quality.hallucination).toBeLessThan(0.1);
      expect(quality.coherence).toBeGreaterThan(0.8);
    }
    
    // Assert aggregate quality metrics
    const avgQuality = calculateAverageQuality(results);
    expect(avgQuality.overall).toBeGreaterThan(0.85);
    
    // Generate quality report
    await generateQualityReport(results);
  });

  it('should maintain quality under different conditions', async () => {
    const conditions = [
      { name: 'high_load', concurrentRequests: 10 },
      { name: 'limited_context', maxContextLength: 1000 },
      { name: 'noisy_data', dataQuality: 0.7 },
      { name: 'edge_cases', includeEdgeCases: true }
    ];

    for (const condition of conditions) {
      const testResults = await runQualityTestsUnderCondition(condition);
      
      // Quality should degrade gracefully, not catastrophically
      expect(testResults.avgQuality).toBeGreaterThan(0.7);
      expect(testResults.successRate).toBeGreaterThan(0.9);
    }
  });
});
```

### 4. Multi-Turn Conversation Tests

Validate context preservation and conversation flow.

```typescript
// tests/e2e/conversation/multiTurn.test.ts
describe('Multi-Turn Conversations', () => {
  it('should maintain context across conversation turns', async () => {
    const conversation = new ConversationSession({
      userId: 'test-user',
      sessionId: 'multi-turn-test'
    });
    
    try {
      // Turn 1: Initial ambiguous query
      const turn1 = await conversation.sendMessage('Check offer status');
      expect(turn1.requiresClarification).toBe(true);
      expect(turn1.clarificationQuestions).toContain('Which offer?');
      
      // Turn 2: Provide entity ID
      const turn2 = await conversation.sendMessage('Offer ABC-123');
      expect(turn2.requiresClarification).toBe(true);
      expect(turn2.clarificationQuestions).toContain('In which environment?');
      expect(turn2.context.entityIds).toContain('ABC-123');
      
      // Turn 3: Provide environment
      const turn3 = await conversation.sendMessage('Production environment');
      expect(turn3.requiresClarification).toBe(false);
      expect(turn3.toolsUsed).toContain('genieOffer');
      expect(turn3.context.entityIds).toContain('ABC-123');
      expect(turn3.context.environment).toBe('production');
      
      // Turn 4: Follow-up question with context
      const turn4 = await conversation.sendMessage('What about in staging?');
      expect(turn4.context.entityIds).toContain('ABC-123'); // Context maintained
      expect(turn4.context.environment).toBe('staging'); // Environment updated
      expect(turn4.toolsUsed).toContain('genieOffer');
      
      // Turn 5: Related entity question
      const turn5 = await conversation.sendMessage('Compare with offer XYZ-789');
      expect(turn5.context.entityIds).toContain('ABC-123');
      expect(turn5.context.entityIds).toContain('XYZ-789');
      expect(turn5.toolsUsed).toContain('offerComparison');
      
      // Verify conversation memory
      const history = await conversation.getHistory();
      expect(history.turns).toHaveLength(5);
      expect(history.contextEvolution).toBeDefined();
      
      // Verify learning from conversation
      const conversationCase = await conversation.getStoredCase();
      expect(conversationCase.toolsUsed).toEqual(
        expect.arrayContaining(['genieOffer', 'offerComparison'])
      );
      
    } finally {
      await conversation.cleanup();
    }
  });

  it('should handle context switching gracefully', async () => {
    const conversation = new ConversationSession();
    
    // Start with offer topic
    await conversation.sendMessage('Check offer ABC-123 in production');
    
    // Switch to campaign topic
    const switchResponse = await conversation.sendMessage('Now check campaign DEF-456 status');
    expect(switchResponse.context.entityType).toBe('campaign');
    expect(switchResponse.context.entityIds).toContain('DEF-456');
    
    // Verify context switch was clean
    expect(switchResponse.context.entityIds).not.toContain('ABC-123');
  });
});
```

### 5. Performance and Scalability Tests

Validate system behavior under load and stress conditions.

```typescript
// tests/e2e/performance/scalability.test.ts
describe('Performance & Scalability', () => {
  it('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 20;
    const testQueries = generateDiverseTestQueries(concurrentRequests);
    
    const startTime = Date.now();
    const results = await Promise.allSettled(
      testQueries.map(query => agent.processQuery(query))
    );
    const endTime = Date.now();
    
    // Verify all requests completed
    const successfulResults = results.filter(r => r.status === 'fulfilled');
    expect(successfulResults.length).toBe(concurrentRequests);
    
    // Verify performance metrics
    const totalTime = endTime - startTime;
    const avgResponseTime = totalTime / concurrentRequests;
    expect(avgResponseTime).toBeLessThan(5000); // 5 seconds max average
    
    // Verify no memory leaks
    const memoryUsage = process.memoryUsage();
    expect(memoryUsage.heapUsed).toBeLessThan(1024 * 1024 * 1024); // 1GB max
    
    // Verify response quality wasn't degraded
    const qualityScores = await Promise.all(
      successfulResults.map(r => analyzeResponseQuality(r.value))
    );
    const avgQuality = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
    expect(avgQuality).toBeGreaterThan(0.8);
  });

  it('should scale with knowledge base size', async () => {
    const knowledgeBaseSizes = [100, 1000, 10000, 50000];
    const testQuery = 'Find similar cases about offer pricing issues';
    
    for (const size of knowledgeBaseSizes) {
      await setupKnowledgeBase(size);
      
      const startTime = Date.now();
      const results = await memoryService.retrieveSimilarCases({
        userQuery: testQuery,
        queryCategory: 'OFFER_PRICE'
      });
      const responseTime = Date.now() - startTime;
      
      // Response time should scale sub-linearly
      const expectedMaxTime = Math.log(size) * 100; // Logarithmic scaling
      expect(responseTime).toBeLessThan(expectedMaxTime);
      
      // Quality should remain consistent
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarityScore).toBeGreaterThan(0.7);
    }
  });
});
```

### 6. Error Handling and Recovery Tests

Validate system resilience and graceful degradation.

```typescript
// tests/e2e/resilience/errorHandling.test.ts
describe('Error Handling & Recovery', () => {
  const errorScenarios = [
    {
      name: 'llm_service_timeout',
      error: new TimeoutError('LLM service timeout'),
      expectedRecovery: 'retry_with_fallback',
      maxRetries: 3
    },
    {
      name: 'database_connection_lost',
      error: new ConnectionError('Database unavailable'),
      expectedRecovery: 'use_cache',
      fallbackBehavior: 'limited_functionality'
    },
    {
      name: 'invalid_llm_response',
      error: new ValidationError('Invalid response format'),
      expectedRecovery: 'regenerate_response',
      maxAttempts: 2
    },
    {
      name: 'rate_limit_exceeded',
      error: new RateLimitError('API rate limit exceeded'),
      expectedRecovery: 'exponential_backoff',
      backoffMultiplier: 2
    }
  ];

  errorScenarios.forEach(scenario => {
    it(`should handle ${scenario.name} gracefully`, async () => {
      // Setup error injection
      const errorInjector = new ErrorInjector();
      errorInjector.injectError(scenario.error);
      
      try {
        // Execute query that will trigger error
        const result = await agent.processQuery('test query for error handling');
        
        // Verify graceful handling
        expect(result.status).not.toBe('FAILED');
        expect(result.recoveryAction).toBe(scenario.expectedRecovery);
        expect(result.userMessage).toContain('temporary issue');
        expect(result.userMessage).not.toContain('error'); // User-friendly message
        
        // Verify retry behavior
        if (scenario.maxRetries) {
          expect(errorInjector.getRetryCount()).toBeLessThanOrEqual(scenario.maxRetries);
        }
        
        // Verify fallback behavior
        if (scenario.fallbackBehavior) {
          expect(result.fallbackMode).toBe(scenario.fallbackBehavior);
        }
        
      } finally {
        errorInjector.cleanup();
      }
    });
  });

  it('should maintain data consistency during failures', async () => {
    const testCase = await createTestCase();
    
    // Inject failure during case storage
    const errorInjector = new ErrorInjector();
    errorInjector.injectErrorAfterDelay(new Error('Storage failure'), 100);
    
    try {
      await memoryService.storeCaseFromState(testCase.state);
    } catch (error) {
      // Verify no partial data was stored
      const storedCase = await storage.findCase(testCase.caseId);
      expect(storedCase).toBeNull(); // Should be null or complete, never partial
    }
    
    errorInjector.cleanup();
  });
});
```

## Quality Metrics

### Response Quality Metrics

```typescript
// tests/e2e/metrics/qualityMetrics.ts
export class QualityMetrics {
  async measureResponseQuality(response: string, context: TestContext): Promise<QualityScore> {
    return {
      relevance: await this.calculateRelevance(response, context.query),
      accuracy: await this.verifyAccuracy(response, context.groundTruth),
      completeness: await this.checkCompleteness(response, context.requiredElements),
      coherence: await this.analyzeCoherence(response),
      hallucination: await this.detectHallucinations(response, context.sourceData),
      userSatisfaction: await this.predictUserSatisfaction(response, context)
    };
  }

  async calculateRelevance(response: string, query: string): Promise<number> {
    // Use semantic similarity between response and query
    const embedding1 = await this.embeddingService.embed(response);
    const embedding2 = await this.embeddingService.embed(query);
    return this.cosineSimilarity(embedding1, embedding2);
  }

  async verifyAccuracy(response: string, groundTruth: any): Promise<number> {
    // Extract factual claims and verify against ground truth
    const claims = await this.extractFactualClaims(response);
    const verifiedClaims = claims.filter(claim => 
      this.verifyClaimAgainstGroundTruth(claim, groundTruth)
    );
    return verifiedClaims.length / claims.length;
  }

  async detectHallucinations(response: string, sourceData: any): Promise<number> {
    // Identify claims not supported by source data
    const claims = await this.extractFactualClaims(response);
    const unsupportedClaims = claims.filter(claim => 
      !this.isClaimSupportedBySource(claim, sourceData)
    );
    return unsupportedClaims.length / claims.length;
  }
}
```

### Performance Metrics

```typescript
// tests/e2e/metrics/performanceMetrics.ts
export class PerformanceMetrics {
  async measureSystemPerformance(): Promise<PerformanceReport> {
    return {
      responseTime: {
        p50: await this.getPercentile(50),
        p95: await this.getPercentile(95),
        p99: await this.getPercentile(99)
      },
      throughput: {
        requestsPerSecond: await this.calculateThroughput(),
        concurrentUsers: await this.getMaxConcurrentUsers()
      },
      resourceUsage: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: await this.getCPUUsage(),
        diskUsage: await this.getDiskUsage()
      },
      errorRates: {
        totalErrors: await this.getTotalErrors(),
        errorRate: await this.getErrorRate(),
        errorsByType: await this.getErrorsByType()
      }
    };
  }
}
```

## Best Practices

### 1. Test Data Management
- **Version control test data** with schema migrations
- **Use realistic data volumes** that match production
- **Implement data anonymization** for sensitive information
- **Create golden datasets** for consistent evaluation

### 2. Test Isolation
- **Use test containers** for database isolation
- **Mock external services** with realistic latencies
- **Implement proper cleanup** between tests
- **Avoid test interdependencies**

### 3. Quality Assurance
- **Set quality gates** that fail builds on regression
- **Monitor quality trends** over time
- **Use property-based testing** for edge case discovery
- **Implement visual regression testing** for UI components

### 4. Performance Testing
- **Test with realistic load patterns**
- **Monitor resource usage** during tests
- **Implement gradual load increase**
- **Test failure scenarios** under load

### 5. Continuous Integration
- **Run critical tests on every commit**
- **Use parallel test execution** for faster feedback
- **Generate comprehensive test reports**
- **Integrate with monitoring systems**

## Tools and Infrastructure

### Testing Framework Stack
```yaml
# Testing Infrastructure
testing_framework: Jest/Vitest
e2e_framework: Playwright/Cypress
load_testing: Artillery/K6
database_testing: TestContainers
mocking: MSW (Mock Service Worker)
quality_analysis: Custom AI quality analyzers
monitoring: Datadog/New Relic
reporting: Allure/Jest HTML Reporter
```

### CI/CD Pipeline Integration
```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          MONGODB_URI: mongodb://localhost:27017/test
          LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
      
      - name: Generate quality report
        run: npm run generate:quality-report
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: e2e-test-results
          path: test-results/
```

This comprehensive E2E testing strategy ensures your AI Agentic RAG system maintains high quality, performance, and reliability across all components and user interactions.