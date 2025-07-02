import { z } from 'zod';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentStateAnnotation } from './model/agentState';
import {
  parseUserQuery,
  fetchDatadogLogs,
  runParallelAnalysisTools,
  summarizeFindings,
  respondToUser,
} from './nodes';

// --- Define the Graph ---
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode('parse_user_query', parseUserQuery)
  .addNode('fetch_datadog_logs', fetchDatadogLogs)
  .addNode('run_parallel_analysis_tools', runParallelAnalysisTools)
  .addNode('summarize_findings', summarizeFindings)
  .addNode('respond_to_user', respondToUser);

// Define the entry point
workflow.setEntryPoint('parse_user_query');

// Define edges (transitions)
workflow.addEdge('parse_user_query', 'fetch_datadog_logs');
workflow.addEdge('fetch_datadog_logs', 'run_parallel_analysis_tools');
workflow.addEdge('run_parallel_analysis_tools', 'summarize_findings');
workflow.addEdge('summarize_findings', 'respond_to_user');
workflow.addEdge('respond_to_user', END);

// Compile the graph
workflow.compile();
export const app = workflow.compile();
