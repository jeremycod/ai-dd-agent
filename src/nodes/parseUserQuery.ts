import { AgentStateData } from '../model/agentState';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { UserQueryExtraction } from '../model/schemas';
import { PromptTemplate } from '@langchain/core/prompts';
import { extractionLLM } from '../anthropicAgent';
import { EXTRACTION_PROMPT_TEMPLATE } from '../constants';
import { generateNewAIMessage } from '../utils/auth/helpers';
import { logger } from '../utils/logger';
import {getDynamicTimeRangeFallback} from "../utils/timeHelpers";
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
    category: 'UNKNOWN_CATEGORY',
    entityIds: [],
    entityType: 'unknown',
    environment: 'unknown',
    timeRange: '24h',
    initialResponse: "I'm currently processing your request.", // Default processing message
  };

  let agentResponseContent: string = extractedData.initialResponse; // Initialize from default extractedData

  try {
    // Filter out any SystemMessages that might be in the state if not needed by LLM/model
    const historyMessages = state.messages
      .filter((msg: BaseMessage) => !(msg instanceof SystemMessage)) // Keep only Human and AI messages
      .map((msg) => `${msg instanceof HumanMessage ? 'Human' : 'AI'}: ${msg.content}`)
      .join('\n');

    extractedData = (await structuredExtractionChain.invoke({
      query: currentUserQueryContent,
      history: historyMessages,
    })) as UserQueryExtraction;

    agentResponseContent = extractedData.initialResponse;

    // Check for entity type clarification
    if (
      extractedData.entityType === 'unknown' &&
      extractedData.entityIds.length > 0 &&
      extractedData.category !== 'UNKNOWN_CATEGORY' &&
      extractedData.category !== 'GENERAL_QUESTION' &&
      !agentResponseContent.toLowerCase().includes('offer') &&
      !agentResponseContent.toLowerCase().includes('campaign') &&
      !agentResponseContent.toLowerCase().includes('product') &&
      !agentResponseContent.toLowerCase().includes('package')
    ) {
      const entityTypeClarificationMsg =
        ` I see you've provided the ID \`${extractedData.entityIds[0]}\`. Could you please specify if this is an offer, campaign, product, or package?`;
      agentResponseContent += entityTypeClarificationMsg;
    }

    // Check for environment clarification
    if (
      extractedData.environment === 'unknown' &&
      extractedData.category !== 'UNKNOWN_CATEGORY' &&
      extractedData.category !== 'GENERAL_QUESTION' &&
      !agentResponseContent.toLowerCase().includes('environment') &&
      !agentResponseContent.toLowerCase().includes('prod') &&
      !agentResponseContent.toLowerCase().includes('qa') &&
      !agentResponseContent.toLowerCase().includes('staging') &&
      !agentResponseContent.toLowerCase().includes('dev') &&
      !agentResponseContent.toLowerCase().includes('development')
    ) {
      const environmentClarificationMsg =
        ' Which environment (production, staging, or development) should I investigate this in?';
      agentResponseContent += environmentClarificationMsg;
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

  const finalEntityIds =
    extractedData.entityIds && extractedData.entityIds.length > 0
      ? extractedData.entityIds
      : state.entityIds;

  const finalEntityType =
    extractedData.entityType && extractedData.entityType !== 'unknown'
      ? extractedData.entityType
      : state.entityType; // Retain from previous state

  const finalEnvironment =
    extractedData.environment && extractedData.environment !== 'unknown'
      ? extractedData.environment
      : state.environment; // Retain from previous state

  const finalTimeRange = extractedData.timeRange || state.timeRange || getDynamicTimeRangeFallback();

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
