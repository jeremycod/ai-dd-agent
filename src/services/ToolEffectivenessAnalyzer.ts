import { logger } from '../utils';

export interface ToolContribution {
  toolName: string;
  contributionScore: number;
  reasoning: string[];
  wasUsefulForDiagnosis: boolean;
}

export class ToolEffectivenessAnalyzer {
  analyzeToolContribution(toolResult: any, toolName: string): ToolContribution {
    let score = 0;
    const reasoning: string[] = [];

    // Data quality indicators
    if (toolResult && Object.keys(toolResult).length > 0) {
      score += 0.3;
      reasoning.push('returned_data');
    }

    // Error indicators (negative)
    if (toolResult?.errors?.length > 0) {
      score -= 0.2;
      reasoning.push('had_errors');
    }

    // Tool-specific value indicators
    score += this.analyzeToolSpecificValue(toolResult, toolName, reasoning);

    const contributionScore = Math.max(0, Math.min(1, score));
    
    logger.info('[ToolEffectivenessAnalyzer] Tool %s contribution score: %f', toolName, contributionScore);

    return {
      toolName,
      contributionScore,
      reasoning,
      wasUsefulForDiagnosis: contributionScore > 0.4
    };
  }

  private analyzeToolSpecificValue(toolResult: any, toolName: string, reasoning: string[]): number {
    let score = 0;

    switch (toolName) {
      case 'fetchDatadogLogs':
        if (toolResult?.logs?.some((log: any) => log.status === 'error')) {
          score += 0.4;
          reasoning.push('found_errors');
        }
        if (toolResult?.logs?.length > 0) {
          score += 0.2;
          reasoning.push('retrieved_logs');
        }
        break;
      
      case 'getOfferPrice':
        if (toolResult?.price !== null && toolResult?.price !== undefined) {
          score += 0.5;
          reasoning.push('retrieved_price');
        }
        if (toolResult?.currency) {
          score += 0.1;
          reasoning.push('has_currency');
        }
        break;
        
      case 'analyzeUPSOfferPriceTool':
        if (toolResult?.analysis?.includes('issue') || toolResult?.analysis?.includes('problem')) {
          score += 0.6;
          reasoning.push('identified_issue');
        }
        if (toolResult?.recommendations?.length > 0) {
          score += 0.3;
          reasoning.push('provided_recommendations');
        }
        break;

      case 'fetchGenieOffer':
        if (toolResult?.offer?.id) {
          score += 0.4;
          reasoning.push('retrieved_offer');
        }
        if (toolResult?.offer?.status) {
          score += 0.2;
          reasoning.push('has_status');
        }
        break;

      case 'fetchEntityHistory':
        if (toolResult?.history?.length > 0) {
          score += 0.3;
          reasoning.push('found_history');
        }
        if (toolResult?.recentChanges?.length > 0) {
          score += 0.4;
          reasoning.push('found_recent_changes');
        }
        break;

      case 'compareOffersTool':
        if (toolResult?.differences?.length > 0) {
          score += 0.5;
          reasoning.push('found_differences');
        }
        if (toolResult?.inconsistencies?.length > 0) {
          score += 0.4;
          reasoning.push('found_inconsistencies');
        }
        break;

      default:
        // Generic scoring for unknown tools
        if (toolResult?.analysis || toolResult?.summary) {
          score += 0.3;
          reasoning.push('provided_analysis');
        }
        break;
    }

    return score;
  }
}