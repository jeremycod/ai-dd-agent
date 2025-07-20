// src/model/types/offerComparison.ts (Create this new file or add to an existing types file if appropriate)

import { Offer as OfferServiceOffer } from '../types/offerService'; // Assuming this is your OfferService Offer type
import { Offer as GenieOffer } from '../types/genieGraphql'; // Assuming this is your Genie Offer type. ADJUST PATH AS NEEDED.

export interface OfferComparisonInput {
    offerId: string;
    offerServiceOffer: OfferServiceOffer | null; // The Offer object from Offer Service
    genieOffer: GenieOffer | null; // The Offer object from Genie
}