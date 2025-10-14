import {GenieOffer as Offer, GET_OFFER_QUERY, GraphQLResponse} from '../model';
import {logger, TokenService} from '../utils';

export class GenieOfferClient {
  private readonly baseUrl: string;
  private readonly callerClientId: string;


  constructor(environment: 'prod' | 'qa' | 'dev', callerClientId: string) {

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


  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, any> = {},
  ): Promise<GraphQLResponse<T>> {

    let token: string;
    try {
      token = await TokenService.getInstance().getValidToken({});
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
          Authorization: `Bearer ${token}`,
          'x-dss-caller-client-id': this.callerClientId,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = response.statusText;

        logger.error(`GraphQL HTTP Error ${response.status}:`, errorText);
        return { errors: [{ message: `HTTP Error ${response.status}: ${errorText}` }] };
      }

      return await response.json();
    } catch (error: any) {
      logger.error('GraphQL request network or parsing error:', error);
      return { errors: [{ message: error.message || 'Network error or invalid JSON response' }] };
    }
  }


  public async fetchOffer(offerId: string): Promise<GraphQLResponse<{ offer: Offer }>> {
    return this.graphqlRequest<{ offer: Offer }>(GET_OFFER_QUERY, { offerId });
  }


}
