import { AgentStateData } from '../model';
import { logger } from '../utils';

export async function ask_environment_clarification(
  state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  logger.info(
    '[Node: ask_environment_clarification] Environment needs clarification. Signaling graph end.',
  );
  return state;
}
