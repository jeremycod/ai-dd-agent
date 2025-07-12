import { EntityHistoryResponse, EntityType, Version } from '../model/types';

// Define a custom error class for HTTP-related errors
export class HttpDataManagerError extends Error {
  constructor(message: string, public status: number, public body: string) {
    super(message);
    this.name = 'HttpDataManagerError'; // Custom name for easier identification
  }
}

export class DataManagerHistoryClient {
  private readonly baseUrl: string;

  constructor(environment: 'prod' | 'qa' | 'dev') {
    this.baseUrl = `http://genie-datamanager-${environment}.us-east-1.dpegrid.net/history`;
  }

  async fetchEntityHistory(entityType: EntityType, id: string, limit: number): Promise<Version[]> {
    let response: EntityHistoryResponse;

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
        // If you have a getProduct method, call it here.
        // response = await this.getProduct(id);
        throw new Error(`Product history not yet implemented for DataManagerHistoryClient`);
      case 'general':
      case 'unknown':
        throw new Error(
            `Unsupported entityType for direct history fetch: ${entityType}. Requires specific ID.`,
        );
      default:
        throw new Error(`Unhandled entityType: ${entityType}`);
    }

    // Directly return the versions array, applying limit
    // Ensure response.versions is an array before slicing
    if (response && Array.isArray(response.versions)) {
      return response.versions.slice(0, limit);
    }

    console.warn(`No 'versions' array found in history response for ${entityType} ${id}`);
    return []; // Return empty array if no versions found
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
    console.log(`Making request to: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorBody = await response.text();
        // THROW an error here, do not return an object with an 'error' property
        throw new HttpDataManagerError(
            `HTTP error! Status: ${response.status}, Body: ${errorBody}`,
            response.status,
            errorBody,
        );
      }
      return (await response.json()) as T; // Cast to expected type T
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      // Re-throw a new Error, ensuring 'error.message' is safely accessed
      // If 'error' is already an HttpDataManagerError, re-throw it directly
      if (error instanceof HttpDataManagerError) {
        throw error; // Re-throw the specific HTTP error
      } else if (error instanceof Error) {
        // If it's a generic Error (e.g., network error, JSON parse error)
        throw new Error(`Failed to fetch data from ${url}: ${error.message}`);
      } else {
        // Fallback for truly unknown error types
        throw new Error(`Failed to fetch data from ${url}: An unknown error occurred: ${String(error)}`);
      }
    }
  }
}