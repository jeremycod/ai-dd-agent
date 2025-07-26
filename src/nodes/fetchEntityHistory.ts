import { AgentStateData, Version } from '../model';
import { getEntityHistoryTool } from '../tools';
import { generateNewAIMessage, logger } from '../utils';
export async function fetchEntityHistory(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: fetchEntityHistory] Fetching entity history...');
  const { entityIds, entityType, environment, messages } = state;
  if (entityIds.length === 0) {
    console.warn('[Node: fetchEntityHistory] No entity IDs to fetch history for.');
    return {
      entityHistory: [],
      messages: [
        ...messages,
        generateNewAIMessage('Could not fetch Entity History as no specific IDs were identified.'),
      ],
    };
  }
  const toolCallResult = await getEntityHistoryTool.invoke({
    ids: entityIds,
    environment: environment,
    entityType: entityType,
    limit: 10,
  });
  let summaryMessage = `Datadog logs fetching completed for ${entityIds.length} entities.`;
  if (toolCallResult.history.length > 0) {
    summaryMessage += ` Successfully retrieved ${toolCallResult.history.length} history versions.`;
  }
  return {
    entityHistory: (toolCallResult as { history: Version[] }).history,
    messages: [
      ...messages,
      generateNewAIMessage('Fetched Entity History. Proceeding to parallel analysis.'),
    ], // Add tool output to history for LLM context
    analysisResults: {
        ...state.analysisResults,
        entityHistory: summaryMessage,
    }
  };
}
