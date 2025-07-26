import { OfferServiceResponse, GET_OFFER_BY_ID_QUERY, GetOfferByIdVariables } from '../model';
import { logger } from '../utils';

export class OfferServiceClient {
  private readonly baseUrl: string;

  constructor(environment: 'prod' | 'qa' | 'dev') {
    // Note: The environment variable is nested within the subdomain for this URL
    this.baseUrl = `http://default.offer-service.offermgmt.bamtech.${environment}.us-east-1.bamgrid.net/graphql`;
  }

  /**
   * Fetches offer data from the GraphQL service.
   * @param offerId The ID of the offer to retrieve.
   * @returns A Promise that resolves to an OfferServiceResponse object.
   * @throws Will throw an error if the network request fails or the GraphQL response contains errors.
   */
  async getOfferById(offerId: string): Promise<OfferServiceResponse> {
    const variables: GetOfferByIdVariables = { offerId: offerId };
    const requestBody = {
      query: GET_OFFER_BY_ID_QUERY,
      variables: variables,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST', // GraphQL APIs typically use POST
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json', // Indicate that we prefer JSON response
          // Add any authorization headers if required by your API
          // 'Authorization': 'Bearer YOUR_AUTH_TOKEN',
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
          data: data.data, // Still return data if partially available
          errors: data.errors,
          error: data.errors.map((e) => e.message).join('; '), // Combine messages for a single error string
        };
      }

      // If no GraphQL errors and data.offers is present, consider it a success
      if (data.data && data.data.offers && data.data.offers.length > 0) {
        return {
          success: true, // <--- success is defined here
          data: data.data,
        };
      } else {
        // Case where GraphQL call was successful but no offer data found
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
