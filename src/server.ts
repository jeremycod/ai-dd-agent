import 'dotenv/config'; // Keep this at the very top to load environment variables first
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { SystemMessage } from '@langchain/core/messages';
import { app } from './workflow'; // Assuming 'app' is your Langchain agent graph
import { AgentStateData } from './model';
import { PROMPT } from './constants';
import path from 'path';
import { logger, TokenService, loadSymmetricKey, generateNewHumanMessage } from './utils';
import { ZodError} from "zod";
import { safeJsonStringify} from "./utils";

import {MemoryService} from "./storage/memoryService";

import {MongoStorage} from "./storage/mongodb";

const server = express();
const PORT = 3000;

server.use(bodyParser.json());
server.use(express.static(path.join(__dirname, '..', 'public')));
server.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

server.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'AI Agent Backend is healthy and running.',
    timestamp: new Date().toISOString(),
    location: 'Surrey, British Columbia, Canada',
  });
});

// Test endpoint to manually update a case
server.post('/test-update/:caseId', async (req: Request, res: Response) => {
  const { caseId } = req.params;
  
  try {
    const { MongoStorage } = require('./storage/mongodb');
    const mongoStorage = new MongoStorage(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017');
    await mongoStorage.connect();
    
    const testFeedback = {
      [`test_feedback_${Date.now()}`]: {
        type: 'positive',
        timestamp: new Date(),
        feedbackSource: 'test_endpoint'
      }
    };
    
    const result = await mongoStorage.updateCaseWithFeedback(caseId, testFeedback, 5);
    
    res.json({ 
      success: true, 
      caseId,
      updateResult: result,
      testFeedback
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Simple feedback endpoint (thumbs up/down)
server.post('/feedback', async (req: Request, res: Response) => {
  console.log('[FEEDBACK ENDPOINT] Simple feedback endpoint called');
  console.log('[FEEDBACK ENDPOINT] Request body:', req.body);
  const { type, caseId, timestamp } = req.body;
  
  if (!type || !caseId) {
    return res.status(400).json({ error: 'Type and caseId are required.' });
  }
  
  logger.info(`[Feedback] Simple feedback received: ${type} for case ${caseId}`);
  
  // Store feedback in conversation state
  const sessionId = 'default_session'; // Keep using session for conversation state
  // But use the actual caseId for MongoDB updates
  if (conversationStates.has(sessionId)) {
    const state = conversationStates.get(sessionId)!;
    const feedbackId = `feedback_${Date.now()}`;
    state.messageFeedbacks = state.messageFeedbacks || {};
    state.messageFeedbacks[feedbackId] = {
      type: type === 'positive' ? 'positive' : 'negative',
      timestamp: new Date(timestamp),
      feedbackSource: 'simple_thumbs'
    };
    
    // Update RL reward based on feedback
    state.overallRlReward = (state.overallRlReward || 0) + (type === 'positive' ? 1 : -1);
    
    conversationStates.set(sessionId, state);
    
    // Also update the stored case in MongoDB
    try {
      console.log('[Server] Simple feedback - Attempting to update MongoDB case:', caseId);

      const mongoStorage = new MongoStorage(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017');
      await mongoStorage.connect();
      const memoryService = new MemoryService(mongoStorage);
      // Create feedback object for this specific case
      const feedbackForCase = {
        [`feedback_${Date.now()}`]: {
          type: type === 'positive' ? 'positive' : 'negative',
          timestamp: new Date(timestamp),
          feedbackSource: 'simple_thumbs'
        }
      };
      const rewardForCase = type === 'positive' ? 1 : -1;
      
      console.log('[Server] Simple feedback - About to call updateCaseWithFeedback with:', {
        caseId,
        feedback: feedbackForCase,
        reward: rewardForCase
      });
      const updateResult = await memoryService.updateCaseWithFeedback(caseId, feedbackForCase, rewardForCase);
      console.log('[Server] Simple feedback - MongoDB update result:', updateResult);
    } catch (error) {
      console.error('[Server] Simple feedback - Error updating case:', error);
    }
  }
  
  console.log('Simple feedback:', { type, caseId, timestamp });
  res.json({ success: true, message: 'Feedback received' });
});

// Detailed feedback endpoint (modal form)
server.post('/feedback/detailed', async (req: Request, res: Response) => {
  console.log('[FEEDBACK ENDPOINT] Detailed feedback endpoint called');
  console.log('[FEEDBACK ENDPOINT] Request body:', req.body);
  const { caseId, rating, freeformFeedback, reason, timestamp } = req.body;
  
  if (!caseId) {
    return res.status(400).json({ error: 'CaseId is required.' });
  }
  
  logger.info(`[Feedback] Detailed feedback received for case ${caseId}`);
  
  // Update the stored case in MongoDB directly
  try {
    console.log('[Server] Detailed feedback - Attempting to update MongoDB case:', caseId);


    const mongoStorage = new MongoStorage(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017');
    await mongoStorage.connect();
    const memoryService = new MemoryService(mongoStorage);
    
    // Create feedback object for this specific case
    const feedbackForCase = {
      [`feedback_${Date.now()}`]: {
        type: rating && parseInt(rating) >= 3 ? 'positive' : 'negative',
        rating: rating ? parseInt(rating) : undefined,
        comment: freeformFeedback,
        reason: reason ? parseInt(reason) : undefined,
        timestamp: new Date(timestamp),
        feedbackSource: 'detailed_modal'
      }
    };
    
    // Calculate RL reward based on rating
    let rewardForCase = 0;
    if (rating) {
      const ratingValue = parseInt(rating);
      rewardForCase = ratingValue - 3; // -2 to +2 based on 1-5 scale
    }
    
    console.log('[Server] Detailed feedback - About to call updateCaseWithFeedback with:', {
      caseId,
      feedback: feedbackForCase,
      reward: rewardForCase
    });
    const updateResult = await memoryService.updateCaseWithFeedback(caseId, feedbackForCase, rewardForCase);
    console.log('[Server] Detailed feedback - MongoDB update result:', updateResult);
  } catch (error) {
    console.error('[Server] Detailed feedback - Error updating case:', error);
  }
  
  console.log('Detailed feedback:', { caseId, rating, freeformFeedback, reason, timestamp });
  res.json({ success: true, message: 'Detailed feedback received' });
});

const conversationStates = new Map<string, AgentStateData>();
const feedbackStore = new Map<string, any[]>(); // Simple in-memory feedback storage

server.post('/chat', async (req: Request, res: Response) => {
  const sessionId: string = req.body.sessionId || 'default_session';
  const { userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: 'User query is required.' });
  }

  if (!app || typeof app !== 'object' || typeof app.invoke !== 'function') {
    logger.error('SERVER ERROR: The `app` object is not initialized or is invalid.', {
      appType: typeof app,
      appDefined: app !== undefined && app !== null,
      appHasInvoke: typeof app?.invoke === 'function',
    });
    return res
        .status(500)
        .json({ error: 'Agent service is not available. Please check server logs.' });
  }

  let currentAgentState: AgentStateData;

  if (conversationStates.has(sessionId)) {
    logger.info(`[Session: ${sessionId}] Loading existing state.`);
    currentAgentState = conversationStates.get(sessionId)!;

    currentAgentState.messages = currentAgentState.messages || [];
    currentAgentState.messages.push(generateNewHumanMessage(userQuery));

    currentAgentState.userQuery = userQuery;

    currentAgentState.finalSummary = undefined;
    currentAgentState.analysisResults = {};
    currentAgentState.runParallelAnalysis = false;
    currentAgentState.queryCategory = 'UNKNOWN_CATEGORY';
    currentAgentState.messageFeedbacks = {}; // Clear previous feedback for new query
    currentAgentState.overallRlReward = undefined; // Clear previous reward for new query
    

  } else {
    logger.info(`[Session: ${sessionId}] Initializing new state.`);
    currentAgentState = {
      messages: [new SystemMessage(PROMPT), generateNewHumanMessage(userQuery)],
      userQuery: userQuery,
      entityIds: [],
      entityType: 'unknown',
      environment: 'unknown',
      timeRange: undefined,
      datadogLogs: [],
      entityHistory: [],
      analysisResults: {},
      runParallelAnalysis: false,
      finalSummary: undefined,
      queryCategory: 'UNKNOWN_CATEGORY',
      messageFeedbacks: {},
      overallRlReward: undefined,
      currentEpisodeActions: [],
      rlFeatures: undefined,
      chosenRLAction: undefined,
      rlEpisodeId: sessionId,
      rlTrainingIteration: 1,
      overallFeedbackAttempts: 0,
    };
  }

  try {
    logger.info(`[Session: ${sessionId}] Invoking agent with current state...`);
    const finalState = await app.invoke(currentAgentState);
    logger.info(`[Session: ${sessionId}] Agent invocation complete.`);

    conversationStates.set(sessionId, finalState);
    logger.info(`[Session: ${sessionId}] State saved for next turn.`);

    let agentResponse: string = 'Agent finished without a clear summary.';

    if (finalState && finalState.finalSummary) {
      if (Array.isArray(finalState.finalSummary)) {
        const responseParts: string[] = [];
        for (const part of finalState.finalSummary) {
          if (part.type === 'text') {
            responseParts.push(part.text);
          } else if (part.type === 'tool_use') {
            logger.info(
                'DEBUG: Agent requested tool_use in finalSummary (not for user display):',
                JSON.stringify(part, null, 2),
            );
          }
        }
        agentResponse = responseParts.join('\n');
        logger.info('DEBUG: Using finalSummary (parsed from array): %s', agentResponse);
      } else if (typeof finalState.finalSummary === 'string') {
        agentResponse = finalState.finalSummary;
        logger.info('DEBUG: Using finalSummary (simple string): %s', agentResponse);
      } else {
        agentResponse = `[Agent finalSummary was unexpected type: ${typeof finalState.finalSummary}]`;
        console.warn(
            'WARN: finalSummary had unexpected type:',
            typeof finalState.finalSummary,
            finalState.finalSummary,
        );
      }
    } else if (finalState.messages && finalState.messages.length > 0) {
      const lastMsg = finalState.messages[finalState.messages.length - 1];
      if (lastMsg) {
        if (typeof lastMsg.content === 'object' && lastMsg.content !== null) {
          try {
            agentResponse = '```json\n' + JSON.stringify(lastMsg.content, null, 2) + '\n```';
            logger.info('DEBUG: Using last message (JSON content):', agentResponse);
          } catch (e: any) {
            agentResponse = `[Error: Could not stringify tool output content: ${e.message}]`;
            logger.error('ERROR: Failed to stringify last message content:', e);
          }
        } else if (typeof lastMsg.content === 'string') {
          agentResponse = lastMsg.content;
          logger.info('DEBUG: Using last message (string content):', agentResponse);
        } else {
          agentResponse = `[Agent response content from last message was unexpected type: ${typeof lastMsg.content}]`;
          console.warn(
              'WARN: Last message content had unexpected type:',
              typeof lastMsg.content,
              lastMsg.content,
          );
        }
      } else {
        agentResponse = 'Agent finished, but no response message found.';
        console.warn('WARN: Final state messages array was empty or last message was undefined.');
      }
    } else {
      agentResponse = 'Agent finished, but no final summary or messages to respond with.';
      console.warn('WARN: Final state had no finalSummary and no messages.');
    }

    // Check if this is a clarification response (no case stored yet)
    const isClairificationResponse = !finalState.generatedCaseId;
    
    if (isClairificationResponse) {
      console.log('[Server] Clarification response - not returning caseId to hide feedback UI');
      return res.json({ 
        response: agentResponse
      });
    }
    
    const caseIdToReturn = finalState.generatedCaseId || `case_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('[Server] Returning case ID to frontend:', caseIdToReturn);
    console.log('[Server] finalState.generatedCaseId:', finalState.generatedCaseId);
    
    return res.json({ 
      response: agentResponse,
      caseId: caseIdToReturn
    });
  } catch (error) {
    logger.error(`[Session: ${sessionId}] ERROR during agent invocation:`, error);

    let errorDetails: any = {
      message: 'An unknown error occurred.',
      type: 'UnknownError',
    };

    if (error instanceof Error) {
      errorDetails.message = error.message;
      errorDetails.type = error.name; // e.g., 'Error', 'TypeError', 'ZodError'
      errorDetails.stack = error.stack; // Capture stack trace for server logs

      if (error instanceof ZodError) {
        errorDetails.type = 'SchemaValidationError';
        errorDetails.zodIssues = error.issues; // Array of validation issues
        errorDetails.toolInput = (error as any).cause?.toolInput; // If available, some LangChain errors wrap this
        errorDetails.parsedInput = (error as any).cause?.parsedInput; // Or the parsed input that failed
        logger.error(`[Session: ${sessionId}] ZodError details:`, safeJsonStringify(error.issues, 2));
      } else if (typeof (error as any).toolInput !== 'undefined') {
        // Catch other LangChain-specific errors that might include toolInput
        errorDetails.toolInput = (error as any).toolInput;
        logger.error(`[Session: ${sessionId}] Tool invocation error with input:`, safeJsonStringify((error as any).toolInput, 2));
      }

      // If the error object itself is large or complex, log it fully for debugging
      // but only send specific details to the user.
      logger.error(`[Session: ${sessionId}] Full error object:`, safeJsonStringify(error, 2));

    } else if (typeof error === 'object' && error !== null) {
      // If error is an object but not an Error instance
      errorDetails.message = (error as any).message || JSON.stringify(error);
      errorDetails.type = (error as any).name || 'NonStandardErrorObject';
      logger.error(`[Session: ${sessionId}] Non-standard error object:`, safeJsonStringify(error, 2));
    } else {
      // Primitive error types (string, number, etc.)
      errorDetails.message = String(error);
      errorDetails.type = 'PrimitiveError';
      logger.error(`[Session: ${sessionId}] Primitive error value:`, error);
    }

    // Prepare a user-friendly error response
    const userFacingError = {
      error: 'An internal server error occurred while processing your request.',
      details: errorDetails.message, // Provide the main error message to the user
      // Optionally, expose more details to the user for specific error types,
      // but be cautious about sensitive info.
      // For ZodErrors, you might tell the user about invalid parameters.
      validationErrors: errorDetails.zodIssues ? errorDetails.zodIssues.map((issue: any) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })) : undefined,
    };

    return res
        .status(500)
        .json(userFacingError);
  }
});

// --- Server Startup Logic with Token Initialization ---
async function startServer() {
  try {
    // Load the symmetric key from the JWK string
    await loadSymmetricKey();
    logger.info('JWT symmetric key loaded and ready for signing.');

    // Initialize the TokenService
    TokenService.initializeInstance();
    logger.info('TokenService initialized.');

    // Get the initial token immediately upon startup.
    // This will generate the first JWT and store it in memory.
    // You can add any default claims that your service needs for its JWTs.
    await TokenService.getInstance().getValidToken({
      sub: 'genie-ai-agent-service', // Subject for this service's token
      // Example: If your Scala app uses a 'clientId' claim for service identification
      // clientId: 'genie-agent-backend',
      // Example: If your tokens need specific roles or scopes
      // roles: ['agent', 'read:all', 'write:some']
    });
    logger.info('Initial JWT token generated for Genie services.');

    // Start listening for HTTP requests only after token is successfully obtained
    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Chat endpoint: POST http://localhost:${PORT}/chat`);
      logger.info(`Health check endpoint: GET http://localhost:${PORT}/health`);
      logger.info(`Static files served from: ${path.join(__dirname, '..', 'public')}`);
      logger.info(`Access your index.html at: http://localhost:${PORT}/index.html`);
    });
  } catch (error) {
    logger.error('CRITICAL ERROR: Failed to start server due to JWT setup failure:', error);
    process.exit(1); // Exit the process if we can't get a token, as the app won't function
  }
}

// Call the function to start the server
startServer();
