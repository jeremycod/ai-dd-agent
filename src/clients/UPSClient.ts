
import { OfferPriceResponse } from '../model/types'; // Assuming this path is correct

export class UPSClient {
    private readonly baseUrl: string;
    private readonly callerClientId: string; // <--- Add this property

    constructor(environment: 'prod' | 'qa' | 'dev', callerClientId: string) { // <--- Add callerClientId to constructor
        this.baseUrl = `http://unified-pricing-http-${environment}.us-east-1.dpegrid.net/v3/offer/price`;
        this.callerClientId = callerClientId; // <--- Initialize it
    }

    async fetchOfferPrice(offerId: string, storeFrontCountry: string = 'US'): Promise<OfferPriceResponse> {
        const url = `${this.baseUrl}?offerId=${encodeURIComponent(offerId)}&storeFrontCountry=${encodeURIComponent(storeFrontCountry)}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-dss-caller-client-id': this.callerClientId, // <--- ADD THIS HEADER
                },
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorBody}`);
            }

            const data: OfferPriceResponse = await response.json();
            return data;
        } catch (error) {
            console.error(`Error fetching offer price for ${offerId}:`, error); // Added offerId for better logging
            throw error;
        }
    }
}