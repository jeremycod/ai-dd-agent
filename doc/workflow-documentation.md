# AI Diagnostic Assistant Workflow Documentation

## Overview

The AI Diagnostic Assistant follows a structured workflow to diagnose issues with streaming platform entities (offers, campaigns, products, packages). The system combines intelligent categorization, data retrieval, analysis, and learning capabilities to provide accurate diagnostics.

## Problem Categories

The system classifies user queries into specific categories to guide the diagnostic approach:

### Core Issue Categories

- **`ENTITY_STATUS`**: Status and availability issues (expired, live when shouldn't be, redemption problems)
- **`UI_ISSUE`**: User interface problems in management systems (loading, publishing, saving errors)
- **`DATA_INCONSISTENCY`**: Data discrepancies between environments or systems
- **`DATA_MAPPING`**: Entity linking and ID conversion issues (unified to legacy IDs)
- **`ENTITY_CONFIGURATION`**: Unexpected entity settings or missing configurations
- **`OFFER_PRICE`**: Pricing-related issues (incorrect, missing, or inconsistent pricing)
- **`SYSTEM_BEHAVIOR`**: System functionality and data model inquiries
- **`GENERAL_QUESTION`**: Broad operational or informational questions
- **`UNKNOWN_CATEGORY`**: Queries that don't fit predefined categories

## Workflow Nodes

### 1. Parse User Query (`parse_user_query`)
**Purpose**: Initial query processing and information extraction
- Categorizes user query into problem types
- Extracts entity IDs, types, and timeframes
- Identifies target environment (production, staging, development)
- Generates initial response structure

### 2. Memory Retrieval (`memory_retrieval`)
**Purpose**: Leverage historical knowledge for context
- Retrieves similar diagnostic cases from MongoDB
- Identifies relevant patterns based on category/entity/environment
- Updates RL features with similarity metrics
- Provides historical context for better diagnosis

### 3. Environment Clarification (`ask_environment_clarification`)
**Purpose**: Ensure environment specification for accurate investigation
- Triggered when environment is unknown or unclear
- Requests user to specify: production, staging, or development
- Critical for tool execution and data accuracy

### 4. Parallel Data Fetching (`fetch_parallel_data`)
**Purpose**: Concurrent data collection from multiple sources
- **Entity History**: Version changes and configuration updates
- **Datadog Logs**: Error logs, warnings, and system events
- **Genie Offer Data**: Offer details from GraphQL API (if offer-related)
- **Offer Service Data**: Additional offer information (if offer-related)
- **UPS Pricing Data**: Pricing details (if OFFER_PRICE category)

### 5. Parallel Analysis Tools (`run_parallel_analysis_tools`)
**Purpose**: Concurrent analysis of collected data
- **Datadog Error Analysis**: Identifies critical errors and exceptions
- **Datadog Warning Analysis**: Analyzes warning patterns and trends
- **Entity History Analysis**: Tracks configuration changes and impacts
- **UPS Offer Price Analysis**: Validates pricing configurations (OFFER_PRICE only)
- **Offer Comparison**: Cross-references offer data between systems

### 6. Summarize Findings (`summarize_findings`)
**Purpose**: Synthesize analysis results into coherent diagnosis
- Combines all analysis results
- Identifies patterns and root causes
- Generates comprehensive diagnostic summary
- Prepares structured response with evidence

### 7. Respond to User (`respond_to_user`)
**Purpose**: Deliver final diagnosis to user
- Formats response using Markdown structure
- Includes clear headings, evidence, and recommendations
- Maintains full entity IDs (no truncation)
- Provides actionable next steps

### 8. Store Case (`store_case`)
**Purpose**: Learn from diagnostic session for future improvement
- Stores complete diagnostic case in MongoDB
- Updates success patterns based on feedback
- Tracks tool effectiveness and usage patterns
- Enables continuous learning and improvement

## Data Sources and Tools

### External APIs
- **Datadog**: Log aggregation and monitoring data
- **Genie GraphQL**: Offer management system data
- **Offer Service**: Additional offer information
- **UPS (Unified Pricing Service)**: Pricing and billing data
- **Entity History Service**: Configuration change tracking

### Internal Storage
- **MongoDB**: Long-term memory storage
  - `diagnostic_cases`: Historical diagnostic sessions
  - `diagnostic_patterns`: Learned success patterns

## Special Handling

### Offer Pricing Issues
- Prioritizes `getOfferPrice` tool for OFFER_PRICE category
- Special handling for 3PP (Third-Party Partner) and IAP (In-App Purchase) offers
- Recognizes external pricing management as normal behavior

### Environment Validation
- Mandatory environment specification for tool execution
- Supports: production, staging (qa), development
- Blocks execution until environment is clarified

### Memory-Enhanced Diagnostics (✅ Implemented)
- **Similar Case Retrieval**: Finds historical cases matching category/entity/environment
- **Pattern Application**: Uses learned patterns to guide tool selection
- **Context Enhancement**: Provides historical context for better diagnosis
- **Continuous Learning**: Feedback loops improve future diagnostics

**Current Capabilities:**
```typescript
// Memory retrieval during diagnosis
const similarCases = await memoryService.retrieveSimilarCases(state);
const relevantPatterns = await memoryService.getRelevantPatterns(state);

// Updates RL features with memory context
rlFeatures: {
  similarCaseCount: similarCases.length,
  // ... other features
}
```

## Response Format

All responses follow a structured Markdown format:
- Clear headings for organization
- Sub-headings for detailed breakdown
- Bullet points and numbered lists
- Code blocks for technical details
- Bold emphasis for important information
- Full entity IDs (never truncated)
- Logical flow from problem to solution

## Learning and Improvement

### Implementation Status

#### ✅ Currently Implemented
- **Case Storage**: MongoDB integration with `diagnostic_cases` collection
- **Memory Retrieval**: Similar case lookup during diagnosis
- **Basic Pattern Storage**: `diagnostic_patterns` collection structure
- **Feedback Collection**: UI supports thumbs up/down, 1-5 rating, comments, and reason codes
- **RL Framework**: State tracking with `overallRlReward` and `messageFeedbacks`

#### 🚧 Partially Implemented
- **Pattern Recognition**: Basic pattern creation/update logic exists but needs refinement
- **Tool Effectiveness**: Framework exists in `currentEpisodeActions` but not fully utilized

#### 📋 Planned/Proposed
- **Advanced Pattern Matching**: ML-based similarity scoring
- **Automated Success Rate Calculation**: Real-time accuracy metrics
- **Predictive Tool Selection**: AI-driven tool recommendation

### Detailed Learning Components

#### 1. Case Storage (✅ Implemented)
**What it does:**
- Stores every diagnostic session in MongoDB `diagnostic_cases` collection
- Captures: query category, entity details, tools used, final summary, user feedback
- Creates searchable history for future reference

**Current Implementation:**
```typescript
// In storeCaseNode
const diagnosticCase: DiagnosticCase = {
  caseId: state.rlEpisodeId || uuidv4(),
  timestamp: new Date(),
  category: state.queryCategory,
  entityType: state.entityType,
  entityIds: state.entityIds,
  environment: state.environment,
  userQuery: state.userQuery,
  toolsUsed: state.currentEpisodeActions?.map(action => action.nodeName) || [],
  finalSummary: state.finalSummary,
  overallRlReward: state.overallRlReward,
  messageFeedbacks: state.messageFeedbacks
};
```

#### 2. Pattern Recognition (🚧 Partially Implemented)
**What it does:**
- Identifies recurring diagnostic patterns based on category + entity type + environment
- Tracks which tool combinations work best for specific issue types
- Updates success rates based on user feedback and RL rewards

**Current Implementation:**
```typescript
// Basic pattern creation in updatePattern()
const newPattern: DiagnosticPattern = {
  patternId: uuidv4(),
  category: diagnosticCase.category,
  entityType: diagnosticCase.entityType,
  environment: diagnosticCase.environment,
  commonTools: diagnosticCase.toolsUsed,
  successRate: isSuccess ? 1 : 0,
  usageCount: 1,
  lastUpdated: new Date()
};
```

**Needs Enhancement:**
- More sophisticated pattern matching algorithms
- Weighted tool effectiveness scoring
- Temporal pattern analysis (time-based trends)

#### 3. Tool Effectiveness (🚧 Partially Implemented)
**What it does:**
- Tracks which tools are most effective for specific problem categories
- Measures tool success rates across different scenarios
- Optimizes tool selection based on historical performance

**Current Framework:**
```typescript
// In AgentState
currentEpisodeActions?: {
  nodeName: string;
  actionDescription: string;
  actionParameters?: Record<string, any>;
  timestamp: Date;
  stateEmbedding?: number[];
  associatedMessageId?: string;
}[];
```

**Missing Implementation:**
- Tool effectiveness scoring algorithm
- Success correlation with specific tools
- Automated tool recommendation system

#### 4. Feedback Integration (✅ Implemented)
**What it does:**
- Collects user feedback through multiple channels
- Integrates feedback into learning algorithms
- Adjusts future diagnostic approaches based on user satisfaction

**Current Implementation:**
```typescript
export type AgentMessageFeedback = {
  type: FeedbackType; // thumbs up/down -> positive/negative
  rating?: 1 | 2 | 3 | 4 | 5;
  comment?: string; // freeform feedback
  reason?: 1 | 2 | 3 | 4 | 5 | 6; // reasons (1 of 6)
  timestamp: Date;
  feedbackSource?: string;
};
```

**Integration Points:**
- Stored in `messageFeedbacks` per diagnostic session
- Used to calculate `overallRlReward`
- Influences pattern success rate updates

#### 5. Success Rate Tracking (📋 Planned)
**What it should do:**
- Monitor diagnostic accuracy over time
- Track improvement trends across different categories
- Identify areas needing enhancement

**Proposed Implementation:**
- Real-time dashboard showing success metrics
- Category-specific accuracy tracking
- Tool-specific performance analytics
- Temporal trend analysis

### Learning Workflow

1. **During Diagnosis**: Memory retrieval provides historical context
2. **Tool Execution**: Actions are tracked in `currentEpisodeActions`
3. **User Feedback**: Collected through UI feedback mechanisms
4. **Case Storage**: Complete session stored in MongoDB
5. **Pattern Update**: Success patterns updated based on feedback
6. **Future Enhancement**: Similar cases influence future diagnostics

### Next Steps for Full Implementation

1. **Enhance Pattern Matching**: Implement ML-based similarity scoring
2. **Tool Effectiveness Analytics**: Build comprehensive tool performance tracking
3. **Success Rate Dashboard**: Create monitoring and analytics interface
4. **Predictive Capabilities**: Use patterns to predict optimal diagnostic approaches
5. **Automated Learning**: Reduce manual intervention in pattern recognition