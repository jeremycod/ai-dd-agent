import { EntityHistoryResponse, Version } from '../model/types/entityHistory';
import { EntityType } from '../model/types/general';
import { logger } from '../utils/logger';

export class HttpDataManagerError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
    this.name = 'HttpDataManagerError';
  }
}

export class DataManagerHistoryClient {
  private readonly baseUrl: string;

  constructor(environment: 'prod' | 'qa' | 'dev') {
    this.baseUrl = `http://genie-datamanager-${environment}.us-east-1.dpegrid.net/history`;
  }

  async fetchEntityHistory(entityType: EntityType, id: string, limit: number): Promise<Version[]> {
    let response: EntityHistoryResponse;

    try {
      // Add a try/catch block here if you want to log / handle errors at this level
      switch (entityType) {
        case 'campaign':
          response = await this.getCampaign(id);
          break;
        case 'offer':
          response = await this.getOffer(id);
          break;
        case 'sku':
          response = await this.getSku(id);
          break;
        case 'product':
          throw new Error(`Product history not yet implemented for DataManagerHistoryClient`);
        case 'general':
        case 'unknown':
          throw new Error(
            `Unsupported entityType for direct history fetch: ${entityType}. Requires specific ID.`,
          );
        default:
          throw new Error(`Unhandled entityType: ${entityType}`);
      }

      if (response && Array.isArray(response.versions)) {
        return response.versions.slice(0, limit);
      }

      console.warn(`No 'versions' array found in history response for ${entityType} ${id}`);
      return [];
    } catch (error) {
      // This catch block will now catch errors from makeRequest,
      // and also the explicit throws within this switch statement.
      logger.error(`Error in fetchEntityHistory for ${entityType} ${id}:`, error);
      // Re-throw if you want the error to propagate further up
      if (error instanceof HttpDataManagerError) {
        throw error; // Re-throw specific HTTP errors
      } else if (error instanceof Error) {
        throw new Error(`Failed to fetch entity history: ${error.message}`);
      } else {
        throw new Error(
          `Failed to fetch entity history: An unknown error occurred: ${String(error)}`,
        );
      }
    }
  }

  async getCampaign(campaignId: string): Promise<EntityHistoryResponse> {
    const url = `${this.baseUrl}/campaign?campaignId=${campaignId}`;
    return this.makeRequest<EntityHistoryResponse>(url);
  }

  async getOffer(offerId: string): Promise<EntityHistoryResponse> {
    const url = `${this.baseUrl}/offer?offerId=${offerId}`;
    return this.makeRequest<EntityHistoryResponse>(url);
  }

  async getSku(skuId: string): Promise<EntityHistoryResponse> {
    const url = `${this.baseUrl}/sku?skuId=${skuId}`;
    return this.makeRequest<EntityHistoryResponse>(url);
  }

  private async makeRequest<T>(url: string): Promise<T> {
    logger.info(`Making request to: ${url}`);
    // No try/catch here, let errors propagate naturally
    const response = await fetch(url);
    if (!response.ok) {
      const errorBody = await response.text();
      // This is the only throw in this function.
      // It will propagate directly out of makeRequest.
      throw new HttpDataManagerError(
        `HTTP error! Status: ${response.status}, Body: ${errorBody}`,
        response.status,
        errorBody,
      );
    }
    return (await response.json()) as T;
  }
}
