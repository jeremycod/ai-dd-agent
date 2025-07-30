# Progressive Tool Selection

## Overview
Uses historical tool effectiveness data to create intelligent, tiered execution plans that optimize resource usage and diagnostic quality.

## Implementation Status
🟡 **Infrastructure Ready, Not Integrated**

## How It Works

### 1. Tool Effectiveness Analysis
```typescript
// From: src/services/ProgressiveToolSelector.ts
const toolStats = this.calculateToolStats(similarCases);
// Analyzes which tools were actually useful in similar cases

// Example output:
// [
//   { toolName: "analyzeDatadogErrors", effectivenessScore: 0.85, usageCount: 20 },
//   { toolName: "fetchEntityHistory", effectivenessScore: 0.72, usageCount: 15 },
//   { toolName: "fetchDatadogLogs", effectivenessScore: 0.34, usageCount: 25 }
// ]
```

### 2. Tiered Execution Plan
```typescript
// From: src/services/ProgressiveToolSelector.ts
const plan = {
  tier1Tools: toolStats.filter(t => t.effectivenessScore > 0.8),  // High confidence
  tier2Tools: toolStats.filter(t => t.effectivenessScore >= 0.5), // Medium confidence  
  tier3Tools: toolStats.filter(t => t.effectivenessScore < 0.5),  // Low confidence
  executionStrategy: 'tiered_parallel'
};
```

### 3. Resource-Optimized Execution
```typescript
// Conceptual implementation (not yet integrated)
async executeAdaptiveParallel(plan: ToolSelectionPlan) {
  // Phase 1: Execute high-confidence tools immediately
  const tier1Results = await Promise.allSettled(
    plan.tier1Tools.map(tool => executeTool(tool.toolName))
  );
  
  // Phase 2: Execute medium-confidence tools with delay
  const tier2Results = await Promise.allSettled(
    plan.tier2Tools.map(tool => delayedExecute(tool.toolName, 1000))
  );
  
  // Phase 3: Only execute low-confidence tools if others insufficient
  const tier3Results = await conditionalExecute(plan.tier3Tools, tier1Results);
}
```

## Key Benefits

### Current State (All Tools Run)
```
Problem: Offer pricing issue
Tools Executed: ALL 10 tools in parallel
Resource Usage: 100% (10 API calls, 10 analysis operations)
Useful Results: 3 tools actually contributed to diagnosis
Waste: 70% of resources used on non-contributing tools
```

### With Progressive Selection
```
Problem: Offer pricing issue  
Historical Analysis: Similar cases solved with 3 specific tools
Tier 1: analyzeUPSOfferPrice, getOfferPrice (90% confidence)
Tier 2: compareOffers (60% confidence)
Tier 3: Other tools (only if Tier 1+2 insufficient)
Resource Usage: 30-60% reduction
Quality: Same or better (focused on proven tools)
```

## Code Implementation

### Primary Files
- **`src/services/ProgressiveToolSelector.ts`** - Core selection logic
- **`src/storage/memoryService.ts`** - Integration with historical data
- **`src/nodes/intelligentToolSelection.ts`** - Workflow integration (demo)

### Key Classes
- **`ProgressiveToolSelector`** - Analyzes tool effectiveness and creates plans
- **`ToolSelectionPlan`** - Interface defining tiered execution strategy
- **`MemoryService.getToolSelectionPlan()`** - Orchestrates selection process

### Integration Points
- **Available**: `getToolSelectionPlan()` method ready to use
- **Missing**: Workflow nodes don't use the plans yet
- **Needed**: Modify `fetchParallelData` to implement tiered execution

## Current Gap: Workflow Integration

### What Exists
```typescript
// In MemoryService - WORKING
const toolPlan = await memoryService.getToolSelectionPlan(state);
// Returns: { tier1: [...], tier2: [...], tier3: [...] }
```

### What's Missing
```typescript
// In fetchParallelData - NOT IMPLEMENTED
// Currently runs all tools regardless of plan:
const allResults = await Promise.allSettled([
  fetchDatadogLogs(state),
  fetchGenieOffer(state), 
  fetchEntityHistory(state),
  // ... all tools run every time
]);

// Should be:
const plan = await getToolSelectionPlan(state);
const results = await executeWithPlan(plan, state);
```

## Real-World Example

### Case: ENTITY_CONFIGURATION Problems
```
Historical Analysis (from 5 similar cases):
- entityHistory: 80% effectiveness (found config changes)
- datadogErrors: 75% effectiveness (identified specific errors)
- datadogWarnings: 70% effectiveness (validation failures)
- datadogLogs: 30% effectiveness (basic log info only)
- genieOfferDetails: 25% effectiveness (minimal diagnostic value)

Generated Plan:
- Tier 1: entityHistory, datadogErrors (execute immediately)
- Tier 2: datadogWarnings (execute after 1s delay)  
- Tier 3: datadogLogs, genieOfferDetails (only if Tier 1+2 insufficient)

Expected Outcome:
- 60% resource reduction (skip Tier 3 tools)
- Same diagnostic quality (focus on proven tools)
- Faster time to useful results
```

## Implementation Priority

### High Priority Tasks
1. **Modify fetchParallelData Node**
   - Add tool plan retrieval
   - Implement tiered execution logic
   - Add conditional tool execution

2. **Add Resource Tracking**
   - Monitor API calls saved
   - Track diagnostic quality impact
   - Measure time to useful results

### Integration Steps
```typescript
// 1. Get tool selection plan
const toolPlan = await memoryService.getToolSelectionPlan(state);

// 2. Execute tiered strategy
const results = await executeTieredTools(toolPlan, state);

// 3. Track resource optimization
const metrics = calculateResourceSavings(toolPlan, results);
```

## Expected Impact

### Resource Optimization
- **API Calls**: 40-60% reduction
- **Processing Time**: 30-50% reduction for low-value tools
- **Cost Savings**: Proportional to reduced API usage

### Quality Improvement
- **Focus**: Prioritize tools with proven effectiveness
- **Confidence**: Higher confidence in results from effective tools
- **Learning**: Continuous improvement of tool selection accuracy

## Future Enhancements
- **Dynamic Thresholds**: Adjust tier boundaries based on problem complexity
- **Context-Aware Selection**: Different strategies for different problem types
- **Real-Time Adaptation**: Modify plan based on intermediate results
- **A/B Testing**: Compare progressive vs. full execution strategies

## Monitoring & Metrics
- Tool selection accuracy (predicted vs. actual usefulness)
- Resource savings per diagnostic session
- Diagnostic quality impact (user satisfaction correlation)
- Time to first useful result improvement