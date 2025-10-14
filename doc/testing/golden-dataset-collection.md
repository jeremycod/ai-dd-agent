# Golden Dataset Collection Strategy

## 🎯 Goal: Build High-Quality Test Dataset

Create a curated dataset of query-response pairs with known correct answers for LLM quality testing.

## 📊 Data Collection Methods

### **1. Production Data Mining (Easiest & Most Valuable)**

Extract high-quality cases from production with positive user feedback:

```typescript
// scripts/collectGoldenDataset.ts
class GoldenDatasetCollector {
  async collectFromProduction(): Promise<GoldenDatasetEntry[]> {
    // Find cases with high user satisfaction
    const highQualityCases = await storage.findCases({
      overallRlReward: { $gte: 0.8 },
      'messageFeedbacks': {
        $elemMatch: {
          type: 'positive',
          rating: { $gte: 4 }
        }
      },
      finalSummary: { $exists: true, $ne: '' }
    });

    const goldenEntries = [];

    for (const case of highQualityCases) {
      const entry = {
        id: `prod_${case.caseId}`,
        query: case.userQuery,
        context: {
          category: case.category,
          entityType: case.entityType,
          entityIds: case.entityIds,
          environment: case.environment,
          toolsUsed: case.toolsUsed,
          dataForSummaryPrompt: case.dataForSummaryPrompt
        },
        expectedResponse: case.finalSummary,
        groundTruth: {
          category: case.category,
          toolsUsed: case.toolsUsed,
          entityIds: case.entityIds,
          userSatisfaction: this.extractUserSatisfaction(case.messageFeedbacks)
        },
        qualityThresholds: {
          relevance: 0.85,
          accuracy: 0.9,
          completeness: 0.85,
          hallucination: 0.1
        },
        source: 'production',
        collectedAt: new Date(),
        userFeedback: case.messageFeedbacks
      };

      goldenEntries.push(entry);
    }

    return goldenEntries;
  }
}

// Usage
const collector = new GoldenDatasetCollector();
const productionGoldenData = await collector.collectFromProduction();
console.log(`Collected ${productionGoldenData.length} golden entries from production`);
```

### **2. Expert Annotation (High Quality)**

Have domain experts create ideal query-response pairs:

```typescript
// scripts/expertAnnotation.ts
interface ExpertAnnotationTemplate {
  scenario: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: QueryCategory;
  query: string;
  context: any;
  idealResponse: string;
  keyElements: string[];
  commonMistakes: string[];
}

const expertTemplates: ExpertAnnotationTemplate[] = [
  {
    scenario: 'offer_status_check',
    difficulty: 'easy',
    category: 'ENTITY_STATUS',
    query: 'Why is offer ABC-123 not showing in production?',
    context: {
      genieOffer: { id: 'ABC-123', status: 'INACTIVE', reason: 'CONFIG_ERROR' },
      datadogLogs: [{ level: 'ERROR', message: 'Config validation failed for ABC-123' }]
    },
    idealResponse: `Offer ABC-123 is currently **inactive** in production due to a configuration validation error. 

**Root Cause:** Configuration validation failure
**Status:** INACTIVE
**Environment:** Production

**Recommended Actions:**
1. Review offer configuration in the management system
2. Fix validation errors
3. Re-enable the offer once configuration is corrected`,
    keyElements: ['ABC-123', 'inactive', 'configuration', 'validation', 'error'],
    commonMistakes: ['hallucinating specific config values', 'not mentioning offer ID', 'vague recommendations']
  }
];

class ExpertAnnotationCollector {
  async generateFromTemplates(): Promise<GoldenDatasetEntry[]> {
    return expertTemplates.map(template => ({
      id: `expert_${template.scenario}`,
      query: template.query,
      context: template.context,
      expectedResponse: template.idealResponse,
      expectedElements: template.keyElements,
      groundTruth: {
        category: template.category,
        difficulty: template.difficulty,
        keyElements: template.keyElements
      },
      qualityThresholds: {
        relevance: template.difficulty === 'easy' ? 0.9 : 0.85,
        accuracy: 0.95,
        completeness: 0.9,
        hallucination: 0.05
      },
      source: 'expert_annotation',
      metadata: {
        commonMistakes: template.commonMistakes,
        difficulty: template.difficulty
      }
    }));
  }
}
```

### **3. Synthetic Data Generation (Scalable)**

Generate diverse test cases programmatically:

```typescript
// scripts/syntheticDataGeneration.ts
class SyntheticDataGenerator {
  private entityIds = ['ABC-123', 'XYZ-789', 'DEF-456', 'GHI-012'];
  private environments = ['production', 'staging', 'development'];
  private issueTypes = ['configuration', 'pricing', 'status', 'data_inconsistency'];

  async generateSyntheticDataset(count: number): Promise<GoldenDatasetEntry[]> {
    const entries = [];

    for (let i = 0; i < count; i++) {
      const entityId = this.randomChoice(this.entityIds);
      const environment = this.randomChoice(this.environments);
      const issueType = this.randomChoice(this.issueTypes);

      const entry = await this.generateEntry(entityId, environment, issueType, i);
      entries.push(entry);
    }

    return entries;
  }

  private async generateEntry(
    entityId: string, 
    environment: string, 
    issueType: string, 
    index: number
  ): Promise<GoldenDatasetEntry> {
    const templates = {
      configuration: {
        query: `Why is offer ${entityId} not working in ${environment}?`,
        context: {
          genieOffer: { id: entityId, status: 'INACTIVE', reason: 'CONFIG_ERROR' },
          datadogLogs: [{ level: 'ERROR', message: `Config validation failed for ${entityId}` }]
        },
        expectedResponse: `Offer ${entityId} is inactive in ${environment} due to configuration validation errors.`,
        category: 'ENTITY_STATUS'
      },
      pricing: {
        query: `What's the price of offer ${entityId} in ${environment}?`,
        context: {
          upsOfferPrice: { offerId: entityId, price: 9.99, currency: 'USD' },
          genieOffer: { id: entityId, status: 'ACTIVE' }
        },
        expectedResponse: `Offer ${entityId} is priced at $9.99 USD in ${environment}.`,
        category: 'OFFER_PRICE'
      }
    };

    const template = templates[issueType] || templates.configuration;

    return {
      id: `synthetic_${index}`,
      query: template.query,
      context: template.context,
      expectedResponse: template.expectedResponse,
      groundTruth: {
        category: template.category,
        entityId,
        environment,
        issueType
      },
      qualityThresholds: {
        relevance: 0.8,
        accuracy: 0.85,
        completeness: 0.8,
        hallucination: 0.15
      },
      source: 'synthetic'
    };
  }

  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}
```

### **4. User Session Mining (Real Behavior)**

Extract patterns from actual user interactions:

```typescript
// scripts/userSessionMining.ts
class UserSessionMiner {
  async mineSuccessfulSessions(): Promise<GoldenDatasetEntry[]> {
    // Find complete user sessions that ended successfully
    const successfulSessions = await storage.findSessions({
      status: 'RESOLVED',
      userSatisfaction: { $gte: 4 },
      turnCount: { $gte: 2, $lte: 5 } // Multi-turn but not too long
    });

    const goldenEntries = [];

    for (const session of successfulSessions) {
      // Extract the key query-response pair that led to resolution
      const resolutionTurn = session.turns.find(turn => 
        turn.outcome === 'RESOLVED' && turn.userFeedback?.type === 'positive'
      );

      if (resolutionTurn) {
        goldenEntries.push({
          id: `session_${session.sessionId}_${resolutionTurn.turnId}`,
          query: resolutionTurn.userQuery,
          context: {
            sessionHistory: session.turns.slice(0, -1), // Previous context
            resolvedData: resolutionTurn.collectedData
          },
          expectedResponse: resolutionTurn.response,
          groundTruth: {
            category: resolutionTurn.category,
            resolutionPath: session.turns.map(t => t.action),
            userSatisfaction: session.userSatisfaction
          },
          qualityThresholds: {
            relevance: 0.85,
            accuracy: 0.9,
            completeness: 0.85,
            hallucination: 0.1
          },
          source: 'user_session',
          metadata: {
            sessionLength: session.turnCount,
            resolutionTime: session.resolutionTime
          }
        });
      }
    }

    return goldenEntries;
  }
}
```

### **5. Edge Case Collection (Robustness)**

Collect challenging cases for robustness testing:

```typescript
// scripts/edgeCaseCollection.ts
class EdgeCaseCollector {
  async collectEdgeCases(): Promise<GoldenDatasetEntry[]> {
    const edgeCases = [
      // Ambiguous queries
      {
        query: 'Something is broken',
        expectedBehavior: 'request_clarification',
        expectedElements: ['clarification', 'specific', 'information']
      },
      // Multiple entities
      {
        query: 'Compare offers ABC-123 and XYZ-789 pricing',
        expectedBehavior: 'multi_entity_analysis',
        expectedElements: ['ABC-123', 'XYZ-789', 'comparison', 'pricing']
      },
      // Non-existent entities
      {
        query: 'Check offer NONEXISTENT-999 status',
        expectedBehavior: 'entity_not_found',
        expectedElements: ['not found', 'verify', 'entity ID']
      },
      // Complex multi-step queries
      {
        query: 'Why is offer ABC-123 showing different prices in staging vs production and how do I fix it?',
        expectedBehavior: 'complex_analysis',
        expectedElements: ['ABC-123', 'staging', 'production', 'price difference', 'resolution steps']
      }
    ];

    return edgeCases.map((edgeCase, index) => ({
      id: `edge_case_${index}`,
      query: edgeCase.query,
      context: {},
      expectedBehavior: edgeCase.expectedBehavior,
      expectedElements: edgeCase.expectedElements,
      groundTruth: {
        category: 'EDGE_CASE',
        expectedBehavior: edgeCase.expectedBehavior
      },
      qualityThresholds: {
        relevance: 0.7, // Lower threshold for edge cases
        accuracy: 0.8,
        completeness: 0.7,
        hallucination: 0.2
      },
      source: 'edge_case_collection'
    }));
  }
}
```

## 🔄 Automated Collection Pipeline

```typescript
// scripts/goldenDatasetPipeline.ts
class GoldenDatasetPipeline {
  async buildCompleteDataset(): Promise<GoldenDataset> {
    console.log('🚀 Starting Golden Dataset Collection...');

    // 1. Production data (highest quality)
    console.log('📊 Collecting from production...');
    const productionData = await new GoldenDatasetCollector().collectFromProduction();
    console.log(`✅ Collected ${productionData.length} production entries`);

    // 2. Expert annotations (high quality, specific scenarios)
    console.log('👨‍💼 Generating expert annotations...');
    const expertData = await new ExpertAnnotationCollector().generateFromTemplates();
    console.log(`✅ Generated ${expertData.length} expert entries`);

    // 3. Synthetic data (volume and coverage)
    console.log('🤖 Generating synthetic data...');
    const syntheticData = await new SyntheticDataGenerator().generateSyntheticDataset(50);
    console.log(`✅ Generated ${syntheticData.length} synthetic entries`);

    // 4. User session mining (real behavior patterns)
    console.log('👥 Mining user sessions...');
    const sessionData = await new UserSessionMiner().mineSuccessfulSessions();
    console.log(`✅ Mined ${sessionData.length} session entries`);

    // 5. Edge cases (robustness testing)
    console.log('⚠️ Collecting edge cases...');
    const edgeCaseData = await new EdgeCaseCollector().collectEdgeCases();
    console.log(`✅ Collected ${edgeCaseData.length} edge case entries`);

    // Combine and deduplicate
    const allEntries = [
      ...productionData,
      ...expertData,
      ...syntheticData,
      ...sessionData,
      ...edgeCaseData
    ];

    const deduplicatedEntries = this.deduplicateEntries(allEntries);

    // Quality validation
    const validatedEntries = await this.validateEntries(deduplicatedEntries);

    const dataset = {
      entries: validatedEntries,
      metadata: {
        totalEntries: validatedEntries.length,
        sources: {
          production: productionData.length,
          expert: expertData.length,
          synthetic: syntheticData.length,
          sessions: sessionData.length,
          edgeCases: edgeCaseData.length
        },
        createdAt: new Date(),
        version: '1.0.0'
      }
    };

    // Save dataset
    await this.saveDataset(dataset);
    console.log(`🎉 Golden Dataset created with ${dataset.entries.length} entries`);

    return dataset;
  }

  private deduplicateEntries(entries: GoldenDatasetEntry[]): GoldenDatasetEntry[] {
    const seen = new Set();
    return entries.filter(entry => {
      const key = `${entry.query.toLowerCase().trim()}_${entry.context?.category || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async validateEntries(entries: GoldenDatasetEntry[]): Promise<GoldenDatasetEntry[]> {
    return entries.filter(entry => {
      // Basic validation
      if (!entry.query || entry.query.length < 10) return false;
      if (!entry.expectedResponse && !entry.expectedBehavior) return false;
      if (!entry.groundTruth) return false;
      return true;
    });
  }

  private async saveDataset(dataset: GoldenDataset): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(
      'tests/e2e/fixtures/golden-dataset.json',
      JSON.stringify(dataset, null, 2)
    );
  }
}
```

## 📋 Collection Checklist

### **Phase 1: Quick Start (1-2 days)**
- [ ] Set up production data mining script
- [ ] Extract 20-30 high-quality production cases
- [ ] Create 10-15 expert-annotated examples
- [ ] Validate and format initial dataset

### **Phase 2: Scale Up (1 week)**
- [ ] Implement synthetic data generation
- [ ] Mine user session data
- [ ] Collect edge cases and adversarial examples
- [ ] Build automated collection pipeline

### **Phase 3: Continuous Collection (Ongoing)**
- [ ] Set up automated weekly collection
- [ ] Implement quality validation pipeline
- [ ] Create dataset versioning system
- [ ] Monitor dataset performance metrics

## 🎯 Target Dataset Composition

| Source | Count | Purpose | Quality |
|--------|-------|---------|---------|
| **Production** | 30-50 | Real user satisfaction | Highest |
| **Expert** | 20-30 | Ideal responses | Highest |
| **Synthetic** | 50-100 | Coverage & volume | Medium |
| **Sessions** | 20-40 | Real behavior patterns | High |
| **Edge Cases** | 15-25 | Robustness testing | Medium |
| **Total** | 135-245 | Comprehensive coverage | Mixed |

## 🚀 Quick Implementation

```bash
# Run the collection pipeline
npm run collect-golden-dataset

# Validate the dataset
npm run validate-golden-dataset

# Run golden dataset tests
npm run test:golden-dataset
```

This approach gives you a high-quality, diverse dataset with minimal manual effort while ensuring comprehensive coverage of your AI diagnostic assistant's capabilities.