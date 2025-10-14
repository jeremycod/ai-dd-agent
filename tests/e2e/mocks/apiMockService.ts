export interface MockApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  latency?: number;
}

export class ApiMockService {
  private mockResponses: Map<string, MockApiResponse> = new Map();
  private callLog: Array<{ api: string; params: any; timestamp: Date }> = [];

  // Mock Datadog API responses
  mockDatadogLogs(entityId: string, logs: any[]): void {
    this.mockResponses.set(`datadog_logs_${entityId}`, {
      success: true,
      data: logs,
      latency: 150
    });
  }

  async getDatadogLogs(entityId: string, timeRange?: string): Promise<any[]> {
    this.logApiCall('datadog_logs', { entityId, timeRange });
    
    const mockResponse = this.mockResponses.get(`datadog_logs_${entityId}`);
    if (!mockResponse) {
      return [];
    }

    if (mockResponse.latency) {
      await this.sleep(mockResponse.latency);
    }

    if (!mockResponse.success) {
      throw new Error(mockResponse.error || 'Datadog API error');
    }

    return mockResponse.data;
  }

  // Mock Genie GraphQL API responses
  mockGenieOffer(offerId: string, offer: any): void {
    this.mockResponses.set(`genie_offer_${offerId}`, {
      success: true,
      data: offer,
      latency: 200
    });
  }

  async getGenieOffer(offerId: string, environment: string): Promise<any> {
    this.logApiCall('genie_offer', { offerId, environment });
    
    const mockResponse = this.mockResponses.get(`genie_offer_${offerId}`);
    if (!mockResponse) {
      return null;
    }

    await this.sleep(mockResponse.latency || 200);

    if (!mockResponse.success) {
      throw new Error(mockResponse.error || 'Genie API error');
    }

    return mockResponse.data;
  }

  // Mock UPS API responses
  mockUPSOfferPrice(offerId: string, priceResponse: any): void {
    this.mockResponses.set(`ups_price_${offerId}`, {
      success: true,
      data: priceResponse,
      latency: 120
    });
  }

  async getUPSOfferPrice(offerId: string, environment: string): Promise<any> {
    this.logApiCall('ups_price', { offerId, environment });
    
    const mockResponse = this.mockResponses.get(`ups_price_${offerId}`);
    if (!mockResponse) {
      return null;
    }

    await this.sleep(mockResponse.latency || 120);

    if (!mockResponse.success) {
      throw new Error(mockResponse.error || 'UPS API error');
    }

    return mockResponse.data;
  }

  // Mock Entity History API responses
  mockEntityHistory(entityId: string, history: any[]): void {
    this.mockResponses.set(`entity_history_${entityId}`, {
      success: true,
      data: history,
      latency: 100
    });
  }

  async getEntityHistory(entityId: string, entityType: string): Promise<any[]> {
    this.logApiCall('entity_history', { entityId, entityType });
    
    const mockResponse = this.mockResponses.get(`entity_history_${entityId}`);
    if (!mockResponse) {
      return [];
    }

    await this.sleep(mockResponse.latency || 100);

    if (!mockResponse.success) {
      throw new Error(mockResponse.error || 'Entity History API error');
    }

    return mockResponse.data;
  }

  // Error simulation methods
  mockApiError(apiKey: string, error: string, latency: number = 100): void {
    this.mockResponses.set(apiKey, {
      success: false,
      error,
      latency
    });
  }

  // Scenario-based mock setup
  setupOfferStatusScenario(offerId: string, environment: string): void {
    // Mock Genie offer as inactive
    this.mockGenieOffer(offerId, {
      id: offerId,
      name: `Test Offer ${offerId}`,
      status: 'INACTIVE',
      environment,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    });

    // Mock Datadog logs showing configuration error
    this.mockDatadogLogs(offerId, [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'ERROR',
        message: `Offer ${offerId} configuration validation failed`,
        service: 'offer-service',
        tags: [`offer_id:${offerId}`, `environment:${environment}`]
      }
    ]);

    // Mock entity history showing recent changes
    this.mockEntityHistory(offerId, [
      {
        version: 2,
        timestamp: '2024-01-15T10:30:00Z',
        changes: {
          status: { from: 'ACTIVE', to: 'INACTIVE' },
          reason: 'Configuration validation failed'
        },
        author: 'system'
      }
    ]);
  }

  setupPricingScenario(offerId: string, environment: string): void {
    // Mock UPS pricing data
    this.mockUPSOfferPrice(offerId, {
      offerId,
      price: 9.99,
      currency: 'USD',
      environment,
      effectiveDate: '2024-01-01T00:00:00Z',
      priceType: 'STANDARD'
    });

    // Mock Genie offer with pricing info
    this.mockGenieOffer(offerId, {
      id: offerId,
      name: `Pricing Test Offer ${offerId}`,
      status: 'ACTIVE',
      environment,
      pricing: {
        basePrice: 9.99,
        currency: 'USD'
      }
    });
  }

  // Utility methods
  private logApiCall(api: string, params: any): void {
    this.callLog.push({
      api,
      params,
      timestamp: new Date()
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test utilities
  getCallLog(): Array<{ api: string; params: any; timestamp: Date }> {
    return [...this.callLog];
  }

  getCallCount(api?: string): number {
    if (api) {
      return this.callLog.filter(call => call.api === api).length;
    }
    return this.callLog.length;
  }

  clearMocks(): void {
    this.mockResponses.clear();
    this.callLog = [];
  }
}