import axios from 'axios';
import { EntityType, EntityHistoryResponse, Version } from '../model/types';

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
        const exhaustiveCheck: never = entityType;
        throw new Error(`Unhandled entityType: ${exhaustiveCheck}`);
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
      const response = await fetch(url); // Or axios, etc.
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }
      return (await response.json()) as T; // Cast to expected type T
    } catch (error) {
      console.error(`Request to ${url} failed:`, error);
      throw error;
    }
  }
}
