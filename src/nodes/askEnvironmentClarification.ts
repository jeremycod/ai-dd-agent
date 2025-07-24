import { AgentStateData } from '../model/agentState';
import { logger } from '../utils/logger';

export async function ask_environment_clarification(
  state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  logger.info(
    '[Node: ask_environment_clarification] Environment needs clarification. Signaling graph end.',
  );
  return state;
}
