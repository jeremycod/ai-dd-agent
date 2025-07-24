import { AgentStateData } from '../model/agentState';
import { Offer } from '../model/types/genieGraphql'; // Assuming this path is correct for your Offer type
import { BaseMessage } from '@langchain/core/messages';
import { genieOfferTool } from '../tools/genieTools';
import { generateNewAIMessage } from '../utils/auth/helpers'; // Import your genieOfferTool instance
import { logger } from '../utils/logger';
export async function fetchGenieOffer(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: fetchGenieOffer] Attempting to fetch Genie Offer details...');

  const { environment, entityIds, messages } = state; // Destructure callerClientId

  // Basic validation checks
  if (!environment || environment === 'unknown') {
    return {
      messages: [
        ...messages,
        generateNewAIMessage('Environment not specified for fetching Genie offer.'),
      ],
      genieOfferDetails: undefined,
    };
  }

  if (!entityIds || entityIds.length === 0) {
    return {
      messages: [...messages, generateNewAIMessage('No offer IDs provided to fetch Genie offer.')],
      genieOfferDetails: undefined,
    };
  }

  const fetchedOffers: Offer[] = [];
  const newMessages: BaseMessage[] = [];
  const failedFetches: string[] = [];

  for (const offerId of entityIds) {
    try {
      const toolCallResult: { offer: Offer | null; message: string } = await genieOfferTool.invoke({
        offerId: offerId,
        environment: environment,
      });

      if (toolCallResult.offer) {
        fetchedOffers.push(toolCallResult.offer);
        newMessages.push(
          generateNewAIMessage(`Successfully fetched details for offer \`${offerId}\`.`),
        );
      } else {
        newMessages.push(
          generateNewAIMessage(`Tool output for offer ${offerId}: ${toolCallResult.message}`),
        );
        failedFetches.push(offerId);
      }
    } catch (error: any) {
      logger.error(`[Node: fetchGenieOffer] Error invoking tool for offer ${offerId}:`, error);
      newMessages.push(
        generateNewAIMessage(
          `Failed to retrieve details for offer \`${offerId}\` due to an unexpected error. Error: ${error.message}`,
        ),
      );
      failedFetches.push(offerId);
    }
  }

  let summaryMessage = `Genie Offer fetching completed for ${entityIds.length} offers.`;
  if (fetchedOffers.length > 0) {
    summaryMessage += ` Successfully retrieved ${fetchedOffers.length}.`;
  }
  if (failedFetches.length > 0) {
    summaryMessage += ` Failed for ${failedFetches.length} offers: ${failedFetches.join(', ')}.`;
  }

  newMessages.push(generateNewAIMessage(summaryMessage));

  return {
    messages: [...messages, ...newMessages],
    genieOfferDetails: fetchedOffers.length > 0 ? fetchedOffers : undefined,
    analysisResults: {
      ...state.analysisResults,
        genieOfferDetails: summaryMessage,
    }
  };
}
