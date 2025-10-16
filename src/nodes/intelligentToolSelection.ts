import { AgentState } from '../model';
import { MemoryService } from '../storage';
import { logger } from '../utils';


export async function intelligentToolSelectionNode(
  state: AgentState,
  memoryService: MemoryService
): Promise<Partial<AgentState>> {
  logger.info('[Node: intelligentToolSelectionNode] Entering...');
  
  try {

    const toolSelectionPlan = await memoryService.getToolSelectionPlan(state);
    
    logger.info('[intelligentToolSelectionNode] Tool selection plan: %j', {
      tier1Count: toolSelectionPlan.tier1.length,
      tier2Count: toolSelectionPlan.tier2.length,
      tier3Count: toolSelectionPlan.tier3.length
    });
    

    return {
      messages: [
        ...state.messages,
        {
          type: 'ai' as const,
          content: `Selected ${toolSelectionPlan.tier1.length} high-priority tools based on historical effectiveness.`
        } as any
      ]
    } as any;
    
  } catch (error) {
    logger.error('[intelligentToolSelectionNode] Error in tool selection: %j', error);
    

    return {
      messages: [
        ...state.messages,
        {
          type: 'ai' as const, 
          content: 'Using default tool selection due to analysis error.'
        } as any
      ]
    } as any;
  }
}