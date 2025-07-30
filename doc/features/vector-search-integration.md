# MongoDB Atlas Vector Search Integration

## Overview
Enables semantic similarity search for diagnostic cases using vector embeddings, allowing the system to find relevant historical cases even when they don't match exactly.

## Implementation Status
✅ **Infrastructure Ready** (needs MongoDB Atlas vector index setup)

## How It Works

### 1. Embedding Generation
```typescript
// From: src/services/EmbeddingService.ts
const queryEmbedding = await embeddingService.generateQueryEmbedding(userQuery);
// Generates 1536-dimensional vector representing semantic meaning
```

### 2. Vector Search Query
```typescript
// From: src/storage/mongodb.ts
const similarCases = await db.collection('diagnostic_cases').aggregate([
  {
    $vectorSearch: {
      queryVector: queryEmbedding,
      path: "queryEmbedding",
      numCandidates: 100,
      limit: 10,
      index: "vector_index"
    }
  },
  {
    $addFields: {
      similarityScore: { $meta: "vectorSearchScore" }
    }
  }
]);
```

### 3. Fallback Strategy
```typescript
// From: src/storage/memoryService.ts
try {
  const vectorResults = await this.storage.findSimilarCasesByEmbedding(queryEmbedding);
  if (vectorResults.length > 0) return vectorResults;
} catch (error) {
  logger.warn('Vector search failed, falling back to exact matching');
}
return await this.storage.findSimilarCases(category, entityType, environment);
```

## Key Benefits

### Before Vector Search
```typescript
// Only finds exact matches
const similarCases = await db.find({
  category: 'OFFER_PRICE',
  entityType: 'offer', 
  environment: 'production'
});
// Result: Very few matches, limited learning
```

### After Vector Search
```typescript
// Finds semantically similar cases
Query: "Offer pricing is wrong in production"
Similar Cases Found:
- "Price mismatch for offer in prod" (similarity: 0.85)
- "Incorrect pricing displayed" (similarity: 0.78)  
- "Offer shows bad price" (similarity: 0.72)
// Result: Rich historical context from varied phrasings
```

## Code Implementation

### Primary Files
- **`src/services/EmbeddingService.ts`** - Multi-provider embedding generation
- **`src/services/AIServiceFactory.ts`** - Provider-agnostic service creation
- **`src/storage/mongodb.ts`** - Vector search implementation
- **`src/storage/memoryService.ts`** - Integration with case retrieval

### Key Classes
- **`EmbeddingService`** - Handles OpenAI/Voyage AI embeddings
- **`MongoStorage.findSimilarCasesByEmbedding()`** - Vector search logic
- **`MemoryService.retrieveSimilarCases()`** - Orchestrates search with fallback

### Provider Support
- **OpenAI**: `text-embedding-3-small` (1536 dimensions)
- **Voyage AI**: `voyage-large-2` (1536 dimensions)
- **Configurable**: Switch providers via environment variables

## Current Issues

### 1. Missing MongoDB Atlas Vector Index
**Problem**: Vector search index not created in MongoDB Atlas
**Solution**: Create index with this configuration:
```json
{
  "fields": [
    {
      "path": "queryEmbedding",
      "type": "vector",
      "numDimensions": 1536,
      "similarity": "cosine"
    }
  ]
}
```

### 2. Voyage AI API Key Missing
**Problem**: Embedding generation failing
**Evidence**: `[ERROR] [EmbeddingService] Error generating query embedding: {}`
**Solution**: Configure `VOYAGE_API_KEY` or switch to OpenAI embeddings

## Real-World Impact

### Example: Semantic Case Matching
```
Current Query: "Can you validate if this offer in QA is properly configured?"

Without Vector Search:
- Finds: 0 cases (exact category/environment match only)
- Context: None

With Vector Search (when working):
- Finds: "Offer validation issues in staging" (similarity: 0.82)
- Finds: "Check offer configuration problems" (similarity: 0.79)
- Context: Rich historical patterns and solutions
```

## Setup Instructions

### 1. MongoDB Atlas Vector Index
1. Go to MongoDB Atlas → Search → Create Search Index
2. Select "Vector Search" (not Atlas Search)
3. Choose database: `ai-diagnostic-agent`
4. Choose collection: `diagnostic_cases`
5. Use index name: `vector_index`
6. Apply configuration above

### 2. Embedding Provider Setup
```bash
# Option 1: Use Voyage AI
export VOYAGE_API_KEY=your_voyage_key

# Option 2: Switch to OpenAI
export EMBEDDING_PROVIDER=openai
export OPENAI_API_KEY=your_openai_key
```

## Future Enhancements
- **Hybrid Search**: Combine vector similarity with metadata filtering
- **Multi-Modal Embeddings**: Include error logs and configuration data
- **Similarity Threshold Tuning**: Optimize threshold based on result quality
- **Embedding Model Comparison**: Benchmark different embedding models

## Monitoring & Metrics
- Vector search success rate vs. fallback usage
- Similarity score distribution of retrieved cases
- Query response time comparison (vector vs. exact)
- User satisfaction with vector-retrieved historical context