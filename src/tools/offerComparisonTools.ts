// src/tools/offerComparisonTools.ts

import { DynamicStructuredTool } from '@langchain/core/tools';
import { logger } from '../utils';
import { Offer as OfferServiceOffer, Offer as GenieOffer, DurationLength, CompareOffersToolSchema, CompareOffersToolSchemaInput } from '../model';


// Helper function to extract relevant pricing info from OfferService response
function getOfferServicePriceSummary(offer: OfferServiceOffer): string {
    if (!offer.pricing || offer.pricing.length === 0) {
        return "No pricing information available.";
    }
    return offer.pricing.map(price => {
        let priceStr = `${price.amount} ${price.currency}`;
        if (price.billingPeriod) priceStr += ` / ${price.billingPeriod}`;
        if (price.discountedDuration) priceStr += ` for ${price.discountedDuration.length} ${price.discountedDuration.unit}`;
        if (price.reason) priceStr += ` (Reason: ${price.reason})`;
        return priceStr;
    }).join('; ');
}

// Helper function to extract relevant pricing info from Genie response
function getGeniePriceSummary(offer: GenieOffer): string {
    let summary = '';

    if (offer.__typename === 'OfferD2C') {
        const d2cOffer = offer;

        if (d2cOffer.initialPrice !== undefined && d2cOffer.currency) {
            summary += `Initial Price: ${d2cOffer.initialPrice / 100} ${d2cOffer.currency.code}`;
            if (d2cOffer.billingFrequency) summary += ` / ${d2cOffer.billingFrequency}`;
        }
        if (d2cOffer.offerProducts && d2cOffer.offerProducts.length > 0) {
            summary += ` | Products pricing: `;
            summary += d2cOffer.offerProducts.map(op => {
                // FIX 1: Access product name from op.initialPhase?.product, not op.product
                // Ensure op.initialPhase and op.initialPhase.product exist
                let productName = op.initialPhase?.product?.name || 'Unknown Product ID: ' + op.productId;
                let productPriceStr = `${productName}: ${op.price?.offerProductPriceAmount !== undefined ? op.price.offerProductPriceAmount / 100 : 'N/A'} ${op.initialPhase?.currency?.code || 'N/A'}`;

                if (op.initialPhase && op.initialPhase.phaseType === 'DISCOUNT' && op.initialPhase.discount) {
                    // FIX 2 & 3: Narrow op.initialPhase.duration to DurationLength
                    if (op.initialPhase.duration && 'durationLength' in op.initialPhase.duration) {
                        const duration = op.initialPhase.duration as DurationLength; // Cast to DurationLength
                        productPriceStr += ` (Discounted: ${op.initialPhase.finalPrice !== undefined ? op.initialPhase.finalPrice / 100 : 'N/A'} for ${duration.durationLength || 'N/A'} ${duration.durationUnit || 'N/A'})`;
                    } else {
                        // Handle DurationDate or missing duration
                        productPriceStr += ` (Discounted: ${op.initialPhase.finalPrice !== undefined ? op.initialPhase.finalPrice / 100 : 'N/A'})`;
                    }
                }
                return productPriceStr;
            }).join('; ');
        }
    } else if (offer.__typename === 'Offer3PP') {
        summary += `Genie offer is a 3PP type. Pricing is typically not applicable as it's handled by a third-party partner.`;
    } else if (offer.__typename === 'OfferIAP') {
        const offerIAP = offer;
        summary += `Genie offer is an IAP type. Billing Frequency: ${offerIAP.billingFrequency || 'N/A'}`;
    } else {
        summary += `Genie offer type is unknown. Pricing details not extracted.`;
    }

    return summary || "No pricing information available.";
}


export const compareOffersTool = new DynamicStructuredTool({
    name: "compareOfferDetails",
    description: "Compares the details of an offer retrieved from Offer Service and Genie, focusing on discrepancies in prices, products, and general metadata. Use this when both OfferServiceOffer and GenieOffer data are available for the same offer ID.",
    schema: CompareOffersToolSchema as any,
    func: async ({ offerId, offerServiceOffer, genieOffer }: CompareOffersToolSchemaInput) => {
        logger.info(`Executing compareOfferDetailsTool for offer ID: ${offerId}`);

        let comparisonResult = `Comparison for Offer ID: ${offerId}\n\n`;

        if (!offerServiceOffer && !genieOffer) {
            return `No offer data found from either Offer Service or Genie for ID: ${offerId}.`;
        }

        const osOffer = offerServiceOffer as OfferServiceOffer | null;
        const gOffer = genieOffer as GenieOffer | null;


        if (osOffer && gOffer) {
            comparisonResult += `--- General Comparison ---\n`;
            if (osOffer.name !== gOffer.name) {
                comparisonResult += `- Name Mismatch: OfferService: "${osOffer.name}" vs Genie: "${gOffer.name}"\n`;
            } else {
                comparisonResult += `- Names Match: "${osOffer.name}"\n`;
            }

            if (osOffer.id !== gOffer.id) {
                comparisonResult += `- ID Mismatch (this should not happen if called correctly): OfferService: "${osOffer.id}" vs Genie: "${gOffer.id}"\n`;
            } else {
                comparisonResult += `- IDs Match: "${osOffer.id}"\n`;
            }

            // MODIFICATION START: Conditional Pricing Comparison
            if (gOffer.__typename === 'OfferD2C') {
                const offerServicePrice = getOfferServicePriceSummary(osOffer);
                const geniePrice = getGeniePriceSummary(gOffer);

                comparisonResult += `\n--- Pricing Comparison ---\n`;
                if (offerServicePrice === geniePrice) {
                    comparisonResult += `- Pricing appears consistent. OfferService: [${offerServicePrice}], Genie: [${geniePrice}]\n`;
                } else {
                    comparisonResult += `- Pricing Discrepancy:\n`;
                    comparisonResult += `  - OfferService Pricing: [${offerServicePrice}]\n`;
                    comparisonResult += `  - Genie Pricing: [${geniePrice}]\n`;
                }
            } else {
                comparisonResult += `\n--- Pricing Information ---\n`;
                comparisonResult += `- Pricing comparison is not applicable for ${gOffer.__typename} offers as it is managed externally.\n`;
                comparisonResult += `  - OfferService Pricing Summary: [${getOfferServicePriceSummary(osOffer)}]\n`;
                comparisonResult += `  - Genie Pricing Summary: [${getGeniePriceSummary(gOffer)}]\n`;
            }
            // MODIFICATION END: Conditional Pricing Comparison

            // Product Comparison (simplified, focusing on product IDs)
            const offerServiceProductIds = new Set(osOffer.products.map(p => p.product.id));

            let genieProductIds: Set<string>;
            if (gOffer && gOffer.products) {
                // p's type will be correctly inferred as Product (Genie's Product) here
                genieProductIds = new Set(gOffer.products.map(p => p.id));
            } else {
                genieProductIds = new Set();
            }

            const missingInGenie = Array.from(offerServiceProductIds).filter(id => !genieProductIds.has(id));
            const missingInOfferService = Array.from(genieProductIds).filter(id => !offerServiceProductIds.has(id));

            comparisonResult += `\n--- Product Comparison ---\n`;
            if (missingInGenie.length === 0 && missingInOfferService.length === 0) {
                comparisonResult += `- Product IDs are identical. Total: ${offerServiceProductIds.size} products.\n`;
            } else {
                comparisonResult += `- Product ID Discrepancies:\n`;
                if (missingInGenie.length > 0) {
                    comparisonResult += `  - Products in OfferService but NOT in Genie: ${missingInGenie.join(', ')}\n`;
                }
                if (missingInOfferService.length > 0) {
                    comparisonResult += `  - Products in Genie but NOT in OfferService: ${missingInOfferService.join(', ')}\n`;
                }
            }

        } else if (osOffer) {
            comparisonResult += `Only Offer Service data found for ID: ${offerId}. (Name: "${osOffer.name}")\n`;
            comparisonResult += `Offer Service Pricing: [${getOfferServicePriceSummary(osOffer)}]\n`;
            comparisonResult += `Offer Service Products: ${osOffer.products.map(p => p.product.id).join(', ')}\n`;
        } else if (gOffer) {
            comparisonResult += `Only Genie data found for ID: ${offerId}. (Name: "${gOffer.name}")\n`;
            comparisonResult += `Genie Pricing: [${getGeniePriceSummary(gOffer)}]\n`;
            if (gOffer.__typename === 'OfferD2C' && gOffer.products) {
                comparisonResult += `Genie Products: ${gOffer.products.map(p => p.id).join(', ')}\n`;
            } else {
                comparisonResult += `Genie Products: Not applicable or no products found for this Genie offer type.\n`;
            }
        }
        logger.info(`compareOfferDetailsTool completed for offer ID: ${offerId}`);

        return comparisonResult;
    },
});