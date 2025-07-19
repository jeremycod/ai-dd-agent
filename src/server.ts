// server.ts

import 'dotenv/config'; // Keep this at the very top to load environment variables first
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { app } from './workflow'; // Assuming 'app' is your Langchain agent graph
import { AgentStateData } from './model/agentState';
import { PROMPT } from './constants';
import path from 'path';

// --- Import Token Service related parts ---
import { TokenService } from './utils/auth/TokenService'; // Adjust path
import { loadSymmetricKey } from './utils/auth/jwtSecret';
import {generateNewHumanMessage} from "./utils/auth/helpers"; // Adjust path

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

const conversationStates = new Map<string, AgentStateData>(); // Maps sessionId -> AgentState

server.post('/chat', async (req: Request, res: Response) => {
  const sessionId: string = req.body.sessionId || 'default_session';
  const { userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: 'User query is required.' });
  }

  if (!app || typeof app !== 'object' || typeof app.invoke !== 'function') {
    console.error('SERVER ERROR: The `app` object is not initialized or is invalid.', {
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
    console.log(`[Session: ${sessionId}] Loading existing state.`);
    currentAgentState = conversationStates.get(sessionId)!;

    currentAgentState.messages = currentAgentState.messages || [];
    currentAgentState.messages.push(generateNewHumanMessage(userQuery));

    currentAgentState.userQuery = userQuery;

    currentAgentState.finalSummary = undefined;
    currentAgentState.analysisResults = {};
    currentAgentState.runParallelAnalysis = false;
    currentAgentState.queryCategory = 'UNKNOWN_CATEGORY';
  } else {
    console.log(`[Session: ${sessionId}] Initializing new state.`);
    currentAgentState = {
      messages: [new SystemMessage(PROMPT), generateNewHumanMessage(userQuery)],
      userQuery: userQuery,
      entityIds: [],
      entityType: 'unknown',
      environment: 'unknown',
      timeRange: '24h',
      datadogLogs: [],
      entityHistory: [],
      analysisResults: {},
      runParallelAnalysis: false,
      finalSummary: undefined,
      queryCategory: 'UNKNOWN_CATEGORY',
      // Ensure callerClientId is set if it's dynamic, otherwise set it globally below
      // callerClientId: 'your-dynamic-client-id-for-this-session',

      // --- Initialize the new fields added to AgentStateData ---
      messageFeedbacks: {}, // Initialize as an empty object (no feedback yet)
      overallRlReward: undefined, // Or 0, depending on your default
      currentEpisodeActions: [], // Initialize as an empty array
      rlFeatures: undefined, // Or {}, depending on your default structure
      chosenRLAction: undefined,
      rlEpisodeId: sessionId, // Often the same as your session ID
      rlTrainingIteration: 1, // Start at 1 for the first episode
      overallFeedbackAttempts: 0,
    };
  }

  try {
    console.log(`[Session: ${sessionId}] Invoking agent with current state...`);
    const finalState = await app.invoke(currentAgentState);
    console.log(`[Session: ${sessionId}] Agent invocation complete.`);

    conversationStates.set(sessionId, finalState);
    console.log(`[Session: ${sessionId}] State saved for next turn.`);

    let agentResponse: string = 'Agent finished without a clear summary.';

    if (finalState && finalState.finalSummary) {
      if (Array.isArray(finalState.finalSummary)) {
        const responseParts: string[] = [];
        for (const part of finalState.finalSummary) {
          if (part.type === 'text') {
            responseParts.push(part.text);
          } else if (part.type === 'tool_use') {
            console.log(
              'DEBUG: Agent requested tool_use in finalSummary (not for user display):',
              JSON.stringify(part, null, 2),
            );
          }
        }
        agentResponse = responseParts.join('\n');
        console.log('DEBUG: Using finalSummary (parsed from array):', agentResponse);
      } else if (typeof finalState.finalSummary === 'string') {
        agentResponse = finalState.finalSummary;
        console.log('DEBUG: Using finalSummary (simple string):', agentResponse);
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
            console.log('DEBUG: Using last message (JSON content):', agentResponse);
          } catch (e: any) {
            agentResponse = `[Error: Could not stringify tool output content: ${e.message}]`;
            console.error('ERROR: Failed to stringify last message content:', e);
          }
        } else if (typeof lastMsg.content === 'string') {
          agentResponse = lastMsg.content;
          console.log('DEBUG: Using last message (string content):', agentResponse);
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

    return res.json({ response: agentResponse });
  } catch (error) {
    console.error(`[Session: ${sessionId}] ERROR during agent invocation:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res
      .status(500)
      .json({ error: 'An error occurred while processing your request.', details: errorMessage });
  }
});

// --- Server Startup Logic with Token Initialization ---
async function startServer() {
  try {
    // Load the symmetric key from the JWK string
    await loadSymmetricKey();
    console.log('JWT symmetric key loaded and ready for signing.');

    // Initialize the TokenService
    TokenService.initializeInstance();
    console.log('TokenService initialized.');

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
    console.log('Initial JWT token generated for Genie services.');

    // Start listening for HTTP requests only after token is successfully obtained
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Chat endpoint: POST http://localhost:${PORT}/chat`);
      console.log(`Health check endpoint: GET http://localhost:${PORT}/health`);
      console.log(`Static files served from: ${path.join(__dirname, '..', 'public')}`);
      console.log(`Access your index.html at: http://localhost:${PORT}/index.html`);
    });
  } catch (error) {
    console.error('CRITICAL ERROR: Failed to start server due to JWT setup failure:', error);
    process.exit(1); // Exit the process if we can't get a token, as the app won't function
  }
}

// Call the function to start the server
startServer();
