import {BaseMessage, MessageContent} from '@langchain/core/messages'; // Use LangChain's message types

import { Annotation, LastValue } from '@langchain/langgraph';
import { DatadogLog} from "./datadog";
import { QueryCategory, EnvironmentType, EntityType, Version} from "./types";


// Define the core types for specific fields to avoid repetition


// Placeholder for DatadogLog - ensure this matches your actual definition
/*export type DatadogLog = {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: any;
};*/

// --- Base Agent State Data Definition ---

/**
 * AgentStateData defines the actual *data shape* of your state.
 * This is the type that your nodes (tools) and application logic will directly interact with.
 * It contains the unwrapped values (e.g., `BaseMessage[]`, `string[]`).
 */

export type AgentStateData = {
  messages: BaseMessage[];
  userQuery?: string;
  entityIds: string[];
  entityType: EntityType; // Reusing defined type
  environment: EnvironmentType; // Reusing defined type
  timeRange: string;
  datadogLogs: DatadogLog[];
  entityHistory: Version[];
  analysisResults: {
    datadogWarnings?: string;
    datadogErrors?: string;
    entityHistory?: string;
  };
  runParallelAnalysis: boolean;
  finalSummary?: MessageContent;
  queryCategory?: QueryCategory; // Reusing defined type
};


// --- Derived Agent State Channel Definition ---

/**
 * AgentStateChannels defines the *channel types* for LangGraph's internal StateGraph.
 * Each field is wrapped with a LangGraph Channel type (like LastValue).
 * This type is used as the generic parameter for Annotation.Root.
 *
 * We use a Mapped Type here to automatically wrap each property of AgentStateData with LastValue.
 */
export type AgentStateChannels = {
  [K in keyof AgentStateData]: LastValue<AgentStateData[K]>;
};

// --- Final Agent State Type for Node Functions ---
export const AgentStateAnnotation = Annotation.Root<AgentStateChannels>({
  messages: Annotation(),
  userQuery: Annotation(),
  entityIds: Annotation(),
  entityType: Annotation(),
  environment: Annotation(),
  timeRange: Annotation(),
  datadogLogs: Annotation(),
  entityHistory: Annotation(),
  analysisResults: Annotation(),
  runParallelAnalysis: Annotation(),
  finalSummary: Annotation(),
  queryCategory: Annotation(),
});
/**
 * AgentState is the convenience type for nodes and application logic.
 * It is derived from AgentStateAnnotation.State, which correctly unwraps the channels
 * to give you AgentStateData.
 */
export type AgentState = typeof AgentStateAnnotation.State;
