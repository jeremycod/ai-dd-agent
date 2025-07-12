import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { UPSClient } from '../clients/UPSClient';
import { OfferPriceResponse } from '../model/types';
import { OfferPriceOutputSchema } from '../model/schemas';
import { GetUPCOfferPriceToolSchema, GetUPCOfferPriceToolSchemaInput } from '../model/schemas';


export const upcOfferPriceTool = new DynamicStructuredTool({
    name: "getOfferPrice",
    description: "Retrieves the price details for a specific offer ID from the Unified Pricing Service (UPS). " +
        "Requires an `offerId` and the `environment` (production, staging, or development) where the offer resides. " +
        "Returns structured price information, including amount, currency, and billing period if applicable.",
    schema: GetUPCOfferPriceToolSchema as any, // Use the defined input schema
    func: async ({ offerId, environment }:GetUPCOfferPriceToolSchemaInput) => { // Arguments will be type-checked by schema
        console.log(`DEBUG: getUPCOfferPriceTool called for Offer ID: ${offerId} in environment: ${environment}`);

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

        const client = new UPSClient(upsEnvironment);

        try {
            const priceDetails: OfferPriceResponse = await client.fetchOfferPrice(offerId);
            console.log(`DEBUG: Successfully fetched price for ${offerId}:`, JSON.stringify(priceDetails));
            // Ensure the returned object conforms to OfferPriceOutputSchema if you're using it for validation
            // For a simple pass-through, just return priceDetails
            return priceDetails;
        } catch (error: any) {
            console.error(`Error in fetchOfferPriceTool for ${offerId} in ${environment}:`, error);
            return `Failed to retrieve offer price for ${offerId} in ${environment}. Error: ${error.message}`;
        }
    },
});