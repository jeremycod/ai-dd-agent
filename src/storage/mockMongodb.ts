import { DiagnosticCase, DiagnosticPattern } from '../model/agentState';

export class MockMongoStorage {
  private cases: DiagnosticCase[] = [];
  private patterns: DiagnosticPattern[] = [];

  async connect(): Promise<void> {

  }

  async disconnect(): Promise<void> {

  }

  async storeCase(diagnosticCase: DiagnosticCase): Promise<void> {
    const existingIndex = this.cases.findIndex(c => c.caseId === diagnosticCase.caseId);
    if (existingIndex >= 0) {
      this.cases[existingIndex] = diagnosticCase;
    } else {
      this.cases.push(diagnosticCase);
    }
  }

  async findSimilarCases(
    category: string,
    entityType: string,
    environment: string,
    limit: number = 5
  ): Promise<DiagnosticCase[]> {
    return this.cases
      .filter(c => c.category === category && c.entityType === entityType && c.environment === environment)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async storePattern(pattern: DiagnosticPattern): Promise<void> {
    const existingIndex = this.patterns.findIndex(
      p => p.category === pattern.category && 
           p.entityType === pattern.entityType && 
           p.environment === pattern.environment
    );
    
    if (existingIndex >= 0) {
      this.patterns[existingIndex] = pattern;
    } else {
      this.patterns.push(pattern);
    }
  }

  async getPattern(
    category: string,
    entityType: string,
    environment: string
  ): Promise<DiagnosticPattern | null> {
    return this.patterns.find(
      p => p.category === category && p.entityType === entityType && p.environment === environment
    ) || null;
  }

  async getTopPatterns(limit: number = 10): Promise<DiagnosticPattern[]> {
    return this.patterns
      .sort((a, b) => b.successRate - a.successRate || b.usageCount - a.usageCount)
      .slice(0, limit);
  }
}