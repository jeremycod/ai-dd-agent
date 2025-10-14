import { AIServiceFactory } from './services';
import { UserQueryExtractionSchema, UserQueryExtraction } from './model';

const aiFactory = AIServiceFactory.getInstance();

export const extractionLLM = aiFactory.createStructuredLLM<UserQueryExtraction>(
  UserQueryExtractionSchema,
  { temperature: 0 }
);

export const summarizerLLM = aiFactory.createLLM({ temperature: 0 });
