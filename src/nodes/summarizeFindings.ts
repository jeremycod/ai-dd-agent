// src/nodes/summarizeFindings.ts

import { AgentStateData } from '../model';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { SUMMARIZATION_MESSAGE } from '../constants';
import { summarizerLLM } from '../anthropicAgent';
import { generateNewAIMessage, generateNewHumanMessage, logger } from '../utils';

export async function summarizeFindings(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: summarizeFindings] Entering...');
  const { messages, userQuery, analysisResults, entityIds, entityType, similarCases, relevantPatterns } = state;

  // Define the SystemMessage specifically for the summarization task.
  // This will be the FIRST message sent to the Anthropic LLM for this call.
  const summarizationSystemMessage = new SystemMessage(SUMMARIZATION_MESSAGE);

  // Craft the content of the HumanMessage that will provide the data to be summarized.
  // We'll try to get the initial user query from messages, falling back to userQuery string if needed.
  const initialUserQueryContent =
      messages.find((msg: BaseMessage) => msg instanceof HumanMessage)?.content || userQuery;

  // --- Start of Changes for Offer Comparison ---
  let offerComparisonSummary = '';
  if (entityType === 'offer' && entityIds && entityIds.length > 0) {
    logger.info('[Node: summarizeFindings] Preparing offer comparison summaries.');
    for (const offerId of entityIds) {
      const comparisonKey = `offerComparison_${offerId}`;
      if (analysisResults && (analysisResults as any)[comparisonKey]) {
        offerComparisonSummary += `\n- Offer ID ${offerId} Comparison: ${
            (analysisResults as any)[comparisonKey]
        }`;
      } else {
        offerComparisonSummary += `\n- Offer ID ${offerId} Comparison: No specific comparison data available.`;
      }
    }
  } else {
    logger.info('[Node: summarizeFindings] No offer comparison needed for summarization.');
  }
  // --- End of Changes for Offer Comparison ---


  // Build historical context from similar cases
  let historicalContext = '';
  if (similarCases && similarCases.length > 0) {
    historicalContext = `\n\nHistorical Context from Similar Cases:\n`;
    similarCases.slice(0, 3).forEach((similarCase: any, index: number) => {
      historicalContext += `\n${index + 1}. Previous Case: "${similarCase.userQuery}"\n`;
      historicalContext += `   - Diagnosis: ${similarCase.finalSummary || 'No summary available'}\n`;
      historicalContext += `   - Tools Used: ${similarCase.toolsUsed?.join(', ') || 'Unknown'}\n`;
      
      // Use overallRlReward to indicate success (positive = successful)
      if (similarCase.overallRlReward !== undefined) {
        const successIndicator = similarCase.overallRlReward > 0 ? 'Successful' : 
                                similarCase.overallRlReward < 0 ? 'Unsuccessful' : 'Neutral';
        historicalContext += `   - Outcome: ${successIndicator} (reward: ${similarCase.overallRlReward})\n`;
      }
      
      // Include tool effectiveness if available (from enhanced cases)
      if (similarCase.toolContributions) {
        const effectiveTools = Object.entries(similarCase.toolContributions)
          .filter(([_, contrib]: [string, any]) => contrib.wasUseful)
          .map(([toolName, _]) => toolName);
        if (effectiveTools.length > 0) {
          historicalContext += `   - Most Effective Tools: ${effectiveTools.join(', ')}\n`;
        }
      }
    });
  }

  // Build pattern context
  let patternContext = '';
  if (relevantPatterns && relevantPatterns.length > 0) {
    patternContext = `\n\nRelevant Patterns:\n`;
    relevantPatterns.forEach((pattern: any, index: number) => {
      patternContext += `\n${index + 1}. Pattern for ${pattern.category} in ${pattern.environment}:\n`;
      patternContext += `   - Common Tools: ${pattern.commonTools?.join(', ') || 'None'}\n`;
      patternContext += `   - Success Rate: ${Math.round((pattern.successRate || 0) * 100)}%\n`;
      patternContext += `   - Usage Count: ${pattern.usageCount || 0}\n`;
    });
  }

  const dataForSummaryPrompt = `
    Based on the following user query and the subsequent analysis results, provide a concise summary of the problems found and potential next steps.
    
    User Query: ${initialUserQueryContent}

    Analysis Results for ${entityType} IDs (${entityIds.join(', ')}):
    - Datadog Errors: ${analysisResults.datadogErrors || 'N/A'}
    - Datadog Warnings: ${analysisResults.datadogWarnings || 'N/A'}
    - History of recent changes: ${analysisResults.entityHistory || 'N/A'}
    ${offerComparisonSummary}
    ${historicalContext}
    ${patternContext}

    Synthesize this information, highlighting critical issues and proposing actionable advice. 
    Pay special attention to patterns from similar historical cases and whether the current issue matches known patterns.
  `;

  // Filter out ANY existing SystemMessages from the state.messages array.
  // This is crucial because Anthropic only allows one SystemMessage, and it must be the first.
  // We are explicitly providing the summarizationSystemMessage as the first message for this call.
  const relevantHistoryWithoutSystemMessages = messages.filter(
      (msg: BaseMessage) => !(msg instanceof SystemMessage),
  );

  // Construct the final array of messages to send to the Anthropic LLM for this specific invocation.
  const messagesForLLMCall: BaseMessage[] = [
    summarizationSystemMessage, // 1. The specific SystemMessage for summarization
    ...relevantHistoryWithoutSystemMessages, // 2. All previous Human and AI messages from the state
    generateNewHumanMessage(dataForSummaryPrompt), // 3. The current HumanMessage containing data for summarization
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
      dataForSummaryPrompt,
    };
  } catch (error) {
    logger.error('[Node: summarizeFindings] Error summarizing findings:', error);
    // Provide a fallback summary/message if the LLM call fails
    return {
      finalSummary: 'Failed to generate a summary due to an internal error.',
      messages: [
        ...messages,
        generateNewAIMessage(
            'I encountered an error while summarizing the findings. Please check the logs.',
        ),
      ],
    };
  }
}