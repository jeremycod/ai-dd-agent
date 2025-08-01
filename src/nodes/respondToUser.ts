import { AgentStateData } from '../model';
import { logger, generateNewAIMessage } from '../utils';

export async function respondToUser(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: respondToUser] Entering...');
  const finalMessageContent =
    state.finalSummary ||
    "I'm sorry, I couldn't fully analyze the situation. Please try rephrasing your request or provide more details.";
  return {
    messages: [...state.messages, generateNewAIMessage(finalMessageContent.toString())],
  };
}
