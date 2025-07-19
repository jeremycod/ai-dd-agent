import { GraphQLResponse, Offer } from '../model/types/genieGraphql';
import { GET_OFFER_QUERY } from '../model/queries/genie';
import { TokenService } from '../utils/auth/TokenService';
import { logger } from '../utils/logger';

export class GenieOfferClient {
  private readonly baseUrl: string;
  private readonly callerClientId: string;

  /**
   * Initializes the GraphQLClient.
   * @param environment The deployment environment ('prod', 'qa', 'dev').
   * @param callerClientId A unique identifier for the client making the request (e.g., your application name).
   * @param baseDomain (Optional) The base domain for your GraphQL endpoint. Defaults to 'dpegrid.net'.
   * Useful for testing or if your domain structure differs.
   */
  constructor(environment: 'prod' | 'qa' | 'dev', callerClientId: string) {
    // Construct the base URL similarly to your UPSClient example
    let envKey = '';
    switch (environment) {
      case 'prod':
        envKey = 'GENIE_GRAPHQL_PROD';
        break;
      case 'qa':
        envKey = 'GENIE_GRAPHQL_QA';
        break;
      case 'dev':
        envKey = 'GENIE_GRAPHQL_DEV';
        break;
      default:
        throw new Error(`Unknown environment: ${environment}`);
    }
    this.baseUrl = process.env[envKey] as string;
    this.callerClientId = callerClientId;
  }

  /**
   * Internal helper to make authenticated GraphQL requests.
   * @param query The GraphQL query string.
   * @param variables The variables to pass to the GraphQL query.
   * @returns A promise resolving to the GraphQL response.
   */
  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, any> = {},
  ): Promise<GraphQLResponse<T>> {
    // --- CRITICAL CHANGE: Get token from TokenService ---
    let token: string;
    try {
      // The TokenService will check if the existing token is valid/expired.
      // If expired, it will automatically generate a new one using your symmetric key.
      token = await TokenService.getInstance().getValidToken({
        // Optionally pass dynamic claims if your token needs to be specific
        // to the GraphQL client's operation or a specific session.
        // e.g., sub: this.callerClientId, scopes: ['read:offer']
      });
    } catch (authError: any) {
      logger.error('Failed to obtain a valid authentication token:', authError);
      return {
        errors: [
          {
            message: `Authentication failed: ${authError.message || 'Could not get valid token.'}`,
          },
        ],
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Use the token obtained from TokenService
          'x-dss-caller-client-id': this.callerClientId,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = response.statusText;
        // Consider logging more details like response.status and the full errorText
        logger.error(`GraphQL HTTP Error ${response.status}:`, errorText);
        return { errors: [{ message: `HTTP Error ${response.status}: ${errorText}` }] };
      }

      const result: GraphQLResponse<T> = await response.json();
      return result;
    } catch (error: any) {
      logger.error('GraphQL request network or parsing error:', error);
      return { errors: [{ message: error.message || 'Network error or invalid JSON response' }] };
    }
  }

  /**
   * Fetches an offer by its ID from the GraphQL endpoint.
   * Requires a JWT token to be set.
   *
   * @param offerId The ID of the offer to fetch.
   * @returns A Promise that resolves to the Offer data or an error.
   */
  public async fetchOffer(offerId: string): Promise<GraphQLResponse<{ offer: Offer }>> {
    return this.graphqlRequest<{ offer: Offer }>(GET_OFFER_QUERY, { offerId });
  }

  // You can add other GraphQL methods here, e.g., fetchProducts, createOffer, etc.
  // public async fetchProducts(...): Promise<GraphQLResponse<...>> { ... }
}
