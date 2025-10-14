import { MongoClient, Db, Collection } from 'mongodb';
import { DiagnosticCase, DiagnosticPattern } from '../model';
import { logger } from '../utils';

// Extend DiagnosticCase interface to include vector embedding and tool contributions
interface DiagnosticCaseWithEmbedding extends DiagnosticCase {
  queryEmbedding?: number[];
  similarityScore?: number;
  toolContributions?: {
    [toolName: string]: {
      contributionScore: number;
      relevanceScore: number;
      wasUseful: boolean;
      reasoning: string[];
    };
  };
}

export class MongoStorage {
  private client: MongoClient;
  private db: Db;
  private casesCollection: Collection<DiagnosticCase>;
  private patternsCollection: Collection<DiagnosticPattern>;

  constructor(connectionString: string, dbName: string = 'ai-diagnostic-agent') {
    this.client = new MongoClient(connectionString);
    this.db = this.client.db(dbName);
    this.casesCollection = this.db.collection<DiagnosticCase>('diagnostic_cases');
    this.patternsCollection = this.db.collection<DiagnosticPattern>('diagnostic_patterns');
  }

  async connect(): Promise<void> {
    logger.info('[MongoStorage] Connecting to MongoDB...');
    await this.client.connect();
    logger.info('[MongoStorage] Connected successfully');
    
    logger.info('[MongoStorage] Creating indexes...');
    await this.createIndexes();
    logger.info('[MongoStorage] Indexes created successfully');
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  private async createIndexes(): Promise<void> {
    await this.casesCollection.createIndex({ category: 1, entityType: 1, environment: 1 });
    await this.casesCollection.createIndex({ timestamp: -1 });
    await this.casesCollection.createIndex({ caseId: 1 }, { unique: true });
    await this.patternsCollection.createIndex({ category: 1, entityType: 1, environment: 1 }, { unique: true });
    await this.patternsCollection.createIndex({ successRate: -1 });
    
    // Vector search index will be created manually in MongoDB Atlas UI
    // Index name: "vector_index"
    // Field: "queryEmbedding"
    // Type: "vector"
    // Dimensions: 1536 (for OpenAI text-embedding-3-small)
    logger.info('[MongoStorage] Vector search index should be created manually in Atlas for queryEmbedding field');
  }

  async storeCase(diagnosticCase: DiagnosticCase): Promise<void> {
    logger.info('[MongoStorage] Storing case in collection: %s', this.casesCollection.collectionName);
    logger.info('[MongoStorage] Case data: %j', { caseId: diagnosticCase.caseId, category: diagnosticCase.category });
    
    const result = await this.casesCollection.replaceOne(
      { caseId: diagnosticCase.caseId },
      diagnosticCase,
      { upsert: true }
    );
    
    logger.info('[MongoStorage] Store result: %j', { acknowledged: result.acknowledged, upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount });
  }

  async findSimilarCases(
    category: string,
    entityType: string,
    environment: string,
    limit: number = 5
  ): Promise<DiagnosticCase[]> {
    return await this.casesCollection
      .find({ category: category as any, entityType: entityType as any, environment: environment as any })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async findSimilarCasesByEmbedding(
    queryEmbedding: number[],
    category?: string,
    threshold: number = 0.7,
    limit: number = 10
  ): Promise<DiagnosticCase[]> {
    try {
      // Use MongoDB Atlas Vector Search
      const pipeline: any[] = [
        {
          $vectorSearch: {
            queryVector: queryEmbedding,
            path: "queryEmbedding",
            numCandidates: 100,
            limit: limit,
            index: "vector_index"
          }
        },
        {
          $addFields: {
            similarityScore: { $meta: "vectorSearchScore" }
          }
        }
      ];

      // Add category filter if provided
      if (category) {
        pipeline.push({
          $match: {
            category: category as any,
            similarityScore: { $gte: threshold }
          }
        });
      } else {
        pipeline.push({
          $match: {
            similarityScore: { $gte: threshold }
          }
        });
      }

      pipeline.push({ $sort: { similarityScore: -1 } });

      const results = await this.casesCollection.aggregate(pipeline).toArray();
      logger.info(`[MongoStorage] Vector search found ${results.length} similar cases`);
      return results as DiagnosticCase[];
    } catch (error) {
      logger.warn('[MongoStorage] Vector search failed, falling back to exact matching:', error);
      // Fallback to exact matching if vector search fails
      return this.findSimilarCases(category || '', '', '', limit);
    }
  }

  async storeCaseWithEmbedding(diagnosticCase: DiagnosticCase, queryEmbedding?: number[]): Promise<void> {
    const caseWithEmbedding = {
      ...diagnosticCase,
      ...(queryEmbedding && { queryEmbedding })
    };
    
    logger.info(`[MongoStorage] Storing case with embedding in collection:, ${this.casesCollection.collectionName}`);
    logger.info('[MongoStorage] Case data: %j', { 
      caseId: caseWithEmbedding.caseId, 
      category: caseWithEmbedding.category,
      hasEmbedding: !!queryEmbedding
    });
    
    const result = await this.casesCollection.replaceOne(
      { caseId: caseWithEmbedding.caseId },
      caseWithEmbedding,
      { upsert: true }
    );
    
    logger.info('[MongoStorage] Store result: %j', { 
      acknowledged: result.acknowledged, 
      upsertedCount: result.upsertedCount, 
      modifiedCount: result.modifiedCount 
    });
  }

  async storePattern(pattern: DiagnosticPattern): Promise<void> {
    logger.info('[MongoStorage] Storing pattern in collection: %s', this.patternsCollection.collectionName);
    logger.info('[MongoStorage] Pattern data: %j', { patternId: pattern.patternId, category: pattern.category });
    
    const result = await this.patternsCollection.replaceOne(
      { category: pattern.category, entityType: pattern.entityType, environment: pattern.environment },
      pattern,
      { upsert: true }
    );
    
    logger.info('[MongoStorage] Pattern store result: %j', { acknowledged: result.acknowledged, upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount });
  }

  async getPattern(
    category: string,
    entityType: string,
    environment: string
  ): Promise<DiagnosticPattern | null> {
    return await this.patternsCollection.findOne({ category: category as any, entityType: entityType as any, environment: environment as any });
  }

  async getTopPatterns(limit: number = 10): Promise<DiagnosticPattern[]> {
    return await this.patternsCollection
      .find({})
      .sort({ successRate: -1, usageCount: -1 })
      .limit(limit)
      .toArray();
  }

  async updateCaseWithFeedback(caseId: string, messageFeedbacks: Record<string, any>, overallRlReward?: number): Promise<any> {
    logger.info('[MongoStorage] Updating case with feedback: %s', caseId);
    logger.info('[MongoStorage] messageFeedbacks to update: %j', messageFeedbacks);
    logger.info('[MongoStorage] overallRlReward to update: %s', overallRlReward);
    
    // First, check if the case exists
    const existingCase = await this.casesCollection.findOne({ caseId: caseId });
    if (!existingCase) {
      console.error('[MongoStorage] Case not found for update:', caseId);
      return { acknowledged: false, modifiedCount: 0, error: 'Case not found' };
    }
    
    logger.info('[MongoStorage] Found existing case: %s', existingCase.caseId);
    
    const updateOperations: any = {};
    
    if (messageFeedbacks && Object.keys(messageFeedbacks).length > 0) {
      // Merge new feedback with existing feedback
      Object.keys(messageFeedbacks).forEach(key => {
        updateOperations[`messageFeedbacks.${key}`] = messageFeedbacks[key];
      });
    }
    
    if (overallRlReward !== undefined) {
      updateOperations.overallRlReward = overallRlReward;
    }
    
    logger.info('[MongoStorage] Update operations: %j', updateOperations);
    
    const result = await this.casesCollection.updateOne(
      { caseId: caseId },
      { $set: updateOperations }
    );
    
    logger.info('[MongoStorage] Feedback update result: %j', { acknowledged: result.acknowledged, modifiedCount: result.modifiedCount, matchedCount: result.matchedCount });
    
    // Verify the update worked
    const updatedCase = await this.casesCollection.findOne({ caseId: caseId });
    logger.info('[MongoStorage] Case after update - messageFeedbacks: %j', Object.keys(updatedCase?.messageFeedbacks || {}));
    logger.info('[MongoStorage] Case after update - overallRlReward: %s', updatedCase?.overallRlReward);
    
    return result;
  }
}