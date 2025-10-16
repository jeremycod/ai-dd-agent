import { logger } from '../utils';

export interface ToolContribution {
  toolName: string;
  contributionScore: number;
  reasoning: string[];
  wasUsefulForDiagnosis: boolean;
}

export class ToolEffectivenessAnalyzer {
  analyzeToolContribution(
    toolResult: any, 
    toolName: string, 
    finalDiagnosis?: string,
    userFeedback?: { rating?: number; type?: string }
  ): ToolContribution {
    let score = 0;
    const reasoning: string[] = [];


    const dataQualityScore = this.calculateDataQuality(toolResult, toolName, reasoning);
    score += dataQualityScore * 0.3;


    const relevanceScore = this.calculateRelevanceToFinalDiagnosis(
      toolResult, toolName, finalDiagnosis, reasoning
    );
    score += relevanceScore * 0.5;


    const feedbackScore = this.calculateFeedbackCorrelation(
      toolResult, toolName, userFeedback, reasoning
    );
    score += feedbackScore * 0.2;

    const contributionScore = Math.max(0, Math.min(1, score));
    
    logger.info('[ToolEffectivenessAnalyzer] Tool %s contribution score: %f (relevance: %f, quality: %f, feedback: %f)', 
      toolName, contributionScore, relevanceScore, dataQualityScore, feedbackScore);

    return {
      toolName,
      contributionScore,
      reasoning,
      wasUsefulForDiagnosis: contributionScore > 0.5
    };
  }

  private calculateDataQuality(toolResult: any, toolName: string, reasoning: string[]): number {

    
    if (!toolResult) {
      reasoning.push('no_data_returned');
      return 0;
    }
    

    if (typeof toolResult === 'string') {
      if (toolResult.trim().length === 0) {
        reasoning.push('empty_string_result');
        return 0.1;
      }
      if (toolResult.toLowerCase().includes('no') && toolResult.toLowerCase().includes('found')) {
        reasoning.push('no_results_found');
        return 0.2;
      }
      if (toolResult.length > 50) {
        reasoning.push('substantial_string_result');
        return 0.8;
      }
      reasoning.push('basic_string_result');
      return 0.6;
    }
    

    if (typeof toolResult === 'object' && Object.keys(toolResult).length === 0) {
      reasoning.push('empty_object_returned');
      return 0.1;
    }


    if (toolResult?.errors?.length > 0) {
      reasoning.push('had_errors');
      return 0.2;
    }

    return this.analyzeToolSpecificDataQuality(toolResult, toolName, reasoning);
  }

  private analyzeToolSpecificDataQuality(toolResult: any, toolName: string, reasoning: string[]): number {
    let score = 0;

    switch (toolName) {
      case 'fetchDatadogLogs':
        if (toolResult?.logs?.some((log: any) => log.status === 'error')) {
          score += 0.6;
          reasoning.push('found_error_logs');
        } else if (toolResult?.logs?.length > 0) {
          score += 0.4;
          reasoning.push('retrieved_logs_no_errors');
        } else {
          score += 0.1;
          reasoning.push('no_relevant_logs');
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

        if (toolResult?.analysis || toolResult?.summary) {
          score += 0.3;
          reasoning.push('provided_analysis');
        }
        break;
    }

    return score;
  }

  private calculateRelevanceToFinalDiagnosis(
    toolResult: any, 
    toolName: string, 
    finalDiagnosis?: string, 
    reasoning: string[] = []
  ): number {

    
    if (!finalDiagnosis || finalDiagnosis.trim().length === 0) {
      reasoning.push('no_final_diagnosis_available');
      return 0.5;
    }
    
    if (!toolResult) {
      reasoning.push('no_tool_result_to_compare');
      return 0;
    }

    const diagnosisLower = finalDiagnosis.toLowerCase();
    let relevanceScore = 0;
    

    const toolResultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult);
    const toolResultLower = toolResultText.toLowerCase();


    switch (toolName) {
      case 'fetchDatadogLogs':
      case 'analyzeDatadogErrorsTool':
        if (diagnosisLower.includes('error') || diagnosisLower.includes('log') || 
            diagnosisLower.includes('exception')) {
          relevanceScore = 0.9;
          reasoning.push('errors_mentioned_in_diagnosis');
        }
        break;

      case 'getOfferPrice':
      case 'analyzeUPSOfferPriceTool':
        if (diagnosisLower.includes('price') || diagnosisLower.includes('pricing') || 
            diagnosisLower.includes('ups') || diagnosisLower.includes('cost')) {
          relevanceScore = 0.9;
          reasoning.push('pricing_mentioned_in_diagnosis');
        }
        break;

      case 'fetchEntityHistory':
        if (diagnosisLower.includes('change') || diagnosisLower.includes('modified') || 
            diagnosisLower.includes('updated') || diagnosisLower.includes('history')) {
          relevanceScore = 0.8;
          reasoning.push('changes_mentioned_in_diagnosis');
        }
        break;

      case 'fetchGenieOffer':
      case 'fetchOfferServiceOffer':
        if (diagnosisLower.includes('offer') || diagnosisLower.includes('genie') || 
            diagnosisLower.includes('service')) {
          relevanceScore = 0.7;
          reasoning.push('offer_data_mentioned_in_diagnosis');
        }
        break;

      default:

        if (toolResult.analysis && diagnosisLower.includes(toolResult.analysis.toLowerCase().substring(0, 50))) {
          relevanceScore = 0.6;
          reasoning.push('tool_analysis_referenced');
        }
    }


    if (toolResult.entityId && diagnosisLower.includes(toolResult.entityId.toLowerCase())) {
      relevanceScore = Math.max(relevanceScore, 0.7);
      reasoning.push('entity_id_referenced');
    }
    

    if (typeof toolResult === 'string' && toolResult.length > 20) {
      const toolWords = toolResult.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      const diagnosisWords = diagnosisLower.split(/\s+/);
      
      const commonWords = toolWords.filter(word => diagnosisWords.includes(word));
      if (commonWords.length > 2) {
        const overlapScore = Math.min(0.8, commonWords.length * 0.1);
        relevanceScore = Math.max(relevanceScore, overlapScore);
        reasoning.push(`text_overlap_${commonWords.length}_words`);
      }
    }
    
    return relevanceScore;
  }

  private calculateFeedbackCorrelation(
    toolResult: any, 
    toolName: string, 
    userFeedback?: { rating?: number; type?: string },
    reasoning: string[] = []
  ): number {
    if (!userFeedback) {
      return 0.5;
    }


    if (userFeedback.type === 'positive' || (userFeedback.rating && userFeedback.rating >= 4)) {
      reasoning.push('positive_user_feedback');
      return 0.8;
    }


    if (userFeedback.type === 'negative' || (userFeedback.rating && userFeedback.rating <= 2)) {

      if (this.toolFoundIssues(toolResult, toolName)) {
        reasoning.push('found_issues_despite_negative_feedback');
        return 0.6;
      }
      reasoning.push('negative_user_feedback');
      return 0.2;
    }

    return 0.5;
  }

  private toolFoundIssues(toolResult: any, toolName: string): boolean {
    switch (toolName) {
      case 'analyzeDatadogErrorsTool':
        return toolResult?.includes('error') || toolResult?.includes('exception');
      case 'analyzeUPSOfferPriceTool':
        return toolResult?.includes('issue') || toolResult?.includes('problem');
      case 'compareOffersTool':
        return toolResult?.differences?.length > 0 || toolResult?.inconsistencies?.length > 0;
      default:
        return false;
    }
  }
}