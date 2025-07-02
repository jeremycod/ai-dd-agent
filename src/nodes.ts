// Helper function to extract IDs and time range from a message
import { AgentState, AgentStateAnnotation } from './model/agentState';
import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { DatadogLog } from './model/datadog';
import {
  getMockDatadogLogsTool,
  analyzeDatadogWarningsTool,
  analyzeDatadogErrorsTool,
} from './tools/datadogLogsTool';
import { llm } from './anthropicAgent';

function extractEntities(messageContent: string): {
  ids: string[];
  timeRange: string;
  entityType: string;
} {
  const idRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const timeRangeRegex = /(last (\d+)(h|m|d))|(\d+(m|h|d) ago)/i; // e.g., "last 2 hours", "30m ago"
  const campaignKeywords = /(campaign|campaigns)/i;
  const offerKeywords = /(offer|offers)/i;
  const productKeywords = /(product|products)/i;

  const ids = Array.from(messageContent.matchAll(idRegex)).map((match) => match[0]);
  const timeRangeMatch = messageContent.match(timeRangeRegex);
  let timeRange = timeRangeMatch
    ? timeRangeMatch[2] + (timeRangeMatch[3] || timeRangeMatch[5])
    : '1h'; // Default to 1 hour

  let entityType: 'campaign' | 'offer' | 'product' | 'general' = 'general';
  if (campaignKeywords.test(messageContent)) {
    entityType = 'campaign';
  } else if (offerKeywords.test(messageContent)) {
    entityType = 'offer';
  } else if (productKeywords.test(messageContent)) {
    entityType = 'product';
  }

  return { ids, timeRange, entityType };
}

// Node 1: Parse User Query
export async function parseUserQuery(
  state: AgentStateAnnotation.State,
): Promise<Partial<AgentState>> {
  console.log('[Node: parseUserQuery] Entering...');
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage instanceof HumanMessage) {
    const { ids, timeRange, entityType } = extractEntities(lastMessage.content);
    if (ids.length > 0) {
      return {
        entityIds: ids,
        entityType: entityType,
        timeRange: timeRange,
        runParallelAnalysis: true, // Indicate that we have entities to analyze
        messages: [
          ...state.messages,
          new AIMessage('Identified entities. Proceeding to fetch logs.'),
        ],
      };
    } else {
      // If no specific IDs, the LLM might still need to process the general query
      console.log(
        '[Node: parseUserQuery] No specific IDs found, sending to LLM for general advice or clarification.',
      );
      const response = await llm.invoke(state.messages);
      return {
        messages: [...state.messages, response],
        runParallelAnalysis: false, // Don't run parallel tools if no specific IDs
      };
    }
  }
  return {}; // Should not happen if previous state is correct
}

// Node 2: Fetch Datadog Logs
export async function fetchDatadogLogs(
  state: AgentStateAnnotation.State,
): Promise<Partial<AgentState>> {
  console.log('[Node: fetchDatadogLogs] Entering...');
  const { entityIds, entityType, timeRange, messages } = state;

  if (entityIds.length === 0) {
    console.warn('[Node: fetchDatadogLogs] No entity IDs to fetch logs for.');
    return {
      datadogLogs: [],
      messages: [
        ...messages,
        new AIMessage('Could not fetch Datadog logs as no specific IDs were identified.'),
      ],
    };
  }
  // Call the getDatadogLogs tool
  const toolCallResult = await getMockDatadogLogsTool.invoke({
    ids: entityIds,
    entityType: entityType,
    timeRange: timeRange,
    additionalQuery: `env:prod`, // Always target production, or make this configurable
  });

  // LangGraph expects `messages` to be appended and the next step can use it
  // For this pattern, we want to store the actual logs separately for analysis.
  return {
    datadogLogs: (toolCallResult as { logs: DatadogLog[] }).logs,
    messages: [
      ...messages,
      new AIMessage('Fetched Datadog Logs. Proceeding to parallel analysis.'),
    ], // Add tool output to history for LLM context
  };
}

// Node 3: Run Parallel Analysis Tools
export async function runParallelAnalysisTools(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: runParallelAnalysisTools] Entering...');
  const { datadogLogs, entityIds, timeRange, messages } = state;

  if (datadogLogs.length === 0) {
    console.log('[Node: runParallelAnalysisTools] No logs to analyze. Skipping parallel tools.');
    return {
      analysisResults: {
        datadogErrors: 'No logs retrieved to check for errors.',
        datadogWarnings: 'No logs retrieved to check for warnings.',
      },
      messages: [...messages, new AIMessage('No logs were available for detailed analysis.')],
    };
  }

  // Execute multiple tools in parallel
  const [datadogErrorsResult, datadogWarningsResult] = await Promise.all([
    analyzeDatadogErrorsTool.invoke({ logs: datadogLogs }),
    analyzeDatadogWarningsTool.invoke({ logs: datadogLogs }),
  ]);

  const analysisResults = {
    datadogErrors: datadogErrorsResult,
    datadogWarnings: datadogWarningsResult,
  };

  return {
    analysisResults: analysisResults,
    messages: [
      ...messages,
      new AIMessage('Parallel analysis completed. Proceeding to summarizing findings.'),
    ],
  };
}

// Node 4: Summarize Findings (LLM)
export async function summarizeFindings(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: summarizeFindings] Entering...');
  const { messages, userQuery, analysisResults, entityIds, entityType } = state;

  // Craft a specific prompt for summarization using the analysis results
  const summaryPrompt = `
    Based on the following user query and the subsequent analysis results, provide a concise summary of the problems found and potential next steps.
    
    User Query: ${messages[0].content}

    Analysis Results for ${entityType} IDs (${entityIds.join(', ')}):
    - Datadog Errors: ${analysisResults.datadogErrors}
    - Datadog Warnings: ${analysisResults.datadogWarnings}
    - Sentry Issues: ${analysisResults.sentryErrors}
    - Internal Metrics Anomalies: ${analysisResults.internalMetricsAnomalies}

    Synthesize this information, highlighting critical issues and proposing actionable advice.
    `;

  // Append a new HumanMessage with the summary prompt for the LLM to process
  const messagesForSummary = [...messages, new HumanMessage(summaryPrompt)];
  const response = await llm.invoke(messagesForSummary);

  return {
    finalSummary: response.content,
    messages: [...messagesForSummary, response], // Add LLM's summary message to history
  };
}

// Node 5: Respond to User
export async function respondToUser(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: respondToUser] Entering...');
  // This node just takes the final summary and potentially adds a concluding message
  const finalMessageContent =
    state.finalSummary ||
    "I'm sorry, I couldn't fully analyze the situation. Please try rephrasing your request or provide more details.";
  return {
    messages: [...state.messages, new AIMessage(finalMessageContent)],
  };
}
