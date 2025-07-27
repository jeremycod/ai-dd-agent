import { AgentState, DiagnosticCase, DiagnosticPattern } from '../model';
import { MongoStorage } from './mongodb';
import { v4 as uuidv4 } from 'uuid';

export class MemoryService {
  constructor(public storage: MongoStorage) {}

  async storeCaseFromState(state: AgentState): Promise<void> {
    console.log('[MemoryService] storeCaseFromState called');
    console.log('[MemoryService] userQuery:', !!state.userQuery);
    console.log('[MemoryService] queryCategory:', state.queryCategory);
    console.log('[MemoryService] messageFeedbacks:', Object.keys(state.messageFeedbacks || {}).length, 'feedback entries');
    console.log('[MemoryService] messageFeedbacks content:', state.messageFeedbacks);
    console.log('[MemoryService] overallRlReward:', state.overallRlReward);
    console.log('[MemoryService] rlEpisodeId from state:', state.rlEpisodeId);
    
    if (!state.userQuery || !state.queryCategory) {
      console.log('[MemoryService] Missing userQuery or queryCategory, skipping storage');
      return;
    }

    const generatedCaseId = `case_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const diagnosticCase: DiagnosticCase = {
      caseId: generatedCaseId,
      timestamp: new Date(),
      category: state.queryCategory,
      entityType: state.entityType,
      entityIds: state.entityIds,
      environment: state.environment,
      userQuery: state.userQuery,
      toolsUsed: [
        ...(state.currentEpisodeActions?.map(action => action.nodeName) || []),
        'parseUserQuery', 'memoryRetrieval', 'fetchParallelData', 'runParallelAnalysisTools', 'summarizeFindings', 'respondToUser'
      ].filter((tool, index, arr) => arr.indexOf(tool) === index), // Remove duplicates
      finalSummary: typeof state.finalSummary === 'string' ? state.finalSummary : undefined,
      dataForSummaryPrompt: state.dataForSummaryPrompt,
      overallRlReward: state.overallRlReward || 0,
      messageFeedbacks: state.messageFeedbacks || {}
    };

    console.log('[MemoryService] Storing case:', diagnosticCase.caseId);
    await this.storage.storeCase(diagnosticCase);
    console.log('[MemoryService] Case stored successfully');
    
    // Update the state with the generated case ID for frontend use
    (state as any).generatedCaseId = generatedCaseId;
    console.log('[MemoryService] Set generatedCaseId in state:', generatedCaseId);
    
    // Store in conversation state for server access (will be handled by server)
    
    console.log('[MemoryService] Updating pattern...');
    await this.updatePattern(diagnosticCase);
    console.log('[MemoryService] Pattern updated successfully');
  }

  async retrieveSimilarCases(state: AgentState): Promise<DiagnosticCase[]> {
    if (!state.queryCategory) return [];

    return await this.storage.findSimilarCases(
      state.queryCategory,
      state.entityType,
      state.environment,
      5
    );
  }

  async getRelevantPatterns(state: AgentState): Promise<DiagnosticPattern[]> {
    if (!state.queryCategory) return [];

    const pattern = await this.storage.getPattern(
      state.queryCategory,
      state.entityType,
      state.environment
    );

    return pattern ? [pattern] : [];
  }

  private async updatePattern(diagnosticCase: DiagnosticCase): Promise<void> {
    const existingPattern = await this.storage.getPattern(
      diagnosticCase.category,
      diagnosticCase.entityType,
      diagnosticCase.environment
    );

    const reward = diagnosticCase.overallRlReward || 0;
    const isSuccess = reward > 0;

    if (existingPattern) {
      // Update existing pattern
      const newUsageCount = existingPattern.usageCount + 1;
      const newSuccessRate = ((existingPattern.successRate * existingPattern.usageCount) + (isSuccess ? 1 : 0)) / newUsageCount;

      const updatedPattern: DiagnosticPattern = {
        ...existingPattern,
        commonTools: this.mergeTools(existingPattern.commonTools, diagnosticCase.toolsUsed),
        successRate: newSuccessRate,
        usageCount: newUsageCount,
        lastUpdated: new Date()
      };

      await this.storage.storePattern(updatedPattern);
    } else {
      // Create new pattern
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

      await this.storage.storePattern(newPattern);
    }
  }

  private mergeTools(existingTools: string[], newTools: string[]): string[] {
    const toolSet = new Set([...existingTools, ...newTools]);
    return Array.from(toolSet);
  }

  async updateCaseWithFeedback(caseId: string, messageFeedbacks: Record<string, any>, overallRlReward?: number): Promise<void> {
    console.log('[MemoryService] Updating case with feedback:', caseId);
    console.log('[MemoryService] Feedback data:', messageFeedbacks);
    console.log('[MemoryService] RL Reward:', overallRlReward);
    
    try {
      // Find and update the case in MongoDB
      const result = await this.storage.updateCaseWithFeedback(caseId, messageFeedbacks, overallRlReward);
      console.log('[MemoryService] Case updated with feedback:', result);
    } catch (error) {
      console.error('[MemoryService] Error updating case with feedback:', error);
    }
  }
}