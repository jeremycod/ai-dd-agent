# Advanced Pattern Matching: ML-based Similarity Scoring

## What It Is
Instead of simple exact matching (category + entityType + environment), this uses machine learning to find **semantically similar** cases even when they don't match exactly.

## Current vs. Advanced Approach

**Current (Basic):**
```typescript
// Only finds exact matches
const similarCases = await db.collection('diagnostic_cases').find({
  category: 'OFFER_PRICE',
  entityType: 'offer',
  environment: 'production'
});
```

**Advanced (ML-based):**
```typescript
// Finds semantically similar cases using embeddings
const queryEmbedding = await generateEmbedding(userQuery);
const similarCases = await db.collection('diagnostic_cases').aggregate([
  {
    $vectorSearch: {
      queryVector: queryEmbedding,
      path: "queryEmbedding",
      numCandidates: 100,
      limit: 10,
      index: "vector_index"
    }
  },
  {
    $addFields: {
      similarityScore: { $meta: "vectorSearchScore" }
    }
  }
]);
```

## How Similar Cases Help the Current Case

### 1. **Contextual Guidance** - "What worked before?"

Similar cases provide **proven solution paths** for comparable problems:

```typescript
// Example: Current case about offer pricing issue
const currentCase = {
  userQuery: "Offer ABC123 shows wrong price in production",
  category: "OFFER_PRICE",
  entityType: "offer",
  environment: "production"
};

// Similar cases found (with similarity scores)
const similarCases = [
  {
    userQuery: "Offer XYZ789 displays incorrect pricing",
    toolsUsed: ["getOfferPrice", "analyzeUPSOfferPriceTool", "compareOffersTool"],
    finalDiagnosis: "UPS pricing cache was stale",
    successRate: 0.9,
    similarityScore: 0.85
  },
  {
    userQuery: "Price mismatch for offer DEF456 in prod",
    toolsUsed: ["getOfferPrice", "fetchEntityHistory"],
    finalDiagnosis: "Recent configuration change broke pricing",
    successRate: 0.8,
    similarityScore: 0.78
  }
];

// System learns: "For pricing issues, start with getOfferPrice and analyzeUPSOfferPriceTool"
```

### 2. **Tool Prioritization** - "Which tools are most likely to help?"

Similar cases help rank tools by their historical effectiveness:

```typescript
class SimilarCaseAnalyzer {
  analyzeToolEffectiveness(similarCases: DiagnosticCase[]): ToolRanking[] {
    const toolStats = new Map<string, { successes: number, total: number }>();
    
    similarCases.forEach(case => {
      case.toolsUsed.forEach(tool => {
        const stats = toolStats.get(tool) || { successes: 0, total: 0 };
        stats.total++;
        if (case.successRate > 0.7) stats.successes++;
        toolStats.set(tool, stats);
      });
    });
    
    return Array.from(toolStats.entries())
      .map(([tool, stats]) => ({
        toolName: tool,
        effectivenessScore: stats.successes / stats.total,
        usageCount: stats.total
      }))
      .sort((a, b) => b.effectivenessScore - a.effectivenessScore);
  }
}

// Result: Prioritized tool list based on what worked for similar cases
// [
//   { toolName: "getOfferPrice", effectivenessScore: 0.95, usageCount: 20 },
//   { toolName: "analyzeUPSOfferPriceTool", effectivenessScore: 0.85, usageCount: 18 },
//   { toolName: "compareOffersTool", effectivenessScore: 0.60, usageCount: 12 }
// ]
```

### 3. **Error Pattern Recognition** - "What symptoms indicate what problems?"

Similar cases help identify diagnostic patterns from symptoms:

```typescript
class ErrorPatternMatcher {
  identifyLikelyRootCauses(currentCase: AgentState, similarCases: DiagnosticCase[]): RootCausePrediction[] {
    const errorPatterns = similarCases.map(case => ({
      symptoms: this.extractSymptoms(case),
      rootCause: case.finalDiagnosis,
      confidence: case.successRate
    }));
    
    const currentSymptoms = this.extractSymptoms(currentCase);
    
    return errorPatterns
      .filter(pattern => this.symptomsMatch(currentSymptoms, pattern.symptoms))
      .map(pattern => ({
        rootCause: pattern.rootCause,
        likelihood: pattern.confidence,
        reasoning: `Similar to ${pattern.symptoms.length} previous cases`
      }))
      .sort((a, b) => b.likelihood - a.likelihood);
  }
  
  private extractSymptoms(case: any): string[] {
    const symptoms = [];
    
    // Extract from user query
    if (case.userQuery?.includes('wrong price')) symptoms.push('incorrect_pricing');
    if (case.userQuery?.includes('not showing')) symptoms.push('display_issue');
    
    // Extract from error logs
    if (case.datadogLogs?.errors?.some(e => e.includes('UPS'))) {
      symptoms.push('ups_service_error');
    }
    
    // Extract from entity history
    if (case.entityHistory?.recentChanges?.length > 0) {
      symptoms.push('recent_configuration_change');
    }
    
    return symptoms;
  }
}

// Example output:
// [
//   {
//     rootCause: "UPS pricing cache was stale",
//     likelihood: 0.85,
//     reasoning: "Similar to 8 previous cases with UPS service errors"
//   },
//   {
//     rootCause: "Recent configuration change broke pricing",
//     likelihood: 0.72,
//     reasoning: "Similar to 5 previous cases with recent config changes"
//   }
// ]
```

### 4. **Contextual Prompting** - "Enhanced AI analysis with historical context"

Similar cases provide context to AI analysis tools:

```typescript
// Enhanced analysis with historical context
async function analyzeWithSimilarCaseContext(
  currentData: any, 
  similarCases: DiagnosticCase[]
): Promise<string> {
  
  const historicalContext = similarCases.map(case => ({
    problem: case.userQuery,
    solution: case.finalDiagnosis,
    toolsUsed: case.toolsUsed,
    successRate: case.successRate
  }));
  
  const prompt = `
    Analyze this current diagnostic data:
    ${JSON.stringify(currentData, null, 2)}
    
    Historical context from similar cases:
    ${historicalContext.map(ctx => `
      Problem: ${ctx.problem}
      Solution: ${ctx.solution}
      Success Rate: ${ctx.successRate}
    `).join('\n')}
    
    Based on the historical patterns, what is the most likely root cause and solution?
    Focus on solutions that have worked well (high success rate) for similar problems.
  `;
  
  return await callLLM(prompt);
}
```

### 5. **Adaptive Workflow** - "Optimize parallel execution"

Similar cases help optimize the diagnostic workflow, especially important for resource optimization in parallel execution:

```typescript
class AdaptiveWorkflowManager {
  optimizeWorkflow(currentCase: AgentState, similarCases: DiagnosticCase[]): WorkflowPlan {
    const commonPatterns = this.analyzeWorkflowPatterns(similarCases);
    
    // Tiered execution strategy based on historical effectiveness
    const toolRankings = this.rankToolsByEffectiveness(similarCases);
    
    return {
      tier1Tools: toolRankings.filter(t => t.effectivenessScore > 0.8), // High confidence
      tier2Tools: toolRankings.filter(t => t.effectivenessScore >= 0.5 && t.effectivenessScore <= 0.8), // Medium
      tier3Tools: toolRankings.filter(t => t.effectivenessScore < 0.5), // Low confidence
      executionStrategy: 'tiered_parallel',
      reasoning: 'Optimized based on historical tool effectiveness for similar cases'
    };
  }
  
  // Enhanced parallel execution with resource optimization
  async executeAdaptiveParallel(plan: WorkflowPlan, state: AgentState): Promise<ToolResults> {
    // Phase 1: Execute high-confidence tools immediately
    const tier1Promises = plan.tier1Tools.map(tool => 
      this.executeTool(tool.toolName, state)
    );
    
    // Phase 2: Execute medium-confidence tools with slight delay for resource management
    const tier2Promises = plan.tier2Tools.map(tool => 
      this.delayedExecute(tool.toolName, state, 1000) // 1s delay
    );
    
    // Phase 3: Only execute low-confidence tools if others don't provide clear results
    const tier3Promises = plan.tier3Tools.map(tool => 
      this.conditionalExecute(tool.toolName, state, tier1Promises)
    );
    
    return Promise.allSettled([
      ...tier1Promises,
      ...tier2Promises, 
      ...tier3Promises
    ]);
  }
  
  private async conditionalExecute(
    toolName: string,
    state: AgentState,
    primaryPromises: Promise<any>[]
  ): Promise<ToolResult> {
    // Wait for high-confidence tools to complete
    const primaryResults = await Promise.allSettled(primaryPromises);
    
    // Only execute if primary tools didn't provide sufficient results
    if (!this.hasSufficientResults(primaryResults)) {
      return this.executeTool(toolName, state);
    }
    
    return { 
      toolName, 
      skipped: true, 
      reason: 'High-confidence tools provided sufficient results',
      resourcesSaved: this.calculateResourceSavings(toolName)
    };
  }
  
  private analyzeWorkflowPatterns(similarCases: DiagnosticCase[]): WorkflowPattern[] {
    const patterns = new Map<string, { count: number, successes: number, avgCost: number }>();
    
    similarCases.forEach(case => {
      const toolSignature = case.toolsUsed.sort().join(',');
      const pattern = patterns.get(toolSignature) || { count: 0, successes: 0, avgCost: 0 };
      pattern.count++;
      if (case.successRate > 0.7) pattern.successes++;
      pattern.avgCost += this.calculateToolCosts(case.toolsUsed);
      patterns.set(toolSignature, pattern);
    });
    
    return Array.from(patterns.entries()).map(([signature, stats]) => ({
      tools: signature.split(','),
      toolCount: signature.split(',').length,
      frequency: stats.count / similarCases.length,
      successRate: stats.successes / stats.count,
      avgCost: stats.avgCost / stats.count,
      efficiency: (stats.successes / stats.count) / (stats.avgCost / stats.count) // Success per cost unit
    }));
  }
}
```

### 6. **Confidence Scoring** - "How sure are we about this approach?"

Similar cases help calculate confidence in the diagnostic approach:

```typescript
class ConfidenceCalculator {
  calculateDiagnosticConfidence(
    currentCase: AgentState, 
    similarCases: DiagnosticCase[],
    selectedTools: string[]
  ): ConfidenceScore {
    
    const factors = {
      // How many similar cases exist?
      sampleSize: Math.min(similarCases.length / 10, 1.0),
      
      // How similar are they?
      avgSimilarity: similarCases.reduce((sum, c) => sum + c.similarityScore, 0) / similarCases.length,
      
      // How successful were similar approaches?
      historicalSuccess: similarCases
        .filter(c => this.toolsOverlap(c.toolsUsed, selectedTools) > 0.5)
        .reduce((sum, c) => sum + c.successRate, 0) / similarCases.length,
      
      // How recent are the similar cases?
      recency: this.calculateRecencyScore(similarCases)
    };
    
    const overallConfidence = (
      factors.sampleSize * 0.2 +
      factors.avgSimilarity * 0.3 +
      factors.historicalSuccess * 0.4 +
      factors.recency * 0.1
    );
    
    return {
      score: overallConfidence,
      reasoning: this.generateConfidenceReasoning(factors),
      recommendations: this.generateRecommendations(factors)
    };
  }
}
```

### 7. **Resource-Optimized Result Processing** - "Quality over quantity"

Similar cases help prioritize and weight results even in parallel execution:

```typescript
class ResourceOptimizedProcessor {
  processResultsWithSimilarCaseContext(
    results: ToolResult[],
    similarCases: DiagnosticCase[]
  ): DiagnosticSummary {
    
    // Weight results based on historical effectiveness from similar cases
    const toolEffectiveness = this.calculateToolEffectiveness(similarCases);
    
    const weightedResults = results.map(result => {
      const effectiveness = toolEffectiveness.get(result.toolName) || 0.5;
      return {
        ...result,
        reliability: effectiveness,
        priority: effectiveness > 0.8 ? 'high' : effectiveness > 0.5 ? 'medium' : 'low',
        resourceCost: this.getToolCost(result.toolName)
      };
    });
    
    // Prioritize high-reliability, low-cost results
    const primaryEvidence = weightedResults
      .filter(r => r.reliability > 0.7)
      .sort((a, b) => (b.reliability / b.resourceCost) - (a.reliability / a.resourceCost));
    
    const supportingEvidence = weightedResults
      .filter(r => r.reliability <= 0.7);
    
    return {
      diagnosis: this.synthesizeDiagnosis(primaryEvidence, supportingEvidence),
      confidence: this.calculateOverallConfidence(primaryEvidence),
      resourceEfficiency: this.calculateResourceEfficiency(weightedResults),
      historicalBasis: `Based on analysis of ${similarCases.length} similar cases`
    };
  }
  
  private calculateResourceEfficiency(results: WeightedResult[]): ResourceEfficiency {
    const totalCost = results.reduce((sum, r) => sum + r.resourceCost, 0);
    const effectiveResults = results.filter(r => r.reliability > 0.6);
    const effectiveCost = effectiveResults.reduce((sum, r) => sum + r.resourceCost, 0);
    
    return {
      totalResourcesUsed: totalCost,
      effectiveResourcesUsed: effectiveCost,
      wastePercentage: ((totalCost - effectiveCost) / totalCost) * 100,
      efficiencyScore: effectiveCost / totalCost
    };
  }
} * 0.1
    );
    
    return {
      score: overallConfidence,
      reasoning: this.generateConfidenceReasoning(factors),
      recommendations: this.generateRecommendations(factors)
    };
  }
}
```

## Real-World Example: How It All Comes Together

```typescript
// Current case: "Offer XYZ123 showing $0 price in production"
const currentCase = {
  userQuery: "Offer XYZ123 showing $0 price in production",
  queryEmbedding: [0.1, 0.3, -0.2, ...], // 1536-dimensional vector
  category: "OFFER_PRICE",
  entityType: "offer",
  environment: "production"
};

// System finds 3 similar cases with high similarity scores
const similarCases = [
  {
    userQuery: "Offer ABC789 displays zero price",
    similarityScore: 0.92,
    toolsUsed: ["getOfferPrice", "analyzeUPSOfferPriceTool"],
    finalDiagnosis: "UPS service returned null price due to expired cache",
    successRate: 0.95,
    resolutionTime: 180 // seconds
  },
  // ... more similar cases
];

// System makes informed decisions:
const workflow = {
  // 1. Tool Selection: Start with tools that worked 95% of the time
  prioritizedTools: ["getOfferPrice", "analyzeUPSOfferPriceTool"],
  
  // 2. Expected Diagnosis: Prime the AI with likely root causes
  likelyRootCauses: ["UPS cache issue", "Pricing service timeout"],
  
  // 3. Confidence: High confidence due to strong historical precedent
  confidence: 0.88,
  
  // 4. Time Estimate: Similar cases resolved in ~3 minutes
  estimatedResolutionTime: 180,
  
  // 5. Fallback Plan: If primary tools fail, try these next
  fallbackTools: ["fetchEntityHistory", "compareOffersTool"]
};
```

## Implementation Changes Needed

### 1. Add Vector Embeddings to Schema
```typescript
// Enhanced DiagnosticCase model
interface DiagnosticCase {
  // ... existing fields
  queryEmbedding: number[];           // Vector representation of user query
  errorPatternEmbedding?: number[];   // Vector of error patterns found
  entityConfigEmbedding?: number[];   // Vector of entity configuration
  contextEmbedding?: number[];        // Combined context vector
}
```

### 2. Embedding Generation Service
```typescript
// New service: src/services/EmbeddingService.ts
class EmbeddingService {
  async generateQueryEmbedding(userQuery: string): Promise<number[]> {
    // Use OpenAI embeddings or similar
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userQuery
    });
    return response.data[0].embedding;
  }

  async generateContextEmbedding(state: AgentState): Promise<number[]> {
    const contextText = `
      Category: ${state.queryCategory}
      Entity: ${state.entityType} ${state.entityIds?.join(', ')}
      Environment: ${state.environment}
      Query: ${state.userQuery}
      Errors: ${JSON.stringify(state.datadogLogs?.errors || [])}
    `;
    return this.generateQueryEmbedding(contextText);
  }
}
```

### 3. Enhanced Memory Retrieval
```typescript
// Modified memoryRetrievalNode
export async function memoryRetrievalNode(state: AgentState): Promise<Partial<AgentState>> {
  const embeddingService = new EmbeddingService();
  
  // Generate embedding for current case
  const queryEmbedding = await embeddingService.generateQueryEmbedding(state.userQuery);
  
  // Find similar cases using vector search
  const similarCases = await memoryService.findSimilarCasesByEmbedding(
    queryEmbedding,
    state.queryCategory,
    0.7 // similarity threshold
  );
  
  return {
    similarCases,
    queryEmbedding,
    rlFeatures: {
      ...state.rlFeatures,
      similarCaseCount: similarCases.length,
      avgSimilarityScore: similarCases.reduce((sum, c) => sum + c.similarityScore, 0) / similarCases.length
    }
  };
}
```

## Expected Benefits & Timeline

### Immediate Benefits (Week 1-2 after implementation)
- **Cold Start Improvement**: Even with minimal historical data, semantic similarity finds more relevant cases than exact matching
- **Resource Optimization**: 40-60% reduction in unnecessary API calls and tool executions
- **Enhanced Context**: AI analysis tools receive richer historical context
- **Quality-Focused Results**: Results weighted by historical effectiveness rather than treated equally

**What to expect:**
- Diagnostic accuracy improves from ~70% to ~75-80%
- Resource consumption decreases by 40-50% (API costs, token usage)
- Result quality improves through better prioritization
- User satisfaction scores increase due to more confident diagnoses

### Short-term Benefits (1-3 months)
- **Pattern Recognition**: System identifies recurring problem patterns across different query phrasings
- **Tiered Execution**: 60-70% of cases use optimized tiered parallel execution
- **Confidence Scoring**: Users receive reliability indicators for diagnoses
- **Resource Intelligence**: System learns optimal resource allocation patterns

**What to expect:**
- Diagnostic accuracy reaches ~85%
- Resource efficiency improves by 50-60% (cost per successful diagnosis)
- 40% fewer "unknown" or inconclusive diagnoses
- Quality-weighted results reduce noise by 70%

### Long-term Benefits (3-12 months)
- **Semantic Understanding**: System recognizes similar problems described in completely different ways
- **Predictive Resource Management**: Proactive optimization of tool selection and execution
- **Domain Expertise**: System develops "intuition" similar to experienced human diagnosticians
- **Adaptive Efficiency**: Continuous optimization of resource usage patterns

**What to expect:**
- Diagnostic accuracy reaches ~90-95%
- Resource efficiency reaches 80-90% (minimal waste)
- 70% of cases resolved with optimized tiered execution
- User confidence in system recommendations reaches 85%+
- Cost per diagnosis reduced by 70-80%

### Key Performance Indicators (KPIs) to Track

**Accuracy Metrics:**
- Diagnostic success rate (user feedback)
- First-attempt resolution rate
- Confidence score correlation with actual success

**Efficiency Metrics:**
- Resource utilization efficiency (effective vs. total resource usage)
- Cost per successful diagnosis
- API call optimization rate
- Tool execution waste percentage

**User Experience Metrics:**
- User satisfaction ratings
- Follow-up question frequency
- System adoption rate among support staff

**Learning Metrics:**
- Similar case retrieval accuracy
- Pattern recognition effectiveness
- Historical context utilization rate

The similar cases essentially act as a **diagnostic knowledge base** that guides every aspect of the current case resolution, from tool selection to root cause analysis to confidence assessment.