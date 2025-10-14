import { logger } from '../utils';
import { AgentState } from '../model';

// Conditional imports to avoid missing module errors
let OpenAI: any;
try {
  OpenAI = require('openai');
} catch (error) {
  logger.warn('[EmbeddingService] OpenAI package not installed, OpenAI embeddings will not be available');
}

export type EmbeddingProvider = 'openai' | 'voyage';

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model?: string;
  dimensions?: number;
}

export class EmbeddingService {
  private openai?: any;
  private config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      provider: (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai',
      model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '1536'),
      ...config
    };

    if (this.config.provider === 'openai') {
      if (!OpenAI) {
        throw new Error('OpenAI package not installed. Run: npm install openai');
      }
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }

    logger.info('[EmbeddingService] Initialized with provider: %s, model: %s', 
      this.config.provider, this.config.model);
  }

  async generateQueryEmbedding(userQuery: string): Promise<number[]> {
    try {
      logger.info('[EmbeddingService] Generating embedding for query using %s', this.config.provider);
      
      switch (this.config.provider) {
        case 'openai':
          return await this.generateOpenAIEmbedding(userQuery);
        case 'voyage':
          return await this.generateVoyageEmbedding(userQuery);
        default:
          throw new Error(`Unsupported embedding provider: ${this.config.provider}`);
      }
    } catch (error) {
      logger.error('[EmbeddingService] Error generating query embedding: %j', error);
      throw error;
    }
  }

  async generateContextEmbedding(state: AgentState): Promise<number[]> {
    const contextText = this.buildContextText(state);
    return this.generateQueryEmbedding(contextText);
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    if (!OpenAI) {
      throw new Error('OpenAI package not installed. Run: npm install openai');
    }
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openai.embeddings.create({
      model: this.config.model!,
      input: text,
      encoding_format: "float"
    });

    const embedding = response.data[0].embedding;
    logger.info('[EmbeddingService] Generated OpenAI embedding with %d dimensions', embedding.length);
    
    return embedding;
  }

  private async generateVoyageEmbedding(text: string): Promise<number[]> {
    // Voyage AI API call (alternative to OpenAI embeddings)
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        input: [text],
        model: this.config.model || 'voyage-large-2'
      })
    });

    if (!response.ok) {
      throw new Error(`Voyage API error: ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;
    
    logger.info('[EmbeddingService] Generated Voyage embedding with %d dimensions', embedding.length);
    
    return embedding;
  }

  private buildContextText(state: AgentState): string {
    const parts = [];
    
    if (state.queryCategory) parts.push(`Category: ${state.queryCategory}`);
    if (state.entityType) parts.push(`Entity Type: ${state.entityType}`);
    if (state.entityIds?.length) parts.push(`Entity IDs: ${state.entityIds.join(', ')}`);
    if (state.environment) parts.push(`Environment: ${state.environment}`);
    if (state.userQuery) parts.push(`Query: ${state.userQuery}`);
    
    // Add error information if available
    if (state.datadogLogs?.length) {
      const errorMessages = state.datadogLogs
        .filter((log: any) => log.status === 'error')
        .map((log: any) => log.message)
        .slice(0, 3);
      
      if (errorMessages.length) {
        parts.push(`Errors: ${errorMessages.join('; ')}`);
      }
    }
    
    return parts.join('\n');
  }
}