import 'dotenv/config';
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { SystemMessage } from '@langchain/core/messages';
import { app } from './workflow';
import { AgentStateData } from './model';
import { PROMPT } from './constants';
import path from 'path';
import { logger, generateNewHumanMessage } from './utils';

let TokenService: any;
let loadSymmetricKey: any;

if (process.env.CAPTURE_API_RESPONSES === 'true') {

  const cryptoAuth = require('./utils/auth/cryptoAuth');
  TokenService = cryptoAuth.TokenService;
  loadSymmetricKey = cryptoAuth.loadSymmetricKey;
} else {

  const originalAuth = require('./utils/auth/TokenService');
  const jwtSecret = require('./utils/auth/jwtSecret');
  TokenService = originalAuth.TokenService;
  loadSymmetricKey = jwtSecret.loadSymmetricKey;
}
import { ZodError} from "zod";
import { safeJsonStringify} from "./utils";

import {MemoryService} from "./storage/memoryService";

import {MongoStorage} from "./storage/mongodb";


TokenService.initializeInstance();

const server = express();
const PORT = process.env.PORT || 3000;

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


server.post('/feedback', async (req: Request, res: Response) => {
  console.log('[FEEDBACK ENDPOINT] Simple feedback endpoint called');
  console.log('[FEEDBACK ENDPOINT] Request body:', req.body);
  const { type, caseId, timestamp } = req.body;
  
  if (!type || !caseId) {
    return res.status(400).json({ error: 'Type and caseId are required.' });
  }
  
  logger.info(`[Feedback] Simple feedback received: ${type} for case ${caseId}`);
  

  const sessionId = 'default_session';

  if (conversationStates.has(sessionId)) {
    const state = conversationStates.get(sessionId)!;
    const feedbackId = `feedback_${Date.now()}`;
    state.messageFeedbacks = state.messageFeedbacks || {};
    state.messageFeedbacks[feedbackId] = {
      type: type === 'positive' ? 'positive' : 'negative',
      timestamp: new Date(timestamp),
      feedbackSource: 'simple_thumbs'
    };
    

    state.overallRlReward = (state.overallRlReward || 0) + (type === 'positive' ? 1 : -1);
    
    conversationStates.set(sessionId, state);
    

    try {
      console.log('[Server] Simple feedback - Attempting to update MongoDB case:', caseId);

      const mongoStorage = new MongoStorage(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017');
      await mongoStorage.connect();
      const memoryService = new MemoryService(mongoStorage);

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


server.post('/feedback/detailed', async (req: Request, res: Response) => {
  console.log('[FEEDBACK ENDPOINT] Detailed feedback endpoint called');
  console.log('[FEEDBACK ENDPOINT] Request body:', req.body);
  const { caseId, rating, freeformFeedback, reason, timestamp } = req.body;
  
  if (!caseId) {
    return res.status(400).json({ error: 'CaseId is required.' });
  }
  
  logger.info(`[Feedback] Detailed feedback received for case ${caseId}`);
  

  try {
    console.log('[Server] Detailed feedback - Attempting to update MongoDB case:', caseId);


    const mongoStorage = new MongoStorage(process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017');
    await mongoStorage.connect();
    const memoryService = new MemoryService(mongoStorage);
    

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
    

    let rewardForCase = 0;
    if (rating) {
      const ratingValue = parseInt(rating);
      rewardForCase = ratingValue - 3;
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
const feedbackStore = new Map<string, any[]>();

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
    currentAgentState.messageFeedbacks = {};
    currentAgentState.overallRlReward = undefined;
    

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
      errorDetails.type = error.name;
      errorDetails.stack = error.stack;

      if (error instanceof ZodError) {
        errorDetails.type = 'SchemaValidationError';
        errorDetails.zodIssues = error.issues;
        errorDetails.toolInput = (error as any).cause?.toolInput;
        errorDetails.parsedInput = (error as any).cause?.parsedInput;
        try {
          const issuesString = safeJsonStringify(error.issues, 2);
          logger.error(`[Session: ${sessionId}] ZodError details: ${issuesString}`);
        } catch (stringifyError) {
          logger.error(`[Session: ${sessionId}] Failed to stringify ZodError issues:`, stringifyError instanceof Error ? stringifyError.message : String(stringifyError));
        }
      } else if (typeof (error as any).toolInput !== 'undefined') {

        errorDetails.toolInput = (error as any).toolInput;
        try {
          const toolInputString = safeJsonStringify((error as any).toolInput, 2);
          logger.error(`[Session: ${sessionId}] Tool invocation error with input: ${toolInputString}`);
        } catch (stringifyError) {
          logger.error(`[Session: ${sessionId}] Failed to stringify tool input:`, stringifyError instanceof Error ? stringifyError.message : String(stringifyError));
        }
      }


      logger.error(`[Session: ${sessionId}] Full error object - Type: ${typeof error}, Constructor: ${error?.constructor?.name}`);
      if (typeof error === 'string') {
        const errorStr = error as string;
        const truncated = errorStr.length > 1000 ? errorStr.substring(0, 1000) + '... [truncated]' : errorStr;
        logger.error(`[Session: ${sessionId}] Error string: ${truncated}`);
      } else {
        try {
          const errorString = safeJsonStringify(error, 2);
          const maxLogSize = 5000;
          const truncatedError = errorString.length > maxLogSize 
            ? errorString.substring(0, maxLogSize) + '... [truncated]'
            : errorString;
          logger.error(`[Session: ${sessionId}] Error details: ${truncatedError}`);
        } catch (stringifyError) {
          logger.error(`[Session: ${sessionId}] Failed to stringify error - using fallback`);
        }
      }

    } else if (typeof error === 'object' && error !== null) {

      errorDetails.message = (error as any).message || JSON.stringify(error);
      errorDetails.type = (error as any).name || 'NonStandardErrorObject';
      logger.error(`[Session: ${sessionId}] Non-standard error - Type: ${typeof error}`);
      try {
        const errorString = safeJsonStringify(error, 2);
        const maxLogSize = 5000;
        const truncatedError = errorString.length > maxLogSize 
          ? errorString.substring(0, maxLogSize) + '... [truncated]'
          : errorString;
        logger.error(`[Session: ${sessionId}] Error details: ${truncatedError}`);
      } catch (stringifyError) {
        logger.error(`[Session: ${sessionId}] Failed to stringify non-standard error - using fallback`);
      }
    } else {

      errorDetails.message = String(error);
      errorDetails.type = 'PrimitiveError';
      logger.error(`[Session: ${sessionId}] Primitive error value:`, error);
    }


    const userFacingError = {
      error: 'An internal server error occurred while processing your request.',
      details: errorDetails.message,



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


async function startServer() {
  try {

    await loadSymmetricKey();
    logger.info('JWT symmetric key loaded and ready for signing.');


    if (process.env.CAPTURE_API_RESPONSES === 'true') {
      await TokenService.getInstance().getValidToken();
    } else {
      await TokenService.getInstance().getValidToken({
        sub: 'genie-ai-agent-service'
      });
    }
    logger.info('Initial JWT token generated for Genie services.');


    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Chat endpoint: POST http://localhost:${PORT}/chat`);
      logger.info(`Health check endpoint: GET http://localhost:${PORT}/health`);
      logger.info(`Static files served from: ${path.join(__dirname, '..', 'public')}`);
      logger.info(`Access your index.html at: http://localhost:${PORT}/index.html`);
    });
  } catch (error) {
    logger.error('CRITICAL ERROR: Failed to start server due to JWT setup failure:', error);
    process.exit(1);
  }
}


startServer();
