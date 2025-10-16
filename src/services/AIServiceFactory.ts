import { EmbeddingService, EmbeddingProvider } from './EmbeddingService';
import { logger } from '../utils';


let ChatAnthropic: any;
let ChatOpenAI: any;

try {
  ChatAnthropic = require('@langchain/anthropic').ChatAnthropic;
} catch (error) {
  logger.warn('[AIServiceFactory] @langchain/anthropic not available');
}

try {
  ChatOpenAI = require('@langchain/openai').ChatOpenAI;
} catch (error) {
  logger.warn('[AIServiceFactory] @langchain/openai not available');
}

export type LLMProvider = 'anthropic' | 'openai';

export interface AIServiceConfig {
  llmProvider: LLMProvider;
  embeddingProvider: EmbeddingProvider;
  llmModel?: string;
  embeddingModel?: string;
  temperature?: number;
}

export class AIServiceFactory {
  private static instance: AIServiceFactory;
  private config: AIServiceConfig;

  private constructor() {
    this.config = {
      llmProvider: (process.env.LLM_PROVIDER as LLMProvider) || 'anthropic',
      embeddingProvider: (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai',
      llmModel: process.env.LLM_MODEL || 'claude-3-5-sonnet-latest',
      embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0')
    };

    logger.info('[AIServiceFactory] Initialized with LLM: %s, Embeddings: %s', 
      this.config.llmProvider, this.config.embeddingProvider);
  }

  static getInstance(): AIServiceFactory {
    if (!AIServiceFactory.instance) {
      AIServiceFactory.instance = new AIServiceFactory();
    }
    return AIServiceFactory.instance;
  }

  createLLM(options?: { temperature?: number; model?: string }) {
    const temperature = options?.temperature ?? this.config.temperature;
    const model = options?.model ?? this.config.llmModel;

    switch (this.config.llmProvider) {
      case 'anthropic':
        if (!ChatAnthropic) {
          throw new Error('@langchain/anthropic package not installed. Run: npm install @langchain/anthropic');
        }
        return new ChatAnthropic({
          model: model!,
          temperature,
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

      case 'openai':
        if (!ChatOpenAI) {
          throw new Error('@langchain/openai package not installed. Run: npm install @langchain/openai');
        }
        return new ChatOpenAI({
          model: model!,
          temperature,
          apiKey: process.env.OPENAI_API_KEY,
        });

      default:
        throw new Error(`Unsupported LLM provider: ${this.config.llmProvider}`);
    }
  }

  createStructuredLLM<T>(schema: any, options?: { temperature?: number; model?: string }) {
    const llm = this.createLLM(options);
    return (llm as any).withStructuredOutput(schema);
  }

  createEmbeddingService() {
    return new EmbeddingService({
      provider: this.config.embeddingProvider,
      model: this.config.embeddingModel
    });
  }

  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AIServiceConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.info('[AIServiceFactory] Config updated: %j', this.config);
  }
}