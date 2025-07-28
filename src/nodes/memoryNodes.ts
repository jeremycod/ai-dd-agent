import { AgentState } from '../model';
import { logger, generateNewAIMessage } from '../utils';
import { MemoryService } from '../storage';

export async function memoryRetrievalNode(
  state: AgentState,
  memoryService: MemoryService
): Promise<Partial<AgentState>> {
  logger.info('[Node: memoryRetrievalNode] Entering...');
  
  // Track this action
  const action = {
    nodeName: 'memoryRetrievalNode',
    actionDescription: 'Retrieved similar cases and patterns from memory',
    timestamp: new Date(),
  };
  
  const { queryCategory, entityType, environment, messages } = state;

  if (!queryCategory) {
    logger.warn('[Node: memoryRetrievalNode] No query category available for memory retrieval');
    return {
      similarCases: [],
      relevantPatterns: [],
      rlFeatures: {
        ...state.rlFeatures,
        similarCaseCount: 0
      }
    };
  }

  try {
    // Retrieve similar cases
    const similarCases = await memoryService.retrieveSimilarCases(state as any);
    
    // Retrieve relevant patterns
    const relevantPatterns = await memoryService.getRelevantPatterns(state as any);

    logger.info(`[Node: memoryRetrievalNode] Found ${similarCases.length} similar cases and ${relevantPatterns.length} patterns`);

    return {
      similarCases: similarCases as any,
      relevantPatterns,
      rlFeatures: {
        ...state.rlFeatures,
        similarCaseCount: similarCases.length
      },
      messages: [
        ...messages,
        generateNewAIMessage(`Retrieved ${similarCases.length} similar cases from memory for context.`)
      ],
      currentEpisodeActions: [...(state.currentEpisodeActions || []), action]
    };
  } catch (error) {
    logger.error('[Node: memoryRetrievalNode] Error retrieving memory:', error);
    
    return {
      similarCases: [],
      relevantPatterns: [],
      rlFeatures: {
        ...state.rlFeatures,
        similarCaseCount: 0
      },
      messages: [
        ...messages,
        generateNewAIMessage('Memory retrieval encountered an error, proceeding without historical context.')
      ]
    };
  }
}

export async function storeCaseNode(
  state: AgentState,
  memoryService: MemoryService
): Promise<Partial<AgentState>> {
  logger.info('[Node: storeCaseNode] Entering...');
  
  // Track this action
  const action = {
    nodeName: 'storeCaseNode',
    actionDescription: 'Stored diagnostic case and updated patterns in memory',
    timestamp: new Date(),
  };
  
  const { userQuery, queryCategory, messages } = state;

  if (!userQuery || !queryCategory) {
    logger.warn('[Node: storeCaseNode] Insufficient data to store case');
    return {};
  }

  try {
    // Store the current case for future learning
    await memoryService.storeCaseFromState(state as any);
    
    logger.info('[Node: storeCaseNode] Successfully stored case in memory');

    return {
      messages: [
        ...messages,
        generateNewAIMessage('Case stored in memory for future learning.')
      ],
      currentEpisodeActions: [...(state.currentEpisodeActions || []), action],
      generatedCaseId: (state as any).generatedCaseId
    };
  } catch (error) {
    logger.error('[Node: storeCaseNode] Error storing case:', error);
    
    return {
      messages: [
        ...messages,
        generateNewAIMessage('Warning: Could not store case in memory for future learning.')
      ]
    };
  }
}