import { GenieOfferClient } from '../clients'; // Adjust path as needed
import { EnvironmentType } from '../model/types/general'; // Adjust path as needed
import { GetGenieOfferToolSchema, GetGenieOfferToolSchemaInput } from '../model/schemas';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from '../utils/logger';

const DSS_CALLER_CLIENT_ID = process.env.DSS_CALLER_CLIENT_ID || 'your-default-ai-agent-client-id';

export const genieOfferTool = new DynamicStructuredTool({
  name: 'genieOfferTool',
  description:
    'Fetches detailed information about a specific offer by its ID from the GraphQL server. Useful for retrieving offer attributes like products, countries, prices, and transitions.',
  schema: GetGenieOfferToolSchema as any,
  func: async ({ offerId, environment }: GetGenieOfferToolSchemaInput) => {
    logger.info(`Executing genieOfferTool for offer ID: ${offerId} in environment ${environment}`);

    try {
      const environmentMap: Record<EnvironmentType, 'prod' | 'qa' | 'dev'> = {
        production: 'prod',
        staging: 'qa',
        development: 'dev',
        unknown: 'prod', // Default or handle as appropriate for your setup
      };

      const mappedEnvironment = environmentMap[environment as EnvironmentType];

      const client = new GenieOfferClient(mappedEnvironment, DSS_CALLER_CLIENT_ID);

      const response = await client.fetchOffer(offerId);

      if (response.data?.offer) {
        return {
          offer: response.data.offer,
          message: `Successfully retrieved offer with ID: ${offerId}.`,
        };
      } else if (response.errors && response.errors.length > 0) {
        const errorMessages = response.errors
          .map((err: { message: string }) => err.message)
          .join('; ');
        logger.error('GraphQL errors:', response.errors);
        return {
          offer: null, // Indicate no offer found
          message: `Error fetching offer with ID ${offerId}: ${errorMessages}`,
        };
      } else {
        return {
          offer: null,
          message: `Unknown error fetching offer with ID ${offerId}.`,
        };
      }
    } catch (error) {
      logger.error(`Unexpected error executing genieOfferTool for offer ID ${offerId}:`, error);
      return {
        offer: null,
        message: `Unexpected error fetching offer: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
