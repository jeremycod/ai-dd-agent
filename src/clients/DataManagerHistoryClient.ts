import axios from 'axios';

export class DataManagerHistoryClient {
  private baseUrl: string;

  constructor(environment: 'prod' | 'qa' | 'dev') {
    this.baseUrl = `http://genie-datamanager-${environment}.us-east-1.dpegrid.net/history`;
  }
  async fetchEntityHistory(
    entityType: 'campaign' | 'offer' | 'sku',
    id: string,
    limit: number,
  ): Promise<any> {
    switch (entityType) {
      case 'campaign':
        return this.getCampaign(id);
      case 'offer':
        return this.getOffer(id);
      case 'sku':
        return this.getSku(id);
      default:
        throw new Error(`Unsupported entityType: ${entityType}`);
    }
  }
  async getCampaign(campaignId: string): Promise<any> {
    const url = `${this.baseUrl}/campaign?campaignId=${campaignId}`;
    return this.makeRequest(url);
  }

  async getOffer(offerId: string): Promise<any> {
    const url = `${this.baseUrl}/offer?offerId=${offerId}`;
    const response = this.makeRequest(url);
    return response;
  }

  async getSku(skuId: string): Promise<any> {
    const url = `${this.baseUrl}/sku?skuId=${skuId}`;
    return this.makeRequest(url);
  }

  private async makeRequest(url: string): Promise<any> {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      throw error;
    }
  }
}
