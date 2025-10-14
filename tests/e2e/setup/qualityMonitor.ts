import { logger } from '../../../src/utils/logger';

export interface QualityThresholds {
  relevance?: number;
  accuracy?: number;
  completeness?: number;
  coherence?: number;
  hallucination?: number;
}

export interface QualityScore {
  relevance: number;
  accuracy: number;
  completeness: number;
  coherence: number;
  hallucination: number;
  overall: number;
}

export interface QualityReport {
  testRun: {
    timestamp: Date;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
  aggregateScores: QualityScore;
  thresholdViolations: Array<{
    metric: string;
    expected: number;
    actual: number;
    testCase: string;
  }>;
  recommendations: string[];
}

export class QualityMonitor {
  private thresholds: Required<QualityThresholds>;
  private testResults: Array<{
    testCase: string;
    scores: QualityScore;
    timestamp: Date;
  }> = [];

  constructor(thresholds: QualityThresholds = {}) {
    this.thresholds = {
      relevance: thresholds.relevance ?? 0.8,
      accuracy: thresholds.accuracy ?? 0.85,
      completeness: thresholds.completeness ?? 0.9,
      coherence: thresholds.coherence ?? 0.8,
      hallucination: thresholds.hallucination ?? 0.1
    };
  }

  async initialize(): Promise<void> {
    logger.info('[QualityMonitor] Initialized with thresholds:', this.thresholds);
  }

  async analyzeResponse(
    response: string,
    context: {
      query: string;
      groundTruth?: any;
      sourceData?: any;
      requiredElements?: string[];
    },
    testCase: string = 'unknown'
  ): Promise<QualityScore> {
    const scores: QualityScore = {
      relevance: await this.calculateRelevance(response, context.query),
      accuracy: await this.verifyAccuracy(response, context.groundTruth),
      completeness: await this.checkCompleteness(response, context.requiredElements || []),
      coherence: await this.analyzeCoherence(response),
      hallucination: await this.detectHallucinations(response, context.sourceData),
      overall: 0
    };

    // Calculate overall score (weighted average)
    scores.overall = this.calculateOverallScore(scores);

    // Store result
    this.testResults.push({
      testCase,
      scores,
      timestamp: new Date()
    });

    logger.debug(`[QualityMonitor] Quality scores for ${testCase}:`, scores);
    return scores;
  }

  private async calculateRelevance(response: string, query: string): Promise<number> {
    // Simple keyword-based relevance (in practice, use semantic similarity)
    const queryWords = this.extractKeywords(query.toLowerCase());
    const responseWords = this.extractKeywords(response.toLowerCase());
    
    const commonWords = queryWords.filter(word => responseWords.includes(word));
    const relevance = commonWords.length / Math.max(queryWords.length, 1);
    
    return Math.min(relevance * 1.2, 1.0); // Boost and cap at 1.0
  }

  private async verifyAccuracy(response: string, groundTruth: any): Promise<number> {
    if (!groundTruth) return 0.8; // Default score when no ground truth available
    
    // Extract factual claims from response
    const claims = this.extractFactualClaims(response);
    if (claims.length === 0) return 0.8;
    
    // Verify each claim against ground truth
    const verifiedClaims = claims.filter(claim => 
      this.verifyClaimAgainstGroundTruth(claim, groundTruth)
    );
    
    return verifiedClaims.length / claims.length;
  }

  private async checkCompleteness(response: string, requiredElements: string[]): Promise<number> {
    if (requiredElements.length === 0) return 1.0;
    
    const responseLower = response.toLowerCase();
    const coveredElements = requiredElements.filter(element =>
      responseLower.includes(element.toLowerCase())
    );
    
    return coveredElements.length / requiredElements.length;
  }

  private async analyzeCoherence(response: string): Promise<number> {
    // Simple coherence analysis based on sentence structure and flow
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return 0;
    if (sentences.length === 1) return 0.9;
    
    // Check for logical connectors and flow
    const connectors = ['because', 'therefore', 'however', 'additionally', 'furthermore'];
    const hasConnectors = connectors.some(connector => 
      response.toLowerCase().includes(connector)
    );
    
    // Basic coherence score
    let coherenceScore = 0.7;
    if (hasConnectors) coherenceScore += 0.2;
    if (sentences.length > 2 && sentences.length < 8) coherenceScore += 0.1;
    
    return Math.min(coherenceScore, 1.0);
  }

  private async detectHallucinations(response: string, sourceData: any): Promise<number> {
    if (!sourceData) return 0.05; // Low hallucination score when no source data
    
    // Extract specific claims that could be hallucinations
    const specificClaims = this.extractSpecificClaims(response);
    
    if (specificClaims.length === 0) return 0.05;
    
    // Check if claims are supported by source data
    const unsupportedClaims = specificClaims.filter(claim =>
      !this.isClaimSupportedBySource(claim, sourceData)
    );
    
    return unsupportedClaims.length / specificClaims.length;
  }

  private calculateOverallScore(scores: Omit<QualityScore, 'overall'>): number {
    // Weighted average with penalties for high hallucination
    const weights = {
      relevance: 0.25,
      accuracy: 0.3,
      completeness: 0.25,
      coherence: 0.2
    };
    
    const weightedSum = 
      scores.relevance * weights.relevance +
      scores.accuracy * weights.accuracy +
      scores.completeness * weights.completeness +
      scores.coherence * weights.coherence;
    
    // Apply hallucination penalty
    const hallucinationPenalty = Math.min(scores.hallucination * 0.5, 0.3);
    
    return Math.max(weightedSum - hallucinationPenalty, 0);
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction (remove common words)
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
    return text.split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  private extractFactualClaims(response: string): string[] {
    // Extract sentences that contain factual claims
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    return sentences.filter(sentence => {
      const lower = sentence.toLowerCase();
      return lower.includes('is') || lower.includes('are') || 
             lower.includes('shows') || lower.includes('indicates') ||
             lower.includes('appears') || lower.includes('seems');
    });
  }

  private extractSpecificClaims(response: string): string[] {
    // Extract specific numerical or categorical claims
    const patterns = [
      /\$[\d,]+\.?\d*/g, // Prices
      /\d+%/g, // Percentages
      /\d+ (users?|offers?|campaigns?)/g, // Counts
      /(active|inactive|enabled|disabled)/gi // Status claims
    ];
    
    const claims: string[] = [];
    patterns.forEach(pattern => {
      const matches = response.match(pattern);
      if (matches) claims.push(...matches);
    });
    
    return claims;
  }

  private verifyClaimAgainstGroundTruth(claim: string, groundTruth: any): boolean {
    // Simple verification - in practice, this would be more sophisticated
    if (!groundTruth || typeof groundTruth !== 'object') return false;
    
    const claimLower = claim.toLowerCase();
    const truthString = JSON.stringify(groundTruth).toLowerCase();
    
    return truthString.includes(claimLower.substring(0, 20)); // Partial match
  }

  private isClaimSupportedBySource(claim: string, sourceData: any): boolean {
    if (!sourceData) return false;
    
    const sourceString = JSON.stringify(sourceData).toLowerCase();
    const claimLower = claim.toLowerCase();
    
    // Check if key elements of the claim appear in source data
    const claimWords = this.extractKeywords(claimLower);
    const supportedWords = claimWords.filter(word => sourceString.includes(word));
    
    return supportedWords.length / claimWords.length > 0.5;
  }

  validateQuality(scores: QualityScore, testCase: string): boolean {
    const violations: Array<{metric: string; expected: number; actual: number}> = [];
    
    if (scores.relevance < this.thresholds.relevance) {
      violations.push({metric: 'relevance', expected: this.thresholds.relevance, actual: scores.relevance});
    }
    if (scores.accuracy < this.thresholds.accuracy) {
      violations.push({metric: 'accuracy', expected: this.thresholds.accuracy, actual: scores.accuracy});
    }
    if (scores.completeness < this.thresholds.completeness) {
      violations.push({metric: 'completeness', expected: this.thresholds.completeness, actual: scores.completeness});
    }
    if (scores.coherence < this.thresholds.coherence) {
      violations.push({metric: 'coherence', expected: this.thresholds.coherence, actual: scores.coherence});
    }
    if (scores.hallucination > this.thresholds.hallucination) {
      violations.push({metric: 'hallucination', expected: this.thresholds.hallucination, actual: scores.hallucination});
    }
    
    if (violations.length > 0) {
      logger.warn(`[QualityMonitor] Quality threshold violations in ${testCase}:`, violations);
      return false;
    }
    
    return true;
  }

  async generateReport(): Promise<QualityReport> {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => 
      this.validateQuality(result.scores, result.testCase)
    ).length;
    
    const aggregateScores = this.calculateAggregateScores();
    const thresholdViolations = this.getThresholdViolations();
    const recommendations = this.generateRecommendations(aggregateScores);
    
    const report: QualityReport = {
      testRun: {
        timestamp: new Date(),
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests
      },
      aggregateScores,
      thresholdViolations,
      recommendations
    };
    
    logger.info('[QualityMonitor] Quality report generated:', {
      totalTests,
      passedTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
      overallScore: aggregateScores.overall.toFixed(3)
    });
    
    return report;
  }

  private calculateAggregateScores(): QualityScore {
    if (this.testResults.length === 0) {
      return {
        relevance: 0, accuracy: 0, completeness: 0, 
        coherence: 0, hallucination: 0, overall: 0
      };
    }
    
    const sums = this.testResults.reduce((acc, result) => ({
      relevance: acc.relevance + result.scores.relevance,
      accuracy: acc.accuracy + result.scores.accuracy,
      completeness: acc.completeness + result.scores.completeness,
      coherence: acc.coherence + result.scores.coherence,
      hallucination: acc.hallucination + result.scores.hallucination,
      overall: acc.overall + result.scores.overall
    }), { relevance: 0, accuracy: 0, completeness: 0, coherence: 0, hallucination: 0, overall: 0 });
    
    const count = this.testResults.length;
    return {
      relevance: sums.relevance / count,
      accuracy: sums.accuracy / count,
      completeness: sums.completeness / count,
      coherence: sums.coherence / count,
      hallucination: sums.hallucination / count,
      overall: sums.overall / count
    };
  }

  private getThresholdViolations(): Array<{metric: string; expected: number; actual: number; testCase: string}> {
    const violations: Array<{metric: string; expected: number; actual: number; testCase: string}> = [];
    
    this.testResults.forEach(result => {
      const scores = result.scores;
      const testCase = result.testCase;
      
      if (scores.relevance < this.thresholds.relevance) {
        violations.push({metric: 'relevance', expected: this.thresholds.relevance, actual: scores.relevance, testCase});
      }
      if (scores.accuracy < this.thresholds.accuracy) {
        violations.push({metric: 'accuracy', expected: this.thresholds.accuracy, actual: scores.accuracy, testCase});
      }
      if (scores.completeness < this.thresholds.completeness) {
        violations.push({metric: 'completeness', expected: this.thresholds.completeness, actual: scores.completeness, testCase});
      }
      if (scores.coherence < this.thresholds.coherence) {
        violations.push({metric: 'coherence', expected: this.thresholds.coherence, actual: scores.coherence, testCase});
      }
      if (scores.hallucination > this.thresholds.hallucination) {
        violations.push({metric: 'hallucination', expected: this.thresholds.hallucination, actual: scores.hallucination, testCase});
      }
    });
    
    return violations;
  }

  private generateRecommendations(scores: QualityScore): string[] {
    const recommendations: string[] = [];
    
    if (scores.relevance < 0.8) {
      recommendations.push('Improve query understanding and response relevance');
    }
    if (scores.accuracy < 0.85) {
      recommendations.push('Enhance fact verification and ground truth validation');
    }
    if (scores.completeness < 0.9) {
      recommendations.push('Ensure responses address all required elements');
    }
    if (scores.coherence < 0.8) {
      recommendations.push('Improve response structure and logical flow');
    }
    if (scores.hallucination > 0.1) {
      recommendations.push('Strengthen source data validation to reduce hallucinations');
    }
    
    return recommendations;
  }

  async reset(): Promise<void> {
    this.testResults = [];
    logger.info('[QualityMonitor] Reset test results');
  }
}