import { ApiResponseCapture } from '../../../scripts/captureApiResponses';
import * as path from 'path';
import * as fs from 'fs/promises';

export class RealDataMockService {
  private capture = new ApiResponseCapture();
  private fixturesDir = path.join(__dirname, '../fixtures/captured-responses');

  async initialize(): Promise<void> {
    await this.capture.initialize();
  }

  // Load real captured responses for mocking
  async getDatadogLogs(entityId: string, timeRange?: string): Promise<any[]> {
    const captured = await this.capture.loadCapturedResponse('datadog_logs', { entityId, timeRange });
    
    if (captured && captured.statusCode === 200) {
      return captured.response;
    }
    
    // Fallback to default if no captured response
    return this.getDefaultDatadogLogs(entityId);
  }

  async getGenieOffer(offerId: string, environment: string): Promise<any> {
    const captured = await this.capture.loadCapturedResponse('genie_offer', { offerId, environment });
    
    if (captured && captured.statusCode === 200) {
      return captured.response;
    }
    
    return this.getDefaultGenieOffer(offerId, environment);
  }

  async getUPSOfferPrice(offerId: string, environment: string): Promise<any> {
    const captured = await this.capture.loadCapturedResponse('ups_price', { offerId, environment });
    
    if (captured && captured.statusCode === 200) {
      return captured.response;
    }
    
    return this.getDefaultUPSPrice(offerId, environment);
  }

  // Load all captured responses for analysis
  async getAllCapturedResponses(): Promise<any[]> {
    try {
      const files = await fs.readdir(this.fixturesDir);
      const responses = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.fixturesDir, file);
          const data = await fs.readFile(filepath, 'utf-8');
          responses.push(JSON.parse(data));
        }
      }
      
      return responses;
    } catch (error) {
      return [];
    }
  }

  // Generate mock scenarios from real captured data
  async generateScenariosFromCapturedData(): Promise<any[]> {
    const capturedResponses = await this.getAllCapturedResponses();
    const scenarios = [];

    // Group responses by entity ID
    const responsesByEntity = new Map();
    
    for (const response of capturedResponses) {
      const entityId = response.params.entityId || response.params.offerId;
      if (!responsesByEntity.has(entityId)) {
        responsesByEntity.set(entityId, []);
      }
      responsesByEntity.get(entityId).push(response);
    }

    // Create scenarios from grouped responses
    for (const [entityId, responses] of responsesByEntity) {
      const scenario = {
        entityId,
        name: `real_data_${entityId}`,
        description: `Real production data for ${entityId}`,
        responses: responses.reduce((acc: any, resp: any) => {
          acc[resp.api] = resp.response;
          return acc;
        }, {}),
        capturedAt: responses[0]?.timestamp,
        environment: responses.find((r: any) => r.params.environment)?.params.environment || 'production'
      };
      
      scenarios.push(scenario);
    }

    return scenarios;
  }

  // Fallback methods with realistic defaults
  private getDefaultDatadogLogs(entityId: string): any[] {
    return [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Default log entry for ${entityId}`,
        service: 'offer-service',
        tags: [`entity_id:${entityId}`]
      }
    ];
  }

  private getDefaultGenieOffer(offerId: string, environment: string): any {
    return {
      id: offerId,
      name: `Default Offer ${offerId}`,
      status: 'ACTIVE',
      environment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private getDefaultUPSPrice(offerId: string, environment: string): any {
    return {
      offerId,
      price: 9.99,
      currency: 'USD',
      environment,
      effectiveDate: new Date().toISOString()
    };
  }

  // Utility to check if we have real data for a scenario
  async hasRealDataFor(api: string, params: any): Promise<boolean> {
    const captured = await this.capture.loadCapturedResponse(api, params);
    return captured !== null && captured.statusCode === 200;
  }

  // Get coverage report of captured vs synthetic data
  async getCoverageReport(): Promise<any> {
    const allResponses = await this.getAllCapturedResponses();
    const coverage = {
      total: allResponses.length,
      byApi: {} as Record<string, number>,
      byEnvironment: {} as Record<string, number>,
      dateRange: {
        earliest: null as Date | null,
        latest: null as Date | null
      }
    };

    for (const response of allResponses) {
      // Count by API
      coverage.byApi[response.api] = (coverage.byApi[response.api] || 0) + 1;
      
      // Count by environment
      const env = response.params.environment || 'unknown';
      coverage.byEnvironment[env] = (coverage.byEnvironment[env] || 0) + 1;
      
      // Track date range
      const timestamp = new Date(response.timestamp);
      if (!coverage.dateRange.earliest || timestamp < coverage.dateRange.earliest) {
        coverage.dateRange.earliest = timestamp;
      }
      if (!coverage.dateRange.latest || timestamp > coverage.dateRange.latest) {
        coverage.dateRange.latest = timestamp;
      }
    }

    return coverage;
  }
}