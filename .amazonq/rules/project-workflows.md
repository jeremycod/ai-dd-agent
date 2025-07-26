# AI Diagnostic Assistant Workflows

## Main Diagnostic Workflow

The application uses a LangGraph-based state machine with the following node sequence:

1. **parse_user_query** → Categorizes query and extracts entity information
2. **memory_retrieval** → Retrieves similar historical cases from MongoDB
3. **ask_environment_clarification** → Validates environment specification (conditional)
4. **fetch_parallel_data** → Collects data from multiple external sources
5. **run_parallel_analysis_tools** → Analyzes collected data using AI tools
6. **summarize_findings** → Synthesizes analysis into coherent diagnosis
7. **respond_to_user** → Formats and delivers final response
8. **store_case** → Saves diagnostic case for future learning

## Parallel Data Fetching

The `fetchParallelData` node executes multiple data collection operations concurrently:

- **Always executed**: `fetchEntityHistory`, `fetchDatadogLogs`
- **For offers**: `fetchGenieOffer`, `fetchOfferServiceOffer`
- **For pricing issues**: `fetchUPSOfferPrice` (OFFER_PRICE category only)

Each function returns partial state updates that are merged into the main state.

## Parallel Analysis Tools

The `runParallelAnalysisTools` node runs AI-powered analysis tools based on available data:

- **analyzeDatadogErrorsTool** - Identifies critical errors in logs
- **analyzeDatadogWarningsTool** - Analyzes warning patterns
- **analyzeEntityHistoryTool** - Tracks configuration changes
- **analyzeUPSOfferPriceTool** - Validates pricing (OFFER_PRICE category)
- **compareOffersTool** - Cross-references offer data between systems

Tools execute in parallel using Promise.allSettled for fault tolerance.

## Memory System Integration

The memory workflow provides learning capabilities:

- **memoryRetrievalWrapper** - Retrieves similar cases before diagnosis
- **storeCaseWrapper** - Stores completed diagnostic cases
- **MongoStorage** - Persistent storage for cases and patterns
- **MemoryService** - Manages case retrieval and pattern recognition

## Conditional Flow Control

The workflow includes conditional edges for dynamic routing:

- **Entity/Environment Validation** - Ends workflow if clarification needed
- **Environment Check** - Routes to clarification if environment unknown
- **Category-Based Tool Selection** - Executes specific tools based on problem type

## Error Handling

- Promise.allSettled ensures partial failures don't break the workflow
- Message deduplication prevents duplicate tool results
- Graceful degradation when data sources are unavailable
- Comprehensive logging for debugging and monitoring

## State Management

The AgentState tracks:
- Query metadata (category, entity IDs, environment)
- Collected data (logs, history, offer details)
- Analysis results from each tool
- Message history for conversation context
- RL features for learning system