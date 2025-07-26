import { MongoClient, Db, Collection } from 'mongodb';
import { DiagnosticCase, DiagnosticPattern } from '../model';

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
    console.log('[MongoStorage] Connecting to MongoDB...');
    await this.client.connect();
    console.log('[MongoStorage] Connected successfully');
    
    console.log('[MongoStorage] Creating indexes...');
    await this.createIndexes();
    console.log('[MongoStorage] Indexes created successfully');
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
  }

  async storeCase(diagnosticCase: DiagnosticCase): Promise<void> {
    console.log('[MongoStorage] Storing case in collection:', this.casesCollection.collectionName);
    console.log('[MongoStorage] Case data:', { caseId: diagnosticCase.caseId, category: diagnosticCase.category });
    
    const result = await this.casesCollection.replaceOne(
      { caseId: diagnosticCase.caseId },
      diagnosticCase,
      { upsert: true }
    );
    
    console.log('[MongoStorage] Store result:', { acknowledged: result.acknowledged, upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount });
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

  async storePattern(pattern: DiagnosticPattern): Promise<void> {
    console.log('[MongoStorage] Storing pattern in collection:', this.patternsCollection.collectionName);
    console.log('[MongoStorage] Pattern data:', { patternId: pattern.patternId, category: pattern.category });
    
    const result = await this.patternsCollection.replaceOne(
      { category: pattern.category, entityType: pattern.entityType, environment: pattern.environment },
      pattern,
      { upsert: true }
    );
    
    console.log('[MongoStorage] Pattern store result:', { acknowledged: result.acknowledged, upsertedCount: result.upsertedCount, modifiedCount: result.modifiedCount });
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
    console.log('[MongoStorage] Updating case with feedback:', caseId);
    console.log('[MongoStorage] messageFeedbacks to update:', messageFeedbacks);
    console.log('[MongoStorage] overallRlReward to update:', overallRlReward);
    
    // First, check if the case exists
    const existingCase = await this.casesCollection.findOne({ caseId: caseId });
    if (!existingCase) {
      console.error('[MongoStorage] Case not found for update:', caseId);
      return { acknowledged: false, modifiedCount: 0, error: 'Case not found' };
    }
    
    console.log('[MongoStorage] Found existing case:', existingCase.caseId);
    
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
    
    console.log('[MongoStorage] Update operations:', updateOperations);
    
    const result = await this.casesCollection.updateOne(
      { caseId: caseId },
      { $set: updateOperations }
    );
    
    console.log('[MongoStorage] Feedback update result:', { acknowledged: result.acknowledged, modifiedCount: result.modifiedCount, matchedCount: result.matchedCount });
    
    // Verify the update worked
    const updatedCase = await this.casesCollection.findOne({ caseId: caseId });
    console.log('[MongoStorage] Case after update - messageFeedbacks:', Object.keys(updatedCase?.messageFeedbacks || {}));
    console.log('[MongoStorage] Case after update - overallRlReward:', updatedCase?.overallRlReward);
    
    return result;
  }
}