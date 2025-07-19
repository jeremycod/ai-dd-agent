import { AgentStateData } from '../model/agentState';
import { OfferPriceResponse } from '../model/types/UPS'; // Ensure this correctly defines your types
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { upsOfferPriceTool } from '../tools/upsTools';
import {generateNewAIMessage} from "../utils/auth/helpers"; // Import your tool instance
import { logger } from '../utils/logger';
export async function fetchUPSOfferPrice(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: fetchUPSOfferPrice] Attempting to fetch UPS Offer Price...');

  const { environment, entityIds, messages } = state;

  if (!environment || environment === 'unknown') {
    return {
      messages: [
        ...messages,
        generateNewAIMessage('Environment not specified for fetching UPS offer price.'),
      ],
      offerPriceDetails: undefined,
    };
  }

  if (!entityIds || entityIds.length === 0) {
    return {
      messages: [...messages, generateNewAIMessage('No offer IDs provided to fetch UPS offer price.')],
      offerPriceDetails: undefined,
    };
  }

  const offerPrices: OfferPriceResponse[] = [];
  const newMessages: BaseMessage[] = [];
  const failedFetches: string[] = [];

  // Loop through each entityId and invoke the tool for each one
  for (const offerId of entityIds) {
    try {
      // Invoke the tool for a single offerId and environment
      // The tool returns OfferPriceResponse directly or an error string
      const toolCallResult: OfferPriceResponse | string = await upsOfferPriceTool.invoke({
        offerId: offerId,
        environment: environment,
      });

      if (typeof toolCallResult === 'string') {
        // If the tool returns a string, it indicates an error or summary
        newMessages.push(generateNewAIMessage(`Tool output for offer ${offerId}: ${toolCallResult}`));
        failedFetches.push(offerId);
      } else {
        // If it returns an OfferPriceResponse object, it's a success
        offerPrices.push(toolCallResult);
        newMessages.push(
          generateNewAIMessage(`Successfully fetched price details for offer \`${offerId}\`.`),
        );
      }
    } catch (error: any) {
      logger.error(`[Node: fetchUPSOfferPrice] Error invoking tool for offer ${offerId}:`, error);
      newMessages.push(
        generateNewAIMessage(
          `Failed to retrieve price for offer \`${offerId}\` due to an unexpected error. Error: ${error.message}`,
        ),
      );
      failedFetches.push(offerId);
    }
  }

  let summaryMessage = `UPS Offer Price fetching completed for ${entityIds.length} offers.`;
  if (offerPrices.length > 0) {
    summaryMessage += ` Successfully retrieved ${offerPrices.length}.`;
  }
  if (failedFetches.length > 0) {
    summaryMessage += ` Failed for ${failedFetches.length} offers: ${failedFetches.join(', ')}.`;
  }

  newMessages.push(generateNewAIMessage(summaryMessage));

  return {
    messages: [...messages, ...newMessages],
    offerPriceDetails: offerPrices.length > 0 ? offerPrices : undefined,
  };
}
