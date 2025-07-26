# External API Integration Guidelines

All interactions with external APIs (Datadog, Genie GraphQL, Offer Service, UPS) must follow these guidelines for consistency, reliability, and performance.

## 1. Authentication & Authorization
- **Secure Credentials:** All API keys and secrets must be stored securely (e.g., AWS Secrets Manager, environment variables) and never hardcoded.
- **Least Privilege:** API clients should only have the minimum necessary permissions to perform their required actions.

## 2. Error Handling & Retries
- **Robust Error Handling:** Implement comprehensive `try-catch` blocks around all API calls.
- **Retry Mechanism:** Implement an exponential backoff and retry mechanism for transient network errors or API rate limits. Define a maximum number of retries.
- **Circuit Breaker Pattern:** Consider implementing a circuit breaker pattern for critical external services to prevent cascading failures if a service becomes unresponsive.
- **Meaningful Error Messages:** Map external API errors to clear, internal error messages for the diagnostic assistant.

## 3. Rate Limiting & Quotas
- **Respect API Limits:** Always adhere to the documented rate limits of each external API. Implement client-side rate limiting or token buckets where necessary.
- **Monitor Usage:** Monitor API usage and quotas in Datadog or other monitoring tools.

## 4. Data Transformation & Validation
- **Input Validation:** Validate all input parameters before making API calls.
- **Output Transformation:** Transform external API responses into a consistent internal data model to decouple our application logic from external API schema changes.
- **Partial Data Handling:** Be prepared to handle cases where external APIs return partial data or unexpected formats.

## 5. Performance
- **Caching:** Implement caching for frequently accessed, relatively static data from external APIs (e.g., offer metadata that changes infrequently).
- **Minimize Calls:** Only make API calls when strictly necessary. Reuse fetched data within a diagnostic session where possible.
- **Timeout Configuration:** Configure appropriate timeouts for all external API calls to prevent indefinite hangs.

## 6. Versioning
- **API Versioning:** Explicitly specify API versions in requests where applicable to ensure compatibility and prevent breaking changes.

## 7. Observability
- **Request/Response Logging:** Log API request and response details (excluding sensitive data) at a DEBUG level for troubleshooting.
- **Latency Monitoring:** Monitor the latency of external API calls in Datadog.
- **Success/Failure Metrics:** Track success and failure rates for each external API.