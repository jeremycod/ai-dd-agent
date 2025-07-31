import { DynamicStructuredTool } from '@langchain/core/tools';
import { UPSClient } from '../clients';
import { OfferPriceResponse, GetUPSOfferPriceToolSchema, GetUPSOfferPriceToolSchemaInput, AgentStateData, PackagePrice } from '../model';
import { AIMessage } from '@langchain/core/messages';
import { generateNewAIMessage, logger } from '../utils';
import { ApiCaptureWrapper } from '../services/apiCaptureWrapper';

const DSS_CALLER_CLIENT_ID = process.env.DSS_CALLER_CLIENT_ID || 'your-default-ai-agent-client-id';
const apiCapture = new ApiCaptureWrapper();

export const upsOfferPriceTool = new DynamicStructuredTool({
  name: 'getOfferPrice',
  description:
    'Retrieves the price details for a specific offer ID from the Unified Pricing Service (UPS). ' +
    'Requires an `offerId` and the `environment` (production, staging, or development) where the offer resides. ' +
    'Returns structured price information, including amount, currency, and billing period if applicable.',
  schema: GetUPSOfferPriceToolSchema as any, // Use the defined input schema
  func: async ({ offerId, environment }: GetUPSOfferPriceToolSchemaInput) => {
    // Arguments will be type-checked by schema
    logger.info(
      `DEBUG: getUPSOfferPriceTool called for Offer ID: ${offerId} in environment: ${environment}`,
    );

    let upsEnvironment: 'prod' | 'qa' | 'dev';
    switch (environment) {
      case 'production':
        upsEnvironment = 'prod';
        break;
      case 'staging':
        upsEnvironment = 'qa';
        break;
      case 'development':
        upsEnvironment = 'dev';
        break;
      default:
        // This case should ideally not be reached due to z.enum, but good for robustness
        throw new Error(`Invalid or unsupported environment for UPSClient: ${environment}`);
    }

    const client = new UPSClient(upsEnvironment, DSS_CALLER_CLIENT_ID);

    try {
      const originalCall = async () => {
        return await client.fetchOfferPrice(offerId);
      };
      
      const priceDetails: OfferPriceResponse = await apiCapture.wrapUPSCall(
        originalCall,
        offerId,
        environment
      );
      logger.info(
        `DEBUG: Successfully fetched price for ${offerId}:,
        ${JSON.stringify(priceDetails)}`,
      );
      // Ensure the returned object conforms to OfferPriceOutputSchema if you're using it for validation
      // For a simple pass-through, just return priceDetails
      return priceDetails;
    } catch (error: any) {
      logger.error(`Error in fetchOfferPriceTool for ${offerId} in ${environment}:`, error);
      return `Failed to retrieve offer price for ${offerId} in ${environment}. Error: ${error.message}`;
    }
  },
});

/**
 * Analyzes the fetched UPS Offer Price details and generates a summary.
 * This tool is designed to be called by the agent after fetching offer prices.
 */
export async function analyzeUPSOfferPriceTool(
  state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  logger.info('[Tool: analyzeUPSOfferPriceTool] Analyzing UPS Offer Price details...');

  const { offerPriceDetails, queryCategory, entityIds } = state; // Also get entityIds for context

  if (!offerPriceDetails || offerPriceDetails.length === 0) {
    const message = 'No offer price details were provided for analysis.';
    console.warn(`[Tool: analyzeUPSOfferPriceTool] ${message}`);
    return {
      messages: [...state.messages, generateNewAIMessage(message)],
      analysisResults: {
        ...state.analysisResults,
        upsOfferPrice: undefined,
      },
    };
  }

  let analysisSummary = 'Summary of UPS Offer Price Analysis:\n';
  const messages: AIMessage[] = [];

  // Iterate over each OfferPriceResponse we received (each should correspond to one requested entityId)
  offerPriceDetails.forEach((priceResponse: OfferPriceResponse, index: number) => {
    // Try to link this priceResponse back to the original entityId
    const currentOfferId = entityIds[index] || 'Unknown Offer ID'; // Link by index or try to find in packagePrices

    analysisSummary += `\n--- Analysis for Offer ID: ${currentOfferId} ---\n`;

    // 1. Analyze Retail Price
    const retailPrice = priceResponse.retailPrice;
    if (retailPrice && retailPrice.amount !== undefined && retailPrice.amount !== null) {
      analysisSummary += `  Retail Price: ${retailPrice.amount} ${retailPrice.isoFormattedCurrency}\n`;
      messages.push(
        generateNewAIMessage(
          `For offer \`${currentOfferId}\`, the retail price is ${retailPrice.amount} ${retailPrice.isoFormattedCurrency}.`,
        ),
      );
    } else {
      analysisSummary += `  Retail Price: Not available.\n`;
      messages.push(
        generateNewAIMessage(`For offer \`${currentOfferId}\`, the retail price is not available.`),
      );
    }

    // 2. Analyze Promotional Prices (if any)
    if (priceResponse.promotionalPrices && priceResponse.promotionalPrices.length > 0) {
      analysisSummary += `  Promotional Prices:\n`;
      priceResponse.promotionalPrices.forEach((promo) => {
        analysisSummary += `    - Amount: ${promo.amount} ${promo.isoFormattedCurrency}, Phase: ${promo.phaseType || 'N/A'}, Billing: ${promo.billingPeriod || 'N/A'}\n`;
      });
      messages.push(
        generateNewAIMessage(
          `For offer \`${currentOfferId}\`, found ${priceResponse.promotionalPrices.length} promotional price(s).`,
        ),
      );
    } else {
      analysisSummary += `  No promotional prices found.\n`;
    }

    // 3. Analyze Package Prices (if any) - This is where the original 'offerId' might truly reside in the response
    if (priceResponse.packagePrices && priceResponse.packagePrices.length > 0) {
      analysisSummary += `  Package Prices:\n`;
      priceResponse.packagePrices.forEach((pkg: PackagePrice) => {
        analysisSummary += `    - Package ID: ${pkg.packageId}\n`;
        if (pkg.retailPrice) {
          analysisSummary += `      Package Retail: ${pkg.retailPrice.amount} ${pkg.retailPrice.isoFormattedCurrency}\n`;
        }
        if (pkg.promotionalPrices && pkg.promotionalPrices.length > 0) {
          analysisSummary += `      Package Promotions: ${pkg.promotionalPrices.map((p) => `${p.amount} ${p.isoFormattedCurrency}`).join(', ')}\n`;
        }
      });
      messages.push(
        generateNewAIMessage(
          `For offer \`${currentOfferId}\`, found ${priceResponse.packagePrices.length} package price(s).`,
        ),
      );
    } else {
      analysisSummary += `  No package prices found.\n`;
    }

    // If the query was specifically about 'OFFER_PRICE' and a price was expected
    if (queryCategory === 'OFFER_PRICE') {
      const hasAnyPrice =
        (retailPrice && retailPrice.amount !== undefined && retailPrice.amount !== null) ||
        (priceResponse.promotionalPrices && priceResponse.promotionalPrices.length > 0) ||
        (priceResponse.packagePrices &&
          priceResponse.packagePrices.some(
            (pkg) => pkg.retailPrice && pkg.retailPrice.amount !== undefined,
          ));
      if (!hasAnyPrice) {
        analysisSummary += `  Overall Status for ${currentOfferId}: **Missing Price Information** (as requested by query)\n`;
        messages.push(
          generateNewAIMessage(
            `For offer \`${currentOfferId}\`, despite being an OFFER_PRICE query, no price information (retail, promotional, or package) was found.`,
          ),
        );
      } else {
        analysisSummary += `  Overall Status for ${currentOfferId}: Price information found (as requested by query).\n`;
      }
    }
  });

  logger.info('[Tool: analyzeUPSOfferPriceTool] Analysis complete.');

  return {
    messages: [...state.messages, ...messages],
    analysisResults: {
      ...state.analysisResults,
      upsOfferPrice: analysisSummary,
    },
  };
}
