

import { AgentStateData } from '../model';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { SUMMARIZATION_MESSAGE } from '../constants';
import { summarizerLLM } from '../anthropicAgent';
import { generateNewAIMessage, generateNewHumanMessage, logger } from '../utils';

export async function summarizeFindings(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: summarizeFindings] Entering...');
  const { messages, userQuery, analysisResults, entityIds, entityType, similarCases, relevantPatterns } = state;



  const summarizationSystemMessage = new SystemMessage(SUMMARIZATION_MESSAGE);



  const initialUserQueryContent =
      messages.find((msg: BaseMessage) => msg instanceof HumanMessage)?.content || userQuery;


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




  let historicalContext = '';
  if (similarCases && similarCases.length > 0) {
    historicalContext = `\n\nHistorical Context from Similar Cases:\n`;
    similarCases.slice(0, 3).forEach((similarCase: any, index: number) => {
      historicalContext += `\n${index + 1}. Previous Case: "${similarCase.userQuery}"\n`;
      historicalContext += `   - Diagnosis: ${similarCase.finalSummary || 'No summary available'}\n`;
      historicalContext += `   - Tools Used: ${similarCase.toolsUsed?.join(', ') || 'Unknown'}\n`;
      

      if (similarCase.overallRlReward !== undefined) {
        const successIndicator = similarCase.overallRlReward > 0 ? 'Successful' : 
                                similarCase.overallRlReward < 0 ? 'Unsuccessful' : 'Neutral';
        historicalContext += `   - Outcome: ${successIndicator} (reward: ${similarCase.overallRlReward})\n`;
      }
      

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




  const relevantHistoryWithoutSystemMessages = messages.filter(
      (msg: BaseMessage) => !(msg instanceof SystemMessage),
  );


  const messagesForLLMCall: BaseMessage[] = [
    summarizationSystemMessage,
    ...relevantHistoryWithoutSystemMessages,
    generateNewHumanMessage(dataForSummaryPrompt),
  ];

  try {
    const response = await summarizerLLM.invoke(messagesForLLMCall);
    const finalSummaryText = response.content;



    const updatedMessages = [...messages, response];

    return {
      finalSummary: finalSummaryText,
      messages: updatedMessages,
      dataForSummaryPrompt,
    };
  } catch (error) {
    logger.error('[Node: summarizeFindings] Error summarizing findings:', error);

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