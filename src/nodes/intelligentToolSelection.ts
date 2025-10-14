import { AgentState } from '../model';
import { MemoryService } from '../storage';
import { logger } from '../utils';

/**
 * Node that uses progressive tool selection to optimize diagnostic workflow
 */
export async function intelligentToolSelectionNode(
  state: AgentState,
  memoryService: MemoryService
): Promise<Partial<AgentState>> {
  logger.info('[Node: intelligentToolSelectionNode] Entering...');
  
  try {
    // Get tool selection plan based on historical effectiveness
    const toolSelectionPlan = await memoryService.getToolSelectionPlan(state);
    
    logger.info('[intelligentToolSelectionNode] Tool selection plan: %j', {
      tier1Count: toolSelectionPlan.tier1.length,
      tier2Count: toolSelectionPlan.tier2.length,
      tier3Count: toolSelectionPlan.tier3.length
    });
    
    // Store the plan in state for use by parallel execution nodes
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
    
    // Fallback to running all tools
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