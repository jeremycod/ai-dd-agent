import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryService } from '../storage/memoryService';
import { logger } from '../utils';

const RetrieveSimilarCasesSchema = z.object({
  category: z.string().describe('Query category to search for similar cases'),
  entityType: z.string().describe('Entity type to filter cases'),
  environment: z.string().describe('Environment to filter cases'),
  limit: z.number().optional().default(5).describe('Maximum number of cases to retrieve')
});

const StoreCaseSchema = z.object({
  caseId: z.string().describe('Unique identifier for the case'),
  category: z.string().describe('Query category'),
  entityType: z.string().describe('Entity type'),
  environment: z.string().describe('Environment'),
  userQuery: z.string().describe('Original user query'),
  toolsUsed: z.array(z.string()).describe('List of tools used in diagnosis'),
  overallRlReward: z.number().optional().describe('Overall RL reward for the case')
});

export function createMemoryTools(memoryService: MemoryService) {
  const retrieveSimilarCasesTool = new DynamicStructuredTool({
    name: 'retrieveSimilarCases',
    description: 'Retrieves similar diagnostic cases from memory based on category, entity type, and environment',
    schema: RetrieveSimilarCasesSchema as any,
    func: async (input: z.infer<typeof RetrieveSimilarCasesSchema>) => {
      const { category, entityType, environment, limit } = input;
      logger.info(`Retrieving similar cases for category: ${category}, entityType: ${entityType}, environment: ${environment}`);
      
      try {
        const similarCases = await memoryService.storage.findSimilarCases(
          category,
          entityType,
          environment,
          limit
        );

        return {
          similarCases,
          count: similarCases.length,
          message: `Found ${similarCases.length} similar cases`
        };
      } catch (error) {
        logger.error('Error retrieving similar cases:', error);
        return {
          similarCases: [],
          count: 0,
          message: `Error retrieving similar cases: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });

  const storeCaseTool = new DynamicStructuredTool({
    name: 'storeCase',
    description: 'Stores a diagnostic case in memory for future learning',
    schema: StoreCaseSchema as any,
    func: async (input: z.infer<typeof StoreCaseSchema>) => {
      const { caseId, category, entityType, environment, userQuery, toolsUsed, overallRlReward } = input;
      logger.info(`Storing case: ${caseId} for category: ${category}`);
      
      try {
        const diagnosticCase = {
          caseId,
          timestamp: new Date(),
          category: category as any,
          entityType: entityType as any,
          entityIds: [],
          environment: environment as any,
          userQuery,
          toolsUsed,
          overallRlReward,
          messageFeedbacks: {}
        };

        await memoryService.storage.storeCase(diagnosticCase);

        return {
          success: true,
          message: `Successfully stored case ${caseId}`
        };
      } catch (error) {
        logger.error('Error storing case:', error);
        return {
          success: false,
          message: `Error storing case: ${error instanceof Error ? error.message : String(error)}`
        };
      }
    }
  });

  return {
    retrieveSimilarCasesTool,
    storeCaseTool
  };
}