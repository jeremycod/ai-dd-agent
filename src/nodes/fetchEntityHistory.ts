import { AgentStateData } from '../model/agentState';
import { AIMessage } from '@langchain/core/messages';
import { getEntityHistoryTool } from '../tools/entityHistoryTools';
import { Version } from '../model/types/entityHistory';
import {generateNewAIMessage} from "../utils/auth/helpers";
import { logger } from '../utils/logger';
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
  // Call the getEntityHistory tool
  const toolCallResult = await getEntityHistoryTool.invoke({
    ids: entityIds,
    environment: environment,
    entityType: entityType,
    limit: 10,
  });

  // LangGraph expects `messages` to be appended and the next step can use it
  // For this pattern, we want to store the actual logs separately for analysis.
  return {
    entityHistory: (toolCallResult as { history: Version[] }).history,
    messages: [
      ...messages,
      generateNewAIMessage('Fetched Entity History. Proceeding to parallel analysis.'),
    ], // Add tool output to history for LLM context
  };
}
