import { ChatCompletionMessageParam } from '@langchain/core/messages'; // Use LangChain's message types

import { Annotation } from '@langchain/langgraph';
import { DatadogLog } from './datadog';

// Define the shape of our graph's state
export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<ChatCompletionMessageParam[]>(),
  entityIds: Annotation<string[]>(),
  entityType: Annotation<'campaign' | 'offer' | 'product' | 'sku' | 'unknown'>(),
  environment: Annotation<'production' | 'staging' | 'development'>(),
  timeRange: Annotation<string>(),
  datadogLogs: Annotation<DatadogLog[]>(),
  entityHistory: Annotation<string[]>(),
  analysisResults: Annotation<{
    datadogWarnings?: string;
    datadogErrors?: string;
    entityHistory?: string;
    internalMetricsAnomalies?: string;
  }>(),
  runParallelAnalysis: Annotation<boolean>(),
  finalSummary: Annotation<string | undefined>(),
  queryCategory: Annotation<
      | 'ENTITY_STATUS'
      | 'UI_ISSUE'
      | 'DATA_INCONSISTENCY'
      | 'DATA_MAPPING'
      | 'ENTITY_CONFIGURATION'
      | 'SYSTEM_BEHAVIOR'
      | 'GENERAL_QUESTION'
      | 'UNKNOWN_CATEGORY'
      | 'unclassified' // Initial state before parsing
  >(),
});
export type AgentState = typeof AgentStateAnnotation.type;
