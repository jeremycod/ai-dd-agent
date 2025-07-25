import { ChatAnthropic } from '@langchain/anthropic';
import { UserQueryExtractionSchema, UserQueryExtraction } from './model';

export const extractionLLM = new ChatAnthropic({
  model: 'claude-3-5-sonnet-latest',
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
}).withStructuredOutput<UserQueryExtraction>(UserQueryExtractionSchema);

export const summarizerLLM = new ChatAnthropic({
  model: 'claude-3-5-sonnet-latest',
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
});
