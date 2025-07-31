# Testing Documentation

This directory contains comprehensive testing strategies and guidelines for the AI Diagnostic Assistant.

## Documents

### [E2E Testing Strategy](./e2e-testing-strategy.md)
Comprehensive guide for end-to-end testing of AI Agentic RAG systems, covering:
- Workflow integration testing
- RAG quality validation
- LLM response quality metrics
- Multi-turn conversation testing
- Performance and scalability testing
- Error handling and recovery testing

## Testing Structure

```
tests/
├── unit/           # Unit tests (Jest)
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
│   ├── workflows/  # Complete user journey tests
│   ├── rag/       # RAG quality tests
│   ├── llm/       # LLM response quality tests
│   ├── conversation/ # Multi-turn conversation tests
│   ├── performance/  # Performance and scalability tests
│   └── resilience/   # Error handling tests
└── fixtures/      # Test data and scenarios
```

## Quick Start

1. **Unit Tests**: `npm test`
2. **Integration Tests**: `npm run test:integration`
3. **E2E Tests**: `npm run test:e2e`
4. **Coverage Report**: `npm run test:coverage`

## Quality Gates

- Unit test coverage: >90%
- Integration test coverage: >80%
- E2E test success rate: >95%
- Response quality score: >0.85
- Performance: <3s average response time