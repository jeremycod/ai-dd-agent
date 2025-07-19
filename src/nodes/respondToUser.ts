import { AgentStateData } from '../model/agentState';
import { logger } from '../utils/logger';
import {generateNewAIMessage} from "../utils/auth/helpers";

export async function respondToUser(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: respondToUser] Entering...');
  // This node just takes the final summary and potentially adds a concluding message
  const finalMessageContent =
    state.finalSummary ||
    "I'm sorry, I couldn't fully analyze the situation. Please try rephrasing your request or provide more details.";
  return {
    messages: [...state.messages, generateNewAIMessage(finalMessageContent.toString())],
  };
}
