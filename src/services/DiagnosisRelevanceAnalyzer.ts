import { logger } from '../utils';

export interface ToolRelevance {
  toolName: string;
  relevanceScore: number;
  wasReferencedInDiagnosis: boolean;
  keywordMatches: string[];
}

export interface ToolResult {
  toolName: string;
  [key: string]: any;
}

export class DiagnosisRelevanceAnalyzer {
  analyzeToolRelevanceInDiagnosis(finalSummary: string, toolResults: ToolResult[]): ToolRelevance[] {
    if (!finalSummary) {
      return toolResults.map(result => ({
        toolName: result.toolName,
        relevanceScore: 0,
        wasReferencedInDiagnosis: false,
        keywordMatches: []
      }));
    }

    return toolResults.map(result => {
      const relevanceScore = this.calculateRelevanceScore(finalSummary, result);
      const keywordMatches = this.findKeywordMatches(finalSummary, result);
      
      logger.info('[DiagnosisRelevanceAnalyzer] Tool %s relevance score: %f', result.toolName, relevanceScore);
      
      return {
        toolName: result.toolName,
        relevanceScore,
        wasReferencedInDiagnosis: relevanceScore > 0.3,
        keywordMatches
      };
    });
  }

  private calculateRelevanceScore(summary: string, toolResult: ToolResult): number {
    let score = 0;
    const summaryLower = summary.toLowerCase();
    

    if (toolResult.entityId && summaryLower.includes(toolResult.entityId.toLowerCase())) {
      score += 0.4;
    }
    
    if (toolResult.errors?.some((error: any) => 
      summaryLower.includes(error.message?.toLowerCase() || '')
    )) {
      score += 0.5;
    }
    
    if (toolResult.price && summaryLower.includes(toolResult.price.toString())) {
      score += 0.3;
    }


    score += this.analyzeToolSpecificRelevance(summaryLower, toolResult);
    
    return Math.min(1, score);
  }

  private analyzeToolSpecificRelevance(summaryLower: string, toolResult: ToolResult): number {
    let score = 0;

    switch (toolResult.toolName) {
      case 'fetchDatadogLogs':
        if (toolResult.logs?.some((log: any) => 
          summaryLower.includes(log.message?.toLowerCase() || '')
        )) {
          score += 0.4;
        }
        if (summaryLower.includes('error') || summaryLower.includes('log')) {
          score += 0.2;
        }
        break;

      case 'getOfferPrice':
        if (summaryLower.includes('price') || summaryLower.includes('pricing')) {
          score += 0.5;
        }
        if (toolResult.currency && summaryLower.includes(toolResult.currency.toLowerCase())) {
          score += 0.2;
        }
        break;

      case 'analyzeUPSOfferPriceTool':
        if (summaryLower.includes('ups') || summaryLower.includes('pricing')) {
          score += 0.4;
        }
        if (toolResult.recommendations?.some((rec: string) => 
          summaryLower.includes(rec.toLowerCase())
        )) {
          score += 0.3;
        }
        break;

      case 'fetchGenieOffer':
        if (summaryLower.includes('offer') || summaryLower.includes('genie')) {
          score += 0.3;
        }
        if (toolResult.offer?.status && summaryLower.includes(toolResult.offer.status.toLowerCase())) {
          score += 0.3;
        }
        break;

      case 'fetchEntityHistory':
        if (summaryLower.includes('history') || summaryLower.includes('change')) {
          score += 0.3;
        }
        if (summaryLower.includes('recent') || summaryLower.includes('modified')) {
          score += 0.2;
        }
        break;
    }

    return score;
  }

  private findKeywordMatches(summary: string, toolResult: ToolResult): string[] {
    const matches: string[] = [];
    const summaryLower = summary.toLowerCase();


    const keywords = [
      toolResult.entityId,
      toolResult.price?.toString(),
      toolResult.currency,
      ...(toolResult.errors?.map((e: any) => e.message) || []),
      ...(toolResult.recommendations || [])
    ].filter(Boolean);

    keywords.forEach(keyword => {
      if (keyword && summaryLower.includes(keyword.toLowerCase())) {
        matches.push(keyword);
      }
    });

    return matches;
  }
}