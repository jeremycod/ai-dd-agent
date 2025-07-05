// Helper function to extract IDs and time range from a message
import { AgentState } from './model/agentState';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { UserQueryExtractionSchema, UserQueryExtraction } from './model/schemas';
import { DatadogLog } from './model/datadog';
import { extractionLLM, summarizerLLM } from './anthropicAgent';
import {
  getMockDatadogLogsTool,
  analyzeDatadogWarningsTool,
  analyzeDatadogErrorsTool,
} from './tools/datadogLogsTool';
import { getEntityHistoryTool, analyzeEntityHistoryTool } from './tools/entityHistoryTools';

import { EntityHistory } from './model/history';

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

// Bind the LLM with the structured output schema
const structuredExtractionChain = extractionLLM.withStructuredOutput(UserQueryExtractionSchema);

export async function parseUserQuery(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: parseUserQuery] Parsing user query with LLM...');
  const lastMessage = state.messages[state.messages.length - 1]; // This is the current turn's input

  if (!(lastMessage instanceof HumanMessage)) {
    console.warn('[Node: parseUserQuery] Last message is not a HumanMessage. Cannot parse.');
    return state;
  }

  // The content of the *current* user query (e.g., "production")
  const currentUserQueryContent = lastMessage.content;

  let extractedData: UserQueryExtraction;
  let clarificationMessage = '';

  try {
    // --- REAL LLM CALL HERE ---
    // The SystemMessage is now updated to tell the LLM to consider the entire history.
    const extractionSystemMessage = new SystemMessage(EXTRACTION_MESSAGE);

    // Pass the ENTIRE RELEVANT CONVERSATION HISTORY to the LLM for context.
    // Important: Filter out any existing SystemMessages from `state.messages`
    // if your `structuredExtractionChain` already prepends its own SystemMessage
    // or if you're using Anthropic models that only allow SystemMessage as the first.
    const messagesForLLMExtraction: BaseMessage[] = [
      extractionSystemMessage,
      // Pass all Human and AI messages from the state's history.
      // This is crucial for the LLM to understand conversational context.
      ...state.messages.filter((msg) => !(msg instanceof SystemMessage)), // Remove previous SystemMessages if necessary
      // If the last message is already in state.messages, you don't need to add it again here.
      // However, if `state.messages` only includes previous turns and the current one is meant to be added for this LLM call,
      // then `new HumanMessage(currentUserQueryContent)` would go here.
      // Given your current setup, `state.messages` already includes the latest user query when passed to this node.
    ];

    extractedData = await structuredExtractionChain.invoke(messagesForLLMExtraction);
    console.log('[Node: parseUserQuery] LLM Extracted Data:', extractedData);

    // LangChain's structured output should handle environment validation,
    // but we'll add a final check and clarification message logic based on 'unknown'
    if (extractedData.environment === 'unknown') {
      clarificationMessage =
        'Which environment (production, staging, or development) is this entity in?';
    }
  } catch (error) {
    console.error('[Node: parseUserQuery] Error during LLM extraction:', error);
    // Fallback if LLM extraction fails (e.g., API error, invalid JSON from LLM)
    clarificationMessage =
      'I had trouble understanding your request. Could you please rephrase it, ensuring to include the entity ID, type, and environment?';
    extractedData = {
      // Default to unknown if extraction fails
      entityIds: [],
      entityType: 'unknown',
      environment: 'unknown',
      timeRange: '24h', // Default time range
    };
  }

  const newMessages: BaseMessage[] = [];
  if (clarificationMessage) {
    newMessages.push(new AIMessage(clarificationMessage));
  }

  // --- MERGING LOGIC FOR CONTEXT RETENTION ---
  // If the LLM didn't extract new entityIds, retain the ones from the previous state.
  const finalEntityIds =
    extractedData.entityIds && extractedData.entityIds.length > 0
      ? extractedData.entityIds
      : state.entityIds;

  // If the LLM didn't extract a new entityType, retain the one from the previous state.
  const finalEntityType =
    extractedData.entityType !== 'unknown' ? extractedData.entityType : state.entityType;

  // If the LLM extracted a valid environment in this turn, use it. Otherwise, keep the existing one.
  const finalEnvironment =
    extractedData.environment !== 'unknown' ? extractedData.environment : state.environment;

  // Retain timeRange if not newly specified
  const finalTimeRange = extractedData.timeRange || state.timeRange || '24h';

  return {
    entityIds: finalEntityIds,
    entityType: finalEntityType,
    environment: finalEnvironment,
    timeRange: finalTimeRange,
    // Ensure the message history is correctly appended.
    // `state.messages` already contains all previous messages PLUS the current user's input.
    // We then append any new clarification messages from this node.
    messages: [...state.messages, ...newMessages],
  };
}

/**
 * Node: ask_environment_clarification
 * This node is a placeholder. Its primary purpose is to be a target
 * for a conditional edge when the environment is unknown.
 * The clarification message is already added to state.messages by parseUserQuery.
 * This node ensures the graph ends and the message is returned to the user.
 */
export async function ask_environment_clarification(
  state: AgentState,
): Promise<Partial<AgentState>> {
  console.log(
    '[Node: ask_environment_clarification] Environment needs clarification. Signaling graph end.',
  );
  // No complex logic needed here, as parseUserQuery already added the message.
  // We just return the current state, and the graph will typically END after this node.
  return state;
}

// Node 2a: Fetch Entity History
export async function fetchEntityHistory(
  state: AgentStateAnnotation.State,
): Promise<Partial<AgentState>> {
  console.log('[Node: fetchEntityHistory] Fetching entity history...');
  const { entityIds, entityType, environment, messages } = state;
  if (entityIds.length === 0) {
    console.warn('[Node: fetchEntityHistory] No entity IDs to fetch history for.');
    return {
      entityHistory: [],
      messages: [
        ...messages,
        new AIMessage('Could not fetch Entity History as no specific IDs were identified.'),
      ],
    };
  }
  // Call the getEntityHistory tool
  const toolCallResult = await getEntityHistoryTool.invoke({
    ids: entityIds,
    environment: environment,
    entityType: entityType,
    limit: 10,
  });

  // LangGraph expects `messages` to be appended and the next step can use it
  // For this pattern, we want to store the actual logs separately for analysis.
  return {
    entityHistory: (toolCallResult as { history: EntityHistory[] }).history,
    messages: [
      ...messages,
      new AIMessage('Fetched Entity History. Proceeding to parallel analysis.'),
    ], // Add tool output to history for LLM context
  };
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

// --- NEW Parallel Node Orchestrator ---
export async function fetchParallelData(
  state: AgentState, // Use your defined AgentState type
): Promise<Partial<AgentState>> {
  console.log('[Node: fetchParallelData] Starting parallel data fetching...');

  // Create promises for both data fetches
  const fetchHistoryPromise = fetchEntityHistory(state);
  const fetchLogsPromise = fetchDatadogLogs(state);

  // Wait for both promises to resolve
  const [historyResult, logsResult] = await Promise.all([fetchHistoryPromise, fetchLogsPromise]);

  console.log('[Node: fetchParallelData] Parallel data fetching complete.');

  // Combine the results from both fetches
  // Ensure that 'messages' from each sub-function are merged correctly.
  // We want to preserve the original messages and then append new ones from both operations.
  const newMessages = [
    ...(historyResult.messages || []), // Ensure it's an array and handle undefined
    ...(logsResult.messages || []),
  ];

  return {
    ...historyResult, // This will bring in entityHistory and its messages
    ...logsResult, // This will bring in datadogLogs and its messages (overwriting historyResult's messages if present)
    messages: [...state.messages, ...newMessages], // Prepend original messages, then append new
  };
}

// Node 3: Run Parallel Analysis Tools
export async function runParallelAnalysisTools(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: runParallelAnalysisTools] Entering...');
  const { datadogLogs, entityIds, timeRange, messages, entityHistory } = state;

  if (datadogLogs.length === 0 && entityHistory.length === 0) {
    console.log('[Node: runParallelAnalysisTools] No logs to analyze. Skipping parallel tools.');
    return {
      analysisResults: {
        datadogErrors: 'No logs retrieved to check for errors.',
        datadogWarnings: 'No logs retrieved to check for warnings.',
        entityHistory: 'No entity history found',
      },
      messages: [...messages, new AIMessage('No logs were available for detailed analysis.')],
    };
  }

  // Execute multiple tools in parallel
  const [datadogErrorsResult, datadogWarningsResult, entityHistoryResult] = await Promise.all([
    analyzeDatadogErrorsTool.invoke({ logs: datadogLogs }),
    analyzeDatadogWarningsTool.invoke({ logs: datadogLogs }),
    analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }),
  ]);

  const analysisResults = {
    datadogErrors: datadogErrorsResult,
    datadogWarnings: datadogWarningsResult,
    entityHistory: entityHistoryResult,
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

  // Define the SystemMessage specifically for the summarization task.
  // This will be the FIRST message sent to the Anthropic LLM for this call.
  const summarizationSystemMessage = new SystemMessage(
    'You are an AI assistant tasked with summarizing diagnostic findings. ' +
      'Review the provided conversation history, Datadog logs, entity history, and any analysis results. ' +
      'Synthesize this information into a concise, clear, and actionable final summary for the user. ' +
      '**Always format your summary using Markdown, including headings, lists, bold text, and code blocks where appropriate.** ' +
      'Highlight the identified problem, evidence, and any next steps or recommendations.',
  );

  // Craft the content of the HumanMessage that will provide the data to be summarized.
  // We'll try to get the initial user query from messages, falling back to userQuery string if needed.
  const initialUserQueryContent =
    messages.find((msg) => msg instanceof HumanMessage)?.content || userQuery;

  const dataForSummaryPrompt = `
    Based on the following user query and the subsequent analysis results, provide a concise summary of the problems found and potential next steps.
    
    User Query: ${initialUserQueryContent}

    Analysis Results for ${entityType} IDs (${entityIds.join(', ')}):
    - Datadog Errors: ${analysisResults.datadogErrors || 'N/A'}
    - Datadog Warnings: ${analysisResults.datadogWarnings || 'N/A'}
    - History of recent changes: ${analysisResults.entityHistory || 'N/A'}

    Synthesize this information, highlighting critical issues and proposing actionable advice.
  `;

  // Filter out ANY existing SystemMessages from the state.messages array.
  // This is crucial because Anthropic only allows one SystemMessage, and it must be the first.
  // We are explicitly providing the summarizationSystemMessage as the first message for this call.
  const relevantHistoryWithoutSystemMessages = messages.filter(
    (msg) => !(msg instanceof SystemMessage),
  );

  // Construct the final array of messages to send to the Anthropic LLM for this specific invocation.
  const messagesForLLMCall: BaseMessage[] = [
    summarizationSystemMessage, // 1. The specific SystemMessage for summarization
    ...relevantHistoryWithoutSystemMessages, // 2. All previous Human and AI messages from the state
    new HumanMessage(dataForSummaryPrompt), // 3. The current HumanMessage containing data for summarization
  ];

  try {
    const response = await summarizerLLM.invoke(messagesForLLMCall); // Invoke the LLM with the correctly structured messages
    const finalSummaryText = response.content;

    // Append the LLM's summary (which is an AIMessage) to the overall state history.
    // Ensure you're appending 'response' directly which is an AIMessage
    const updatedMessages = [...messages, response];

    return {
      finalSummary: finalSummaryText,
      messages: updatedMessages,
    };
  } catch (error) {
    console.error('[Node: summarizeFindings] Error summarizing findings:', error);
    // Provide a fallback summary/message if the LLM call fails
    return {
      finalSummary: 'Failed to generate a summary due to an internal error.',
      messages: [
        ...messages,
        new AIMessage(
          'I encountered an error while summarizing the findings. Please check the logs.',
        ),
      ],
    };
  }
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
