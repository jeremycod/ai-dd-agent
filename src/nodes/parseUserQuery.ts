import { AgentStateData } from '../model/agentState';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { UserQueryExtraction } from '../model/schemas';
import { PromptTemplate } from '@langchain/core/prompts';
import { extractionLLM } from '../anthropicAgent';
import { EXTRACTION_PROMPT_TEMPLATE } from '../constants';
import { generateNewAIMessage } from '../utils/auth/helpers';
import { logger } from '../utils/logger';
import {getDynamicTimeRangeFallback} from "../utils/timeHelpers";
// Create the chain that uses the full PROMPT and the structured parser
const structuredExtractionChain = PromptTemplate.fromTemplate(EXTRACTION_PROMPT_TEMPLATE).pipe(
  extractionLLM,
);



export async function parseUserQuery(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info(
    '[Node: parseUserQuery] Parsing user query with LLM for categorization and extraction...',
  );
  const lastMessage = state.messages[state.messages.length - 1];

  if (!(lastMessage instanceof HumanMessage)) {
    console.warn('[Node: parseUserQuery] Last message is not a HumanMessage. Cannot parse.');
    return state;
  }

  const currentUserQueryContent = lastMessage.content;
  let extractedData: UserQueryExtraction = {
    // Initialize with safe defaults
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
      .filter((msg: BaseMessage) => !(msg instanceof SystemMessage)) // Keep only Human and AI messages
      .map((msg) => `${msg instanceof HumanMessage ? 'Human' : 'AI'}: ${msg.content}`)
      .join('\n');

    // Invoke the structured extraction chain
    extractedData = (await structuredExtractionChain.invoke({
      query: currentUserQueryContent,
      history: historyMessages,
      //format_instructions: structuredOutputParser.getFormatInstructions(),
    })) as UserQueryExtraction;

    //logger.info('[Node: parseUserQuery] LLM Extracted Data:', extractedData);

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
      const clarificationMsg =
        ' Which environment (production, staging, or development) is this in?';
      // Append to the LLM's generated response
      agentResponseContent += clarificationMsg;
    }
  } catch (error) {
    logger.error(
      '[Node: parseUserQuery] Error during LLM extraction or parsing. Falling back to UNKNOWN_CATEGORY:',
      error,
    );
    extractedData = {
      category: 'UNKNOWN_CATEGORY',
      entityIds: [],
      entityType: 'unknown',
      environment: 'unknown',
      timeRange: '24h',
      initialResponse:
        'I apologize, I had trouble understanding your request. Could you please rephrase it or provide more details?',
    };
    agentResponseContent = extractedData.initialResponse;
  }

  // --- MERGING LOGIC FOR CONTEXT RETENTION ---
  // Ensure default values are handled if LLM doesn't provide them,
  // or if they are explicitly 'unknown' and we have previous state.

  const finalEntityIds =
    extractedData.entityIds && extractedData.entityIds.length > 0
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

  const finalTimeRange = extractedData.timeRange || state.timeRange || getDynamicTimeRangeFallback();

  // Construct new messages to add to the state history
  // The LLM's generated `initialResponse` (potentially modified) is now the agent's first message for this turn.
  logger.info('Final agentResponseContent for AIMessage:', agentResponseContent);
  const newMessages: BaseMessage[] = [generateNewAIMessage(agentResponseContent)];

  return {
    messages: [...state.messages, ...newMessages], // Append LLM's response to history
    queryCategory: extractedData.category,
    entityIds: finalEntityIds,
    entityType: finalEntityType,
    environment: finalEnvironment,
    timeRange: finalTimeRange,
  };
}
