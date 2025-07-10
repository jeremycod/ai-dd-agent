import { z } from 'zod';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentStateData, AgentState, AgentStateAnnotation } from './model/agentState';
import { parseUserQuery } from './nodes/parseUserQuery';
import { ask_environment_clarification } from './nodes/askEnvironmentClarification';
import { fetchParallelData } from './nodes/fetchParallelData';
import { respondToUser } from './nodes/respondToUser';
import { summarizeFindings } from './nodes/summarizeFindings';
import { runParallelAnalysisTools } from './nodes/runParallelAnalysisTools';
// --- Define the Graph ---
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode('parse_user_query', parseUserQuery)
  .addNode('ask_environment_clarification', ask_environment_clarification)
  .addNode('fetch_parallel_data', fetchParallelData)
  .addNode('run_parallel_analysis_tools', runParallelAnalysisTools)
  .addNode('summarize_findings', summarizeFindings)
  .addNode('respond_to_user', respondToUser);

// Define the entry point
workflow.setEntryPoint('parse_user_query');

// Define edges (transitions)
// --- CRITICAL CONDITIONAL EDGE ---
workflow.addConditionalEdges(
  'parse_user_query', // From this node
  (state: AgentStateData) => {
    // This is the gatekeeper.
    // If the environment is 'unknown', we go to the clarification step.
    if (state.environment === 'unknown') {
      console.log('[Graph Edge] Environment is unknown, moving to ask_environment_clarification.');
      return 'ask_environment_clarification';
    }
    // Otherwise, if a valid environment was extracted, we proceed to fetch data.
    console.log('[Graph Edge] Environment is valid, proceeding to fetch_parallel_data.');
    return 'fetch_parallel_data';
  },
);
// --- END CRITICAL CONDITIONAL EDGE ---
workflow.addEdge('fetch_parallel_data', 'run_parallel_analysis_tools');
workflow.addEdge('run_parallel_analysis_tools', 'summarize_findings');
workflow.addEdge('summarize_findings', 'respond_to_user');
workflow.addEdge('respond_to_user', END);

// When the environment is unknown, the graph should end here, waiting for more user input.
// The agent's response to the user will be the clarification message added in parseUserQuery.
workflow.addEdge('ask_environment_clarification', END);

// Compile the graph
export const app = workflow.compile();
