import { MongoStorage, MemoryService } from './storage';
import { memoryRetrievalNode, storeCaseNode } from './nodes';
import { AgentState } from './model/agentState';

let memoryService: MemoryService | null = null;

export async function initializeMemoryService(): Promise<MemoryService> {
  if (!memoryService) {
    const connectionString = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017';
    const dbName = process.env.MONGODB_DATABASE_NAME || 'ai-diagnostic-agent';
    
    console.log('[MemoryWorkflow] Initializing MongoDB connection...');
    console.log('[MemoryWorkflow] Connection string:', connectionString);
    console.log('[MemoryWorkflow] Database name:', dbName);
    
    const storage = new MongoStorage(connectionString, dbName);
    await storage.connect();
    
    memoryService = new MemoryService(storage);
    console.log('[MemoryWorkflow] Memory service initialized successfully');
  }
  
  return memoryService;
}

export async function memoryRetrievalWrapper(state: AgentState): Promise<Partial<AgentState>> {
  const service = await initializeMemoryService();
  return memoryRetrievalNode(state, service);
}

export async function storeCaseWrapper(state: AgentState): Promise<Partial<AgentState>> {
  const service = await initializeMemoryService();
  return storeCaseNode(state, service);
}