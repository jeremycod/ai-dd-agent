import 'dotenv/config';
import { ChatAnthropic } from '@langchain/anthropic';
import { allTools } from './tools/tools';

export const llm = new ChatAnthropic({
  model: 'claude-3-5-sonnet-latest',
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
}).bindTools(allTools);

export const extractionLLM = new ChatAnthropic({
  model: 'claude-3-5-sonnet-latest',
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const summarizerLLM = new ChatAnthropic({
  model: 'claude-3-5-sonnet-latest',
  temperature: 0,
  apiKey: process.env.ANTHROPIC_API_KEY,
});
