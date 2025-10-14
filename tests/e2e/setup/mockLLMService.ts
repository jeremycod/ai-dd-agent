import { logger } from '../../../src/utils/logger';

export interface MockLLMConfig {
  responseVariability?: number;
  latencySimulation?: boolean;
  errorInjection?: boolean;
  baseLatency?: number;
  errorRate?: number;
}

export interface MockResponse {
  text: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export class MockLLMService {
  private config: Required<MockLLMConfig>;
  private responseTemplates: Map<string, MockResponse[]> = new Map();
  private errorScenarios: Map<string, Error> = new Map();
  private callCount: number = 0;

  constructor(config: MockLLMConfig = {}) {
    this.config = {
      responseVariability: config.responseVariability ?? 0.1,
      latencySimulation: config.latencySimulation ?? true,
      errorInjection: config.errorInjection ?? false,
      baseLatency: config.baseLatency ?? 500,
      errorRate: config.errorRate ?? 0.05
    };
  }

  async initialize(): Promise<void> {
    await this.loadResponseTemplates();
    await this.setupErrorScenarios();
    logger.info('[MockLLMService] Initialized with config:', this.config);
  }

  private async loadResponseTemplates(): Promise<void> {
    // Load predefined response templates for different query types
    this.responseTemplates.set('ENTITY_STATUS', [
      {
        text: 'Based on the analysis, offer ABC-123 appears to be inactive in production due to configuration issues.',
        confidence: 0.9,
        metadata: { category: 'ENTITY_STATUS', tools_used: ['genieOffer', 'entityHistory'] }
      },
      {
        text: 'The offer ABC-123 is not showing because it has been disabled in the offer management system.',
        confidence: 0.85,
        metadata: { category: 'ENTITY_STATUS', tools_used: ['genieOffer'] }
      }
    ]);

    this.responseTemplates.set('OFFER_PRICE', [
      {
        text: 'The pricing for offer ABC-123 shows a discrepancy between staging ($9.99) and production ($12.99).',
        confidence: 0.92,
        metadata: { category: 'OFFER_PRICE', tools_used: ['upsOfferPrice', 'offerComparison'] }
      }
    ]);

    this.responseTemplates.set('CLARIFICATION', [
      {
        text: 'I need more information to help you. Could you please specify which offer you\'re referring to and in which environment?',
        confidence: 0.95,
        metadata: { category: 'CLARIFICATION', requires_clarification: true }
      }
    ]);
  }

  private async setupErrorScenarios(): Promise<void> {
    this.errorScenarios.set('timeout', new Error('Request timeout'));
    this.errorScenarios.set('rate_limit', new Error('Rate limit exceeded'));
    this.errorScenarios.set('invalid_response', new Error('Invalid response format'));
  }

  async generateResponse(
    prompt: string, 
    context: Record<string, any> = {}
  ): Promise<MockResponse> {
    this.callCount++;

    // Simulate latency
    if (this.config.latencySimulation) {
      const latency = this.calculateLatency();
      await this.sleep(latency);
    }

    // Inject errors if configured
    if (this.config.errorInjection && this.shouldInjectError()) {
      throw this.getRandomError();
    }

    // Determine response category from context
    const category = context.queryCategory || this.inferCategory(prompt);
    
    // Get appropriate response template
    const templates = this.responseTemplates.get(category) || this.getDefaultResponse();
    const baseResponse = this.selectResponse(templates);

    // Apply variability
    const response = this.applyVariability(baseResponse, prompt, context);

    logger.debug(`[MockLLMService] Generated response for category: ${category}`);
    return response;
  }

  private calculateLatency(): number {
    // Simulate realistic latency with some randomness
    const variance = this.config.baseLatency * 0.3;
    return this.config.baseLatency + (Math.random() - 0.5) * variance;
  }

  private shouldInjectError(): boolean {
    return Math.random() < this.config.errorRate;
  }

  private getRandomError(): Error {
    const errors = Array.from(this.errorScenarios.values());
    return errors[Math.floor(Math.random() * errors.length)];
  }

  private inferCategory(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('price') || lowerPrompt.includes('pricing')) {
      return 'OFFER_PRICE';
    }
    if (lowerPrompt.includes('status') || lowerPrompt.includes('showing')) {
      return 'ENTITY_STATUS';
    }
    if (lowerPrompt.includes('?') && lowerPrompt.split(' ').length < 5) {
      return 'CLARIFICATION';
    }
    
    return 'GENERAL_QUESTION';
  }

  private selectResponse(templates: MockResponse[]): MockResponse {
    if (templates.length === 0) {
      return this.getDefaultResponse()[0];
    }
    
    // Select response based on confidence scores (weighted random)
    const totalConfidence = templates.reduce((sum, t) => sum + (t.confidence || 0.5), 0);
    let random = Math.random() * totalConfidence;
    
    for (const template of templates) {
      random -= (template.confidence || 0.5);
      if (random <= 0) {
        return template;
      }
    }
    
    return templates[0];
  }

  private applyVariability(
    baseResponse: MockResponse, 
    prompt: string, 
    context: Record<string, any>
  ): MockResponse {
    let text = baseResponse.text;
    
    // Apply response variability
    if (this.config.responseVariability > 0) {
      text = this.varyResponse(text, this.config.responseVariability);
    }

    // Inject context-specific information
    text = this.injectContextualInfo(text, context);

    return {
      ...baseResponse,
      text,
      metadata: {
        ...baseResponse.metadata,
        call_count: this.callCount,
        variability_applied: this.config.responseVariability > 0
      }
    };
  }

  private varyResponse(text: string, variability: number): string {
    // Simple response variation - in practice, this could be more sophisticated
    const variations = [
      text,
      text.replace('appears to be', 'seems to be'),
      text.replace('Based on the analysis,', 'According to the data,'),
      text.replace('shows', 'indicates')
    ];
    
    if (Math.random() < variability) {
      return variations[Math.floor(Math.random() * variations.length)];
    }
    
    return text;
  }

  private injectContextualInfo(text: string, context: Record<string, any>): string {
    // Replace placeholders with actual context values
    let contextualText = text;
    
    if (context.entityIds && context.entityIds.length > 0) {
      contextualText = contextualText.replace(/ABC-123/g, context.entityIds[0]);
    }
    
    if (context.environment) {
      contextualText = contextualText.replace(/production/g, context.environment);
    }
    
    return contextualText;
  }

  private getDefaultResponse(): MockResponse[] {
    return [{
      text: 'I understand your query, but I need more specific information to provide an accurate diagnosis.',
      confidence: 0.7,
      metadata: { category: 'DEFAULT', fallback: true }
    }];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test utilities
  async reset(): Promise<void> {
    this.callCount = 0;
    logger.info('[MockLLMService] Reset call count and state');
  }

  getCallCount(): number {
    return this.callCount;
  }

  injectError(errorType: string): void {
    this.config.errorInjection = true;
    this.config.errorRate = 1.0; // Force error on next call
    logger.info(`[MockLLMService] Error injection enabled: ${errorType}`);
  }

  setResponseTemplate(category: string, responses: MockResponse[]): void {
    this.responseTemplates.set(category, responses);
    logger.info(`[MockLLMService] Updated response template for: ${category}`);
  }

  async cleanup(): Promise<void> {
    this.responseTemplates.clear();
    this.errorScenarios.clear();
    logger.info('[MockLLMService] Cleanup complete');
  }
}