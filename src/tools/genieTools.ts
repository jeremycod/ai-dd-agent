import { GenieOfferClient } from '../clients/GenieOfferClient'; // Adjust path as needed
import { EnvironmentType } from '../model/types/general'; // Adjust path as needed
import { GetGenieOfferToolSchema, GetGenieOfferToolSchemaInput } from '../model/schemas';
import { DynamicStructuredTool } from '@langchain/core/tools';

const DSS_CALLER_CLIENT_ID = process.env.DSS_CALLER_CLIENT_ID || 'your-default-ai-agent-client-id';

export const genieOfferTool = new DynamicStructuredTool({
  name: 'genieOfferTool',
  description:
    'Fetches detailed information about a specific offer by its ID from the GraphQL server. Useful for retrieving offer attributes like products, countries, prices, and transitions.',
  schema: GetGenieOfferToolSchema as any, // Cast to any is often needed for DynamicStructuredTool's schema due to Zod's complex types
  func: async ({ offerId, environment }: GetGenieOfferToolSchemaInput) => {
    console.log(`Executing genieOfferTool for offer ID: ${offerId} in environment ${environment}`);

    try {
      // Map your abstract EnvironmentType to the concrete environment string expected by GraphQLClient
      const environmentMap: Record<EnvironmentType, 'prod' | 'qa' | 'dev'> = {
        production: 'prod',
        staging: 'qa',
        development: 'dev',
        unknown: 'prod', // Default or handle as appropriate for your setup
      };

      const mappedEnvironment = environmentMap[environment as EnvironmentType];

      // Initialize your GraphQLClient
      const client = new GenieOfferClient(mappedEnvironment, DSS_CALLER_CLIENT_ID);

      // Call the fetchOffer method from your GraphQLClient
      const response = await client.fetchOffer(offerId);

      if (response.data?.offer) {
        // Successfully retrieved the offer
        return {
          offer: response.data.offer,
          message: `Successfully retrieved offer with ID: ${offerId}.`,
        };
      } else if (response.errors && response.errors.length > 0) {
        // Handle GraphQL errors
        const errorMessages = response.errors
          .map((err: { message: string }) => err.message)
          .join('; ');
        console.error('GraphQL errors:', response.errors);
        return {
          offer: null, // Indicate no offer found
          message: `Error fetching offer with ID ${offerId}: ${errorMessages}`,
        };
      } else {
        // Generic error if no data and no explicit errors
        return {
          offer: null,
          message: `Unknown error fetching offer with ID ${offerId}.`,
        };
      }
    } catch (error) {
      console.error(`Unexpected error executing genieOfferTool for offer ID ${offerId}:`, error);
      return {
        offer: null,
        message: `Unexpected error fetching offer: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});
