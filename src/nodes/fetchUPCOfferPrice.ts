// src/nodes/fetchUPCOfferPrice.ts

import { AIMessage } from '@langchain/core/messages';
import { AgentState } from '../model/agentState';
import { upcOfferPriceTool } from '../tools/offerServiceTools';
import { OfferPriceResponse } from '../model/types'; // Import the full OfferPriceResponse type

export async function fetchUPCOfferPrice(state: AgentState): Promise<Partial<AgentState>> {
    console.log('[Node: fetchUPCOfferPrice] Attempting to fetch UPC Offer Price...');
    const { entityIds, entityType, environment, messages } = state;

    if (entityIds.length === 0 || entityType !== 'offer' || environment === 'unknown') {
        const skipMessage = 'Skipping UPC Offer Price fetch: No offer ID, not an offer, or environment unknown.';
        console.warn(`[Node: fetchUPCOfferPrice] ${skipMessage}`);
        return {
            messages: [...messages, new AIMessage(skipMessage)],
            offerPriceDetails: undefined, // Explicitly set to undefined if skipped
        };
    }

    const offerId = entityIds[0]; // Assuming your tool is called with a single offerId

    try {
        // toolCallResult will be the full OfferPriceResponse object
        const toolCallResult: OfferPriceResponse | string = await upcOfferPriceTool.invoke({
            offerId: offerId, // The tool takes a single offerId
            environment: environment,
        });

        if (typeof toolCallResult === 'string') {
            console.error(`[Node: fetchUPCOfferPrice] Tool returned an error: ${toolCallResult}`);
            return {
                messages: [
                    ...messages,
                    new AIMessage(`Failed to fetch offer price for ${offerId}: ${toolCallResult}`),
                ],
                offerPriceDetails: undefined, // Indicate failure
            };
        } else {
            // --- CRUCIAL CHANGE: Store the entire OfferPriceResponse object ---
            console.log(`[Node: fetchUPCOfferPrice] Successfully fetched full price details for offer ID: ${offerId}.`);
            return {
                offerPriceDetails: toolCallResult, // Store the entire response object
                messages: [
                    ...messages,
                    new AIMessage(`Fetched UPC Offer Price details for offer ID \`${offerId}\`.`),
                ],
            };
        }
    } catch (error: any) {
        console.error(`[Node: fetchUPCOfferPrice] Error invoking upcOfferPriceTool for ${offerId}:`, error);
        return {
            messages: [
                ...messages,
                new AIMessage(`An error occurred while trying to fetch the offer price for ${offerId}. Error: ${error.message}`),
            ],
            offerPriceDetails: undefined, // Indicate failure
        };
    }
}