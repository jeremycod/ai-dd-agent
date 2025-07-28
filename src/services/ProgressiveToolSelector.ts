import { logger } from '../utils';
import { AgentState } from '../model';

export interface ToolSelectionPlan {
  tier1: string[];  // High effectiveness (>70%)
  tier2: string[];  // Medium effectiveness (40-70%)
  tier3: string[];  // Low effectiveness (<40%)
}

export interface ToolStats {
  toolName: string;
  effectivenessScore: number;
  usageCount: number;
}

export interface EnhancedDiagnosticCase {
  caseId: string;
  category: string;
  entityType: string;
  environment: string;
  toolContributions: {
    [toolName: string]: {
      contributionScore: number;
      relevanceScore: number;
      wasUseful: boolean;
      reasoning: string[];
    };
  };
}

export class ProgressiveToolSelector {
  private readonly ALL_TOOLS = [
    'fetchDatadogLogs',
    'fetchEntityHistory', 
    'fetchGenieOffer',
    'fetchOfferServiceOffer',
    'fetchUPSOfferPrice',
    'analyzeDatadogErrorsTool',
    'analyzeDatadogWarningsTool',
    'analyzeEntityHistoryTool',
    'analyzeUPSOfferPriceTool',
    'compareOffersTool'
  ];

  async selectToolsForCase(
    state: AgentState, 
    similarCases: EnhancedDiagnosticCase[]
  ): Promise<ToolSelectionPlan> {
    
    if (similarCases.length === 0) {
      logger.info('[ProgressiveToolSelector] No historical data - running all tools');
      return { 
        tier1: this.ALL_TOOLS, 
        tier2: [], 
        tier3: [] 
      };
    }
    
    // Calculate tool effectiveness from similar cases
    const toolStats = this.calculateToolStats(similarCases);
    
    const plan: ToolSelectionPlan = {
      tier1: toolStats.filter(t => t.effectivenessScore > 0.7).map(t => t.toolName),
      tier2: toolStats.filter(t => t.effectivenessScore >= 0.4 && t.effectivenessScore <= 0.7).map(t => t.toolName),
      tier3: toolStats.filter(t => t.effectivenessScore < 0.4).map(t => t.toolName)
    };

    // Ensure all tools are included somewhere
    const allSelectedTools = [...plan.tier1, ...plan.tier2, ...plan.tier3];
    const missingTools = this.ALL_TOOLS.filter(tool => !allSelectedTools.includes(tool));
    plan.tier2.push(...missingTools);

    logger.info('[ProgressiveToolSelector] Tool selection plan: %j', {
      tier1Count: plan.tier1.length,
      tier2Count: plan.tier2.length, 
      tier3Count: plan.tier3.length,
      basedOnCases: similarCases.length
    });
    
    return plan;
  }
  
  private calculateToolStats(cases: EnhancedDiagnosticCase[]): ToolStats[] {
    const toolMap = new Map<string, { useful: number, total: number }>();
    
    cases.forEach(diagnosticCase => {
      Object.entries(diagnosticCase.toolContributions || {}).forEach(([toolName, contribution]) => {
        const stats = toolMap.get(toolName) || { useful: 0, total: 0 };
        stats.total++;
        if (contribution.wasUseful) {
          stats.useful++;
        }
        toolMap.set(toolName, stats);
      });
    });
    
    const toolStats = Array.from(toolMap.entries()).map(([toolName, stats]) => ({
      toolName,
      effectivenessScore: stats.total > 0 ? stats.useful / stats.total : 0.5,
      usageCount: stats.total
    }));

    // Sort by effectiveness score descending
    toolStats.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

    logger.info('[ProgressiveToolSelector] Tool effectiveness stats: %j', 
      toolStats.map(t => ({ 
        tool: t.toolName, 
        effectiveness: Math.round(t.effectivenessScore * 100) + '%',
        usage: t.usageCount 
      }))
    );

    return toolStats;
  }

  getRecommendedExecutionStrategy(plan: ToolSelectionPlan): string {
    if (plan.tier1.length >= 6) {
      return 'parallel_all'; // Most tools are effective, run in parallel
    } else if (plan.tier1.length >= 3) {
      return 'tiered_parallel'; // Some clear winners, use tiered approach
    } else {
      return 'sequential_validation'; // Few effective tools, validate results before proceeding
    }
  }
}