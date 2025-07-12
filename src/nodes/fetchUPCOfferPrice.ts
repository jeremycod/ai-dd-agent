import { AgentStateData } from '../model/agentState';
import { OfferPriceResponse } from '../model/types'; // Ensure this correctly defines your types
import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { upcOfferPriceTool } from '../tools/offerServiceTools'; // Import your tool instance


export async function fetchUPCOfferPrice(state: AgentStateData): Promise<Partial<AgentStateData>> {
    console.log('[Node: fetchUPCOfferPrice] Attempting to fetch UPC Offer Price...');

    const { environment, entityIds, messages } = state;

    if (!environment || environment === 'unknown') {
        return {
            messages: [...messages, new AIMessage("Environment not specified for fetching UPC offer price.")],
            offerPriceDetails: undefined
        };
    }

    if (!entityIds || entityIds.length === 0) {
        return {
            messages: [...messages, new AIMessage("No offer IDs provided to fetch UPC offer price.")],
            offerPriceDetails: undefined
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
            const toolCallResult: OfferPriceResponse | string = await upcOfferPriceTool.invoke({
                offerId: offerId,
                environment: environment,
            });

            if (typeof toolCallResult === 'string') {
                // If the tool returns a string, it indicates an error or summary
                newMessages.push(new AIMessage(`Tool output for offer ${offerId}: ${toolCallResult}`));
                failedFetches.push(offerId);
            } else {
                // If it returns an OfferPriceResponse object, it's a success
                offerPrices.push(toolCallResult);
                newMessages.push(new AIMessage(`Successfully fetched price details for offer \`${offerId}\`.`));
            }
        } catch (error: any) {
            console.error(`[Node: fetchUPCOfferPrice] Error invoking tool for offer ${offerId}:`, error);
            newMessages.push(new AIMessage(`Failed to retrieve price for offer \`${offerId}\` due to an unexpected error. Error: ${error.message}`));
            failedFetches.push(offerId);
        }
    }

    let summaryMessage = `UPC Offer Price fetching completed for ${entityIds.length} offers.`;
    if (offerPrices.length > 0) {
        summaryMessage += ` Successfully retrieved ${offerPrices.length}.`;
    }
    if (failedFetches.length > 0) {
        summaryMessage += ` Failed for ${failedFetches.length} offers: ${failedFetches.join(', ')}.`;
    }

    newMessages.push(new AIMessage(summaryMessage));

    return {
        messages: [...messages, ...newMessages],
        offerPriceDetails: offerPrices.length > 0 ? offerPrices : undefined,
    };
}