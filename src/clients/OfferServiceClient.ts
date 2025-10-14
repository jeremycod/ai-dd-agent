import { OfferServiceResponse, GET_OFFER_BY_ID_QUERY, GetOfferByIdVariables } from '../model';
import { logger } from '../utils';

export class OfferServiceClient {
  private readonly baseUrl: string;

  constructor(environment: 'prod' | 'qa' | 'dev') {

    this.baseUrl = `http://default.offer-service.offermgmt.bamtech.${environment}.us-east-1.bamgrid.net/graphql`;
  }


  async getOfferById(offerId: string): Promise<OfferServiceResponse> {
    const variables: GetOfferByIdVariables = { offerId: offerId };
    const requestBody = {
      query: GET_OFFER_BY_ID_QUERY,
      variables: variables,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          error: `HTTP error! Status: ${response.status}, Body: ${errorBody}`,
          success: false,
        } as OfferServiceResponse;
      }

      const data: OfferServiceResponse = await response.json();

      if (data.errors && data.errors.length > 0) {
        logger.warn(`GraphQL errors for offer ${offerId}: ${JSON.stringify(data.errors)}`);
        return {
          success: false,
          data: data.data,
          errors: data.errors,
          error: data.errors.map((e) => e.message).join('; '),
        };
      }


      if (data.data && data.data.offers && data.data.offers.length > 0) {
        return {
          success: true,
          data: data.data,
        };
      } else {

        return {
          success: false,
          data: data.data,
          error: `No offer data found for ID: ${offerId}`,
        };
      }
    } catch (error: any) {
      logger.error(`Network or unexpected error for offer ${offerId}:`, error);
      return {
        success: false,
        error: `Network or unexpected error: ${error.message}`,
      };
    }
  }
}
