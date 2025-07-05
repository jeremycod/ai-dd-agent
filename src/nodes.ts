// Helper function to extract IDs and time range from a message
import { AgentState } from './model/agentState';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { UserQueryExtractionSchema, UserQueryExtraction } from './model/schemas';
import { DatadogLog } from './model/datadog';
import { PromptTemplate } from '@langchain/core/prompts';
import { extractionLLM, summarizerLLM } from './anthropicAgent';
import {
  getMockDatadogLogsTool,
  analyzeDatadogWarningsTool,
  analyzeDatadogErrorsTool,
} from './tools/datadogLogsTool';
import { getEntityHistoryTool, analyzeEntityHistoryTool } from './tools/entityHistoryTools';

import { EntityHistory } from './model/history';
import {EXTRACTION_MESSAGE, SUMMARIZATION_MESSAGE, PROMPT} from './constants';
import { StructuredOutputParser } from '@langchain/core/output_parsers';


// Bind the LLM with the structured output schema
const structuredOutputParser = StructuredOutputParser.fromZodSchema(UserQueryExtractionSchema);
// Create the chain that uses the full PROMPT and the structured parser
const structuredExtractionChain = PromptTemplate.fromTemplate(
    PROMPT +
    '\n\n' +
    'Based on the user query and conversation history, classify the query and extract relevant details. Your response MUST be a JSON object conforming to the following schema:\n' +
    '{format_instructions}\n\n' +
    'Conversation History:\n' + // Add history prompt
    '{history}\n' +
    'Current User Query: {query}'
).pipe(extractionLLM).pipe(structuredOutputParser);

export async function parseUserQuery(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Node: parseUserQuery] Parsing user query with LLM for categorization and extraction...');
  const lastMessage = state.messages[state.messages.length - 1];

  if (!(lastMessage instanceof HumanMessage)) {
    console.warn('[Node: parseUserQuery] Last message is not a HumanMessage. Cannot parse.');
    return state;
  }

  const currentUserQueryContent = lastMessage.content;
  let extractedData: UserQueryExtraction = { // Initialize with safe defaults
    category: 'UNKNOWN_CATEGORY',
    entityIds: [],
    entityType: 'unknown',
    environment: 'unknown',
    timeRange: '24h',
    initialResponse: "I'm currently processing your request.", // Default processing message
  };

  let agentResponseContent: string = extractedData.initialResponse; // Initialize from default extractedData

  try {
    // Prepare the conversation history for the LLM
    // Filter out any SystemMessages that might be in the state if not needed by your LLM/model
    const historyMessages = state.messages
        .filter(msg => !(msg instanceof SystemMessage)) // Keep only Human and AI messages
        .map(msg => `${msg instanceof HumanMessage ? 'Human' : 'AI'}: ${msg.content}`)
        .join('\n');

    // Invoke the structured extraction chain
    extractedData = await structuredExtractionChain.invoke({
      query: currentUserQueryContent,
      history: historyMessages, // Pass the formatted history
      format_instructions: structuredOutputParser.getFormatInstructions(),
    });

    console.log('[Node: parseUserQuery] LLM Extracted Data:', extractedData);

    // The initialResponse from LLM directly becomes the first part of the AI's message
    agentResponseContent = extractedData.initialResponse;

    // --- RE-INTEGRATED EXPLICIT CLARIFICATION LOGIC ---
    // Only ask for environment if category is not UNKNOWN or GENERAL_QUESTION,
    // AND environment is unknown, AND the LLM's initial response doesn't already ask for it.
    if (
        extractedData.environment === 'unknown' &&
        extractedData.category !== 'UNKNOWN_CATEGORY' &&
        extractedData.category !== 'GENERAL_QUESTION' &&
        !agentResponseContent.toLowerCase().includes('environment') && // Simple check to avoid redundancy
        !agentResponseContent.toLowerCase().includes('prod') && // More robust check
        !agentResponseContent.toLowerCase().includes('qa') &&
        !agentResponseContent.toLowerCase().includes('staging') &&
        !agentResponseContent.toLowerCase().includes('dev') &&
        !agentResponseContent.toLowerCase().includes('development')
    ) {
      const clarificationMsg = ' Which environment (production, staging, or development) is this in?';
      // Append to the LLM's generated response
      agentResponseContent += clarificationMsg;
    }

  } catch (error) {
    console.error('[Node: parseUserQuery] Error during LLM extraction or parsing. Falling back to UNKNOWN_CATEGORY:', error);
    extractedData = {
      category: 'UNKNOWN_CATEGORY',
      entityIds: [],
      entityType: 'unknown',
      environment: 'unknown',
      timeRange: '24h',
      initialResponse: "I apologize, I had trouble understanding your request. Could you please rephrase it or provide more details?",
    };
    agentResponseContent = extractedData.initialResponse;
  }

  // --- MERGING LOGIC FOR CONTEXT RETENTION ---
  // Ensure default values are handled if LLM doesn't provide them,
  // or if they are explicitly 'unknown' and we have previous state.

  const finalEntityIds =
      (extractedData.entityIds && extractedData.entityIds.length > 0)
          ? extractedData.entityIds
          : state.entityIds; // Retain from previous state if no new IDs extracted

  const finalEntityType =
      extractedData.entityType && extractedData.entityType !== 'unknown'
          ? extractedData.entityType
          : state.entityType; // Retain from previous state

  const finalEnvironment =
      extractedData.environment && extractedData.environment !== 'unknown'
          ? extractedData.environment
          : state.environment; // Retain from previous state

  const finalTimeRange = extractedData.timeRange || state.timeRange || '24h'; // Default '24h'

  // Construct new messages to add to the state history
  // The LLM's generated `initialResponse` (potentially modified) is now the agent's first message for this turn.
  console.log('Final agentResponseContent for AIMessage:', agentResponseContent);
  const newMessages: BaseMessage[] = [
    new AIMessage({
      content: agentResponseContent,
      additional_kwargs: {}, // Explicitly provide an empty object
    })
  ];

  return {
    messages: [...state.messages, ...newMessages], // Append LLM's response to history
    queryCategory: extractedData.category,
    entityIds: finalEntityIds,
    entityType: finalEntityType,
    environment: finalEnvironment,
    timeRange: finalTimeRange,
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
  const summarizationSystemMessage = new SystemMessage(SUMMARIZATION_MESSAGE);

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
    console.log('Messages being sent to LLM:', JSON.stringify(messagesForLLMCall, null, 2));
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
