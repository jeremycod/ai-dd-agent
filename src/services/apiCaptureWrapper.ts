import { ProductionApiCapture } from '../../scripts/captureApiResponses';

export class ApiCaptureWrapper {
  private capture: ProductionApiCapture | null = null;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.CAPTURE_API_RESPONSES === 'true';
    if (this.isEnabled) {
      this.capture = new ProductionApiCapture();
      console.log('[ApiCaptureWrapper] API response capture enabled');
    }
  }

  async wrapDatadogCall<T>(
    originalFunction: () => Promise<T>,
    entityId: string,
    timeRange?: string
  ): Promise<T> {
    if (this.capture) {
      return await this.capture.captureDatadogLogs(originalFunction, entityId, timeRange);
    }
    return await originalFunction();
  }

  async wrapGenieCall<T>(
    originalFunction: () => Promise<T>,
    offerId: string,
    environment: string
  ): Promise<T> {
    if (this.capture) {
      return await this.capture.captureGenieOffer(originalFunction, offerId, environment);
    }
    return await originalFunction();
  }

  async wrapUPSCall<T>(
    originalFunction: () => Promise<T>,
    offerId: string,
    environment: string
  ): Promise<T> {
    if (this.capture) {
      return await this.capture.captureUPSOffer(originalFunction, offerId, environment);
    }
    return await originalFunction();
  }

  async wrapOfferServiceCall<T>(
    originalFunction: () => Promise<T>,
    offerId: string,
    environment: string
  ): Promise<T> {
    if (this.capture) {
      return await this.capture.captureOfferService(originalFunction, offerId, environment);
    }
    return await originalFunction();
  }

  isCapturing(): boolean {
    return this.isEnabled;
  }
}