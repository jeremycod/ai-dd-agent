# MongoDB Schema Design Principles

This project utilizes MongoDB for storing diagnostic cases and learned patterns. Adhere to these principles for effective data modeling.

## 1. Document-Oriented Design
- **Embed vs. Reference:**
    - **Embed** related data that is frequently accessed together and forms a coherent "document" (e.g., detailed steps of a diagnostic case, extracted entities, analysis results). This minimizes queries.
    - **Reference** data that is large, infrequently accessed, or shared across many documents (e.g., large log files, deep historical configurations that might be in separate collections).
- **Denormalization for Reads:** Prioritize read performance by denormalizing data where appropriate. Duplicate data if it significantly reduces the number of queries needed, and the duplicated data is not frequently updated.

## 2. Diagnostic Case Model
- **Core Document:** Each diagnostic case should ideally be a single document, containing:
    - `caseId`: Unique identifier.
    - `timestamp`: When the case was initiated/completed.
    - `userQuery`: Original natural language query.
    - `categorization`: The `PROBLEM_CATEGORY` assigned.
    - `extractedEntities`: Object containing entityId, entityType, environment, timeframe.
    - `diagnosticSteps`: Array of objects, each representing a workflow node's execution (e.g., node name, input, output, duration, status, errors).
    - `collectedData`: Nested document holding data fetched from Datadog, Genie, UPS, etc.
    - `analysisResults`: Consolidated findings from analysis tools.
    - `finalDiagnosis`: The summarized problem and actionable insights.
    - `feedback`: (Optional) Field for user feedback on the diagnosis.
    - `status`: (e.g., `PENDING`, `COMPLETE`, `FAILED`, `CLARIFICATION_NEEDED`).

## 3. Indexes
- **Common Query Patterns:** Create indexes on fields frequently used in queries, especially `caseId`, `timestamp`, `categorization`, and `extractedEntities.entityId`.
- **Compound Indexes:** Use compound indexes for queries that involve multiple fields in their `WHERE` clauses.
- **Sparse Indexes:** Consider sparse indexes for optional fields that are only present in a subset of documents.

## 4. Learning System Memory
- **Pattern Recognition:** Design specific collections or fields within the diagnostic case to store patterns or features useful for the "Learning System" to identify similar historical cases.
- **Vector Embeddings (Future Consideration):** If using vector embeddings for semantic search of cases, define how these embeddings are stored and updated in MongoDB.

## 5. Schema Validation
- **Schema Validation Rules:** Implement MongoDB's schema validation to enforce consistency for critical fields and document structure, especially for `caseId`, `categorization`, and essential `extractedEntities`.

## 6. Data Lifecycling
- **TTL Indexes:** Consider using TTL (Time-To-Live) indexes for diagnostic cases or log data that only needs to be retained for a certain period.