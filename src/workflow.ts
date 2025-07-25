import { z } from 'zod';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentStateData, AgentState, AgentStateAnnotation } from './model/agentState';
import { parseUserQuery } from './nodes/parseUserQuery';
import { ask_environment_clarification } from './nodes/askEnvironmentClarification';
import { fetchParallelData } from './nodes/fetchParallelData';
import { respondToUser } from './nodes/respondToUser';
import { summarizeFindings } from './nodes/summarizeFindings';
import { runParallelAnalysisTools } from './nodes/runParallelAnalysisTools';
import { memoryRetrievalWrapper, storeCaseWrapper } from './memoryWorkflow';
import { logger } from './utils/logger';

const workflow = new StateGraph(AgentStateAnnotation)
  .addNode('parse_user_query', parseUserQuery)
  .addNode('memory_retrieval', memoryRetrievalWrapper)
  .addNode('ask_environment_clarification', ask_environment_clarification)
  .addNode('fetch_parallel_data', fetchParallelData)
  .addNode('run_parallel_analysis_tools', runParallelAnalysisTools)
  .addNode('summarize_findings', summarizeFindings)
  .addNode('respond_to_user', respondToUser)
  .addNode('store_case', storeCaseWrapper);

workflow.setEntryPoint('parse_user_query');

workflow.addConditionalEdges(
  'parse_user_query',
  (state: AgentStateData) => {
    // Check if clarification is needed for entity type or environment
    const needsEntityTypeClarification = state.entityType === 'unknown' && state.entityIds.length > 0;
    const needsEnvironmentClarification = state.environment === 'unknown';
    
    if (needsEntityTypeClarification || needsEnvironmentClarification) {
      logger.info('[Graph Edge] Clarification needed, ending workflow for user response.');
      return END;
    }
    
    logger.info('[Graph Edge] All required information available, proceeding to memory_retrieval.');
    return 'memory_retrieval';
  },
);

workflow.addConditionalEdges(
  'memory_retrieval',
  (state: AgentStateData) => {
    if (state.environment === 'unknown') {
      logger.info('[Graph Edge] Environment is unknown, moving to ask_environment_clarification.');
      return 'ask_environment_clarification';
    }
    logger.info('[Graph Edge] Environment is valid, proceeding to fetch_parallel_data.');
    return 'fetch_parallel_data';
  },
);
workflow.addEdge('fetch_parallel_data', 'run_parallel_analysis_tools');
workflow.addEdge('run_parallel_analysis_tools', 'summarize_findings');
workflow.addEdge('summarize_findings', 'respond_to_user');
workflow.addEdge('respond_to_user', 'store_case');
workflow.addEdge('store_case', END);

workflow.addEdge('ask_environment_clarification', END);

export const app = workflow.compile();
