# Testing Strategy

This project adheres to a comprehensive testing strategy to ensure the reliability, accuracy, and performance of the AI Diagnostic Assistant.

## 1. Unit Tests (Jest)
- **Scope:** Every function, class, and LangGraph node (where separable logic exists) must have dedicated unit tests.
- **Mocking:** Use Jest for mocking external dependencies (API calls, MongoDB interactions, AI model invocations) to isolate the component under test.
- **Coverage:** Strive for high test coverage for core logic, especially for `parse_user_query`, `analysis tools`, and `memory retrieval`.
- **Deterministic:** Unit tests must be deterministic, producing the same result every time.

## 2. Integration Tests
- **Scope:** Test the interaction between multiple components or nodes in the LangGraph workflow.
- **External API Mocks:** Use tools like `nock` or provide mock servers for external APIs (Datadog, Genie, UPS) to simulate real network conditions without making actual calls.
- **MongoDB Integration:** Test actual data storage and retrieval from MongoDB, preferably against a local or test MongoDB instance.
- **Focus:** Ensure data flows correctly between nodes and that integrations with external services behave as expected.

## 3. End-to-End (E2E) Tests
- **Scope:** Simulate a full diagnostic workflow from user query to final response, including actual API calls (in a controlled test environment) and MongoDB interactions.
- **Test Data:** Use representative, anonymized test data for E2E scenarios.
- **Scenario-Based:** Design E2E tests for key diagnostic scenarios (e.g., a known offer pricing issue, a common configuration error, an unknown query leading to clarification).
- **Assertions:** Verify the final diagnosis, the format of the response, and the content of the stored case in MongoDB.

## 4. AI Model Evaluation
- **Dataset-Based Evaluation:** Maintain a dataset of historical user queries and their expected diagnostic outcomes. Use this dataset to periodically evaluate the `Problem Categorization` and `Analysis & Diagnosis` steps.
- **Metric Tracking:** Track metrics like categorization accuracy, diagnosis correctness, and hallucination rate.
- **Regression Testing:** Ensure model updates do not negatively impact performance on previously resolved cases.

## 5. Performance Testing
- **Load Testing:** Conduct load tests on the diagnostic workflow to ensure it scales under expected user load.
- **Latency Monitoring:** Monitor the latency of individual nodes and overall workflow execution.

## 6. Security Testing
- **Input Sanitization:** Test for injection vulnerabilities in user queries.
- **Access Control:** Verify that tools only access data they are authorized for.
- **Data Redaction:** Confirm sensitive data is properly redacted in logs and stored cases.

## 7. Code Quality Tools
- **ESLint/Prettier:** Enforce code style and identify common errors using ESLint and Prettier.
- **TypeScript Compiler:** Ensure `tsc` runs without errors (part of CI/CD).