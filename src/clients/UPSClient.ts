import { OfferPriceResponse } from '../model';
import { logger } from '../utils';
export class UPSClient {
  private readonly baseUrl: string;
  private readonly callerClientId: string;

  constructor(environment: 'prod' | 'qa' | 'dev', callerClientId: string) {

    this.baseUrl = `http://unified-pricing-http-${environment}.us-east-1.dpegrid.net/v3/offer/price`;
    this.callerClientId = callerClientId;
  }

  async fetchOfferPrice(
    offerId: string,
    storeFrontCountry: string = 'US',
  ): Promise<OfferPriceResponse> {
    const url = `${this.baseUrl}?offerId=${encodeURIComponent(offerId)}&storeFrontCountry=${encodeURIComponent(storeFrontCountry)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-dss-caller-client-id': this.callerClientId,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          error: `HTTP error! Status: ${response.status}, Body: ${errorBody}`,
          success: false,
        } as OfferPriceResponse;
      }

      return await response.json();
    } catch (error) {
      logger.error(`Error fetching offer price for ${offerId}:`, error);
      throw new Error(
        `Error fetching offer price for ${offerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
