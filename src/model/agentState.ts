import { ChatCompletionMessageParam } from '@langchain/core/messages'; // Use LangChain's message types
import { DatadogLog } from './tools';
import { StateGraph, Annotation } from '@langchain/langgraph';

// Define the shape of our graph's state
export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<ChatCompletionMessageParam[]>(),
  entityIds: Annotation<string[]>(),
  entityType: Annotation<'campaign' | 'offer' | 'product' | 'unknown'>(),
  timeRange: Annotation<string>(),
  datadogLogs: Annotation<DatadogLog[]>(),
  analysisResults: Annotation<{
    datadogWarnings?: string;
    datadogErrors?: string;
    sentryErrors?: string;
    internalMetricsAnomalies?: string;
  }>(),
  runParallelAnalysis: Annotation<boolean>(),
  finalSummary: Annotation<string | undefined>(),
});
export type AgentState = typeof AgentStateAnnotation.lc_graph_state;
