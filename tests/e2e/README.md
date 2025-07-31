# End-to-End Test Environment

This directory contains the complete E2E testing infrastructure for the AI Diagnostic Assistant.

## Structure

```
tests/e2e/
├── setup/                  # Test environment setup
│   ├── testEnvironment.ts  # Main test environment class
│   ├── mockLLMService.ts   # Mock LLM service for deterministic testing
│   ├── qualityMonitor.ts   # Quality monitoring and metrics
│   └── index.ts           # Exports
├── fixtures/              # Test data and scenarios
│   ├── testDataLoader.ts  # Test data management
│   └── data/             # Test fixture files
├── workflows/            # Workflow integration tests
├── rag/                 # RAG quality tests
├── llm/                 # LLM response quality tests
├── conversation/        # Multi-turn conversation tests
├── performance/         # Performance and scalability tests
├── resilience/          # Error handling and recovery tests
├── globalSetup.ts       # Global test setup/teardown
├── setup.ts            # Individual test suite setup
└── jest.config.e2e.js  # Jest configuration for E2E tests
```

## Quick Start

### Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test category
npm run test:e2e -- --testPathPattern=workflows

# Run with coverage
npm run test:e2e -- --coverage

# Run in watch mode
npm run test:e2e -- --watch
```

### Test Environment Features

#### 1. **Isolated Test Database**
- In-memory MongoDB instance for each test run
- Automatic cleanup between tests
- Seeded with realistic test data

#### 2. **Mock LLM Service**
- Deterministic responses for consistent testing
- Configurable response variability
- Error injection capabilities
- Latency simulation

#### 3. **Quality Monitoring**
- Automated response quality analysis
- Configurable quality thresholds
- Comprehensive quality reports
- Trend analysis over time

#### 4. **Test Data Management**
- Scenario-based test data loading
- Versioned test fixtures
- Automatic fixture generation
- Easy data seeding and cleanup

## Configuration

### Environment Variables

```bash
# Test database configuration
TEST_DB_NAME=ai-diagnostic-e2e-test

# Mock LLM configuration
MOCK_LLM_VARIABILITY=0.05
MOCK_LLM_LATENCY_SIMULATION=false
MOCK_LLM_ERROR_INJECTION=false

# Quality thresholds
QUALITY_RELEVANCE_THRESHOLD=0.8
QUALITY_ACCURACY_THRESHOLD=0.85
QUALITY_COMPLETENESS_THRESHOLD=0.9
```

### Test Environment Config

```typescript
const config: TestEnvironmentConfig = {
  dbName: 'ai-diagnostic-e2e-test',
  mockLLMConfig: {
    responseVariability: 0.05,
    latencySimulation: false,
    errorInjection: false
  },
  qualityThresholds: {
    relevance: 0.8,
    accuracy: 0.85,
    completeness: 0.9
  }
};
```

## Writing E2E Tests

### Basic Test Structure

```typescript
import { getGlobalTestEnvironment } from '../globalSetup';

describe('My E2E Test Suite', () => {
  let testEnv: E2ETestEnvironment;

  beforeAll(() => {
    testEnv = getGlobalTestEnvironment();
  });

  it('should test complete workflow', async () => {
    // Setup test scenario
    const scenario = await testEnv.getTestDataLoader()
      .loadTestScenario('my_test_scenario');

    // Execute test
    const result = await myWorkflow.execute(scenario.input);

    // Verify results
    expect(result.outcome).toBe('SUCCESS');
    
    // Verify quality
    const quality = await testEnv.getQualityMonitor()
      .analyzeResponse(result.response, scenario.context);
    
    expect(quality.overall).toBeGreaterThan(0.8);
  });
});
```

### Quality Assertions

```typescript
// Verify response quality
const quality = await qualityMonitor.analyzeResponse(response, {
  query: 'test query',
  groundTruth: expectedData,
  requiredElements: ['entity_id', 'status', 'recommendation']
});

expect(quality.relevance).toBeGreaterThan(0.8);
expect(quality.accuracy).toBeGreaterThan(0.85);
expect(quality.completeness).toBeGreaterThan(0.9);
expect(quality.hallucination).toBeLessThan(0.1);
```

### Mock LLM Usage

```typescript
// Configure mock responses
const mockLLM = testEnv.getMockLLMService();
mockLLM.setResponseTemplate('ENTITY_STATUS', [{
  text: 'Offer ABC-123 is currently inactive due to configuration issues.',
  confidence: 0.9,
  metadata: { category: 'ENTITY_STATUS' }
}]);

// Inject errors for testing
mockLLM.injectError('timeout');
```

## Best Practices

1. **Test Isolation**: Each test should be independent and not rely on state from other tests
2. **Realistic Data**: Use realistic test data that mirrors production scenarios
3. **Quality Gates**: Set appropriate quality thresholds for your use case
4. **Error Testing**: Include tests for error scenarios and edge cases
5. **Performance**: Monitor test execution time and optimize slow tests
6. **Documentation**: Document test scenarios and expected outcomes

## Troubleshooting

### Common Issues

1. **Test Database Connection**: Ensure MongoDB memory server starts correctly
2. **Mock Service Errors**: Check mock LLM service configuration
3. **Quality Threshold Failures**: Review and adjust quality thresholds as needed
4. **Test Timeouts**: Increase timeout for complex workflows

### Debug Mode

```bash
# Run with debug logging
DEBUG=* npm run test:e2e

# Run specific test with verbose output
npm run test:e2e -- --testNamePattern="my test" --verbose
```