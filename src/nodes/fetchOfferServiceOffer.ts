import { AgentStateData, OfferServiceOffer } from '../model';
import { AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { fetchOfferServiceOfferTool } from '../tools';
import { logger } from '../utils';

function generateNewAIMessage(content: string): AIMessage {
  return new AIMessage(content);
}

export async function fetchOfferServiceOffer(
  state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  logger.info(
    '[Node: fetchOfferServiceOfferNode] Attempting to fetch Offer Service Offer details...',
  );

  const { entityType, entityIds, messages, environment } = state;

  if (entityType !== 'offer' || !entityIds || entityIds.length === 0) {
    logger.warn(
      '[Node: fetchOfferServiceOfferNode] Skipping: Not an offer query or no offer IDs provided.',
    );
    return {
      messages: [
        ...messages,
        generateNewAIMessage(
          'Offer Service details fetching skipped: not an offer query or no specific IDs provided.',
        ),
      ],
      offerServiceDetails: state.offerServiceDetails || [],
      analysisResults: {
        ...state.analysisResults,
        offerServiceDetails: 'Offer Service details not fetched (not an offer query or no IDs).',
      },
    };
  }

  const fetchedOffers: OfferServiceOffer[] = [];
  const newMessages: BaseMessage[] = [];
  const failedFetches: string[] = [];
  const analysisResultMessages: string[] = [];

  for (const offerId of entityIds) {
    try {
      const toolCallResult: { offer: OfferServiceOffer | null; message: string } =
        await fetchOfferServiceOfferTool.invoke({
          offerId: offerId,
          environment: environment,
        });


      if (toolCallResult.offer) {
        fetchedOffers.push(toolCallResult.offer);
        newMessages.push(
          generateNewAIMessage(`Successfully fetched details for offer \`${offerId}\`.`),
        );
        analysisResultMessages.push(`Offer ID ${offerId}: ${toolCallResult.message}`);
      } else {
        newMessages.push(
          generateNewAIMessage(`Tool output for offer ${offerId}: ${toolCallResult.message}`),
        );
        failedFetches.push(offerId);
        analysisResultMessages.push(`Offer ID ${offerId}: ${toolCallResult.message}`);
      }
    } catch (error: any) {
      logger.error(
        `[Node: fetchOfferServiceOfferNode] Error invoking tool for offer ${offerId}:`,
        error,
      );
      const errorMessage = `Failed to retrieve details for offer \`${offerId}\` due to an unexpected error. Error: ${error.message}`;

      newMessages.push(generateNewAIMessage(errorMessage));
      failedFetches.push(offerId);
      analysisResultMessages.push(`Offer ID ${offerId}: ${errorMessage}`);
      newMessages.push(
          generateNewAIMessage(
              `Failed to retrieve offer from offer service for \`${offerId}\` due to an error: ${error.message}.`
          )
      );
    }
  }

  let summaryMessage = `Offer Service fetching completed for ${entityIds.length} offers.`;
  if (fetchedOffers.length > 0) {
    summaryMessage += ` Successfully retrieved ${fetchedOffers.length}.`;
  }
  if (failedFetches.length > 0) {
    summaryMessage += ` Failed for ${failedFetches.length} offers: ${failedFetches.join(', ')}.`;
  }
  newMessages.push(generateNewAIMessage(summaryMessage));

  const combinedOfferServiceSummary =
    analysisResultMessages.length > 0
      ? analysisResultMessages.join('\n\n---\n\n')
      : failedFetches.length > 0
        ? `Failed to retrieve any offer details: ${failedFetches.join(', ')}`
        : 'No offer details fetched.';

  return {
    messages: [...messages, ...newMessages],
    offerServiceDetails: fetchedOffers.length > 0 ? fetchedOffers : undefined,
    analysisResults: {
      ...state.analysisResults,
      offerServiceDetails: combinedOfferServiceSummary,
    },
  };
}
