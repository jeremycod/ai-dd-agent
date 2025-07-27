// src/tools/offerServiceTools.ts

import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from '../utils';
import {
  GetOfferServiceOfferToolSchema,
  GetOfferServiceOfferToolSchemaInput,
  EnvironmentType,
  OfferServiceOffer,
  OfferServiceResponse,
} from '../model';
import { OfferServiceClient } from '../clients';

// Make sure this type is correctly defined and exported!
export type FetchOfferServiceToolOutput = {
  offer: OfferServiceOffer | null;
  message: string;
};

export const fetchOfferServiceOfferTool = new DynamicStructuredTool({
  name: 'fetchOfferServiceOffer',
  description:
    "Retrieves detailed information about a specific offer from the Offer Service using its ID. Use this when the user's query is about 'offers' and specific offer IDs are available.",
  schema: GetOfferServiceOfferToolSchema as any,
  // Ensure the func's return type matches FetchOfferServiceToolOutput
  func: async ({
    offerId,
    environment,
  }: GetOfferServiceOfferToolSchemaInput): Promise<FetchOfferServiceToolOutput> => {
    // <--- THIS IS CRUCIAL
    logger.info(
      `Executing getOfferServiceOfferTool for offer ID: ${offerId} in environment ${environment} `,
    );
    try {
      const environmentMap: Record<EnvironmentType, 'prod' | 'qa' | 'dev'> = {
        production: 'prod',
        staging: 'qa',
        development: 'dev',
        unknown: 'prod',
      };

      const mappedEnvironment = environmentMap[environment];
      const offerServiceClient = new OfferServiceClient(mappedEnvironment);
      const response: OfferServiceResponse = await offerServiceClient.getOfferById(offerId);

      if (!response.success) {
        return {
          offer: null,
          message: `Failed to retrieve offer ${offerId}: ${response.error || 'Unknown error'}`,
        };
      }

      if (!response.data || !response.data.offers || response.data.offers.length === 0) {
        return {
          offer: null,
          message: `Offer with ID ${offerId} not found or no data returned.`,
        };
      }

      const offer = response.data.offers[0];
      return {
        offer: offer,
        message: `Successfully retrieved offer details for ID: ${offerId}.`,
      };
    } catch (error) {
      logger.error(`Error in fetchOfferServiceOfferTool for ${offerId}:`, error);
      return {
        offer: null,
        message: `An unexpected error occurred while fetching offer ${offerId}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
