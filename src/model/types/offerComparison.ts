

import { Offer as OfferServiceOffer } from '../types/offerService';
import { Offer as GenieOffer } from '../types/genieGraphql';

export interface OfferComparisonInput {
    offerId: string;
    offerServiceOffer: OfferServiceOffer | null;
    genieOffer: GenieOffer | null;
}