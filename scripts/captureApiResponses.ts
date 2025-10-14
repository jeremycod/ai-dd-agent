import * as fs from 'fs/promises';
import * as path from 'path';

interface CapturedApiResponse {
  api: string;
  method: string;
  url: string;
  params: any;
  response: any;
  timestamp: Date;
  statusCode: number;
}

export class ApiResponseCapture {
  private captureDir = path.join(__dirname, '../tests/e2e/fixtures/captured-responses');

  async initialize(): Promise<void> {
    await fs.mkdir(this.captureDir, { recursive: true });
    console.log('[ApiResponseCapture] Initialized capture directory');
  }

  async captureResponse(
    api: string,
    method: string,
    url: string,
    params: any,
    response: any,
    statusCode: number = 200
  ): Promise<void> {
    const captured: CapturedApiResponse = {
      api,
      method,
      url,
      params,
      response,
      timestamp: new Date(),
      statusCode
    };

    const filename = this.generateFilename(api, params);
    const filepath = path.join(this.captureDir, filename);

    await fs.writeFile(filepath, JSON.stringify(captured, null, 2));
    console.log(`[ApiResponseCapture] Captured ${api} response to ${filename}`);
  }

  async loadCapturedResponse(api: string, params: any): Promise<CapturedApiResponse | null> {
    const filename = this.generateFilename(api, params);
    const filepath = path.join(this.captureDir, filename);

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  private generateFilename(api: string, params: any): string {
    const paramHash = this.hashParams(params);
    return `${api}_${paramHash}.json`;
  }

  private hashParams(params: any): string {
    const str = JSON.stringify(params, Object.keys(params).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export class ProductionApiCapture {
  private capture = new ApiResponseCapture();

  constructor() {
    this.capture.initialize();
  }

  async captureDatadogLogs(originalFunction: Function, entityId: string, timeRange?: string): Promise<any> {
    try {
      const response = await originalFunction(entityId, timeRange);
      
      await this.capture.captureResponse(
        'datadog_logs',
        'GET',
        '/api/v2/logs/search',
        { entityId, timeRange },
        response
      );
      
      return response;
    } catch (error) {
      await this.capture.captureResponse(
        'datadog_logs',
        'GET',
        '/api/v2/logs/search',
        { entityId, timeRange },
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
      throw error;
    }
  }

  async captureGenieOffer(originalFunction: Function, offerId: string, environment: string): Promise<any> {
    try {
      const response = await originalFunction(offerId, environment);
      
      await this.capture.captureResponse(
        'genie_offer',
        'POST',
        '/graphql',
        { offerId, environment },
        response
      );
      
      return response;
    } catch (error) {
      await this.capture.captureResponse(
        'genie_offer',
        'POST',
        '/graphql',
        { offerId, environment },
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
      throw error;
    }
  }

  async captureUPSOffer(originalFunction: Function, offerId: string, environment: string): Promise<any> {
    try {
      const response = await originalFunction(offerId, environment);
      
      await this.capture.captureResponse(
        'ups_offer_price',
        'GET',
        '/api/v1/offer-price',
        { offerId, environment },
        response
      );
      
      return response;
    } catch (error) {
      await this.capture.captureResponse(
        'ups_offer_price',
        'GET',
        '/api/v1/offer-price',
        { offerId, environment },
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
      throw error;
    }
  }

  async captureOfferService(originalFunction: Function, offerId: string, environment: string): Promise<any> {
    try {
      const response = await originalFunction(offerId, environment);
      
      await this.capture.captureResponse(
        'offer_service',
        'GET',
        '/api/v1/offers',
        { offerId, environment },
        response
      );
      
      return response;
    } catch (error) {
      await this.capture.captureResponse(
        'offer_service',
        'GET',
        '/api/v1/offers',
        { offerId, environment },
        { error: error instanceof Error ? error.message : String(error) },
        500
      );
      throw error;
    }
  }
}