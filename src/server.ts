// src/server.ts
import express, { Request, Response } from 'express';

import bodyParser from 'body-parser';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { app } from './workflow';
import { AgentStateData } from './model/agentState';
import { PROMPT } from './constants';
import path from 'path';

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
// --- In-memory store for states (FOR DEMO/TESTING ONLY - USE PERSISTENT STORAGE IN PRODUCTION) ---
// In production, replace this with a database (e.g., MongoDB, PostgreSQL, Redis)
// where you store the AgentState object serialized as JSON.
const conversationStates = new Map<string, AgentStateData>(); // Maps sessionId -> AgentState

server.post('/chat', async (req: Request, res: Response) => {
  const sessionId: string = req.body.sessionId || 'default_session';
  const { userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: 'User query is required.' });
  }

  // --- Crucial Debugging Step: Verify `app` before use ---
  if (!app || typeof app !== 'object' || typeof app.invoke !== 'function') {
    console.error('SERVER ERROR: The `app` object is not initialized or is invalid.', {
      appType: typeof app,
      appDefined: app !== undefined && app !== null,
      appHasInvoke: typeof app?.invoke === 'function'
    });
    return res.status(500).json({ error: 'Agent service is not available. Please check server logs.' });
  }

  let currentAgentState: AgentStateData;

  // --- STEP 1: Load Existing State or Initialize New ---
  if (conversationStates.has(sessionId)) {
    console.log(`[Session: ${sessionId}] Loading existing state.`);
    currentAgentState = conversationStates.get(sessionId)!; // Type assertion: we trust .has()

    // Ensure messages array exists before pushing (defensive programming)
    currentAgentState.messages = currentAgentState.messages || [];
    currentAgentState.messages.push(new HumanMessage(userQuery));

    // Update the userQuery for the current turn
    currentAgentState.userQuery = userQuery;

    // Reset relevant temporary fields for a new turn
    currentAgentState.finalSummary = undefined;
    currentAgentState.analysisResults = {}; // Clear previous analysis
    currentAgentState.runParallelAnalysis = false; // Reset flag
    currentAgentState.queryCategory = 'UNKNOWN_CATEGORY'; // Reset category for re-parsing if needed

    // console.log(`[Session: ${sessionId}] State after update from map:`, JSON.stringify(currentAgentState, null, 2)); // DEBUG
  } else {
    console.log(`[Session: ${sessionId}] Initializing new state.`);
    // First turn for this session: Start with SystemMessage and user's first query
    currentAgentState = {
      messages: [new SystemMessage(PROMPT), new HumanMessage(userQuery)],
      userQuery: userQuery, // Correctly setting userQuery for the first turn
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
    };
    // console.log(`[Session: ${sessionId}] Newly initialized state:`, JSON.stringify(currentAgentState, null, 2)); // DEBUG
  }

  // --- Crucial Debugging Step: Log state *immediately before* invoking LangGraph ---
  console.log(`[Session: ${sessionId}] State PASSED TO app.invoke():`, JSON.stringify(currentAgentState, null, 2));
  console.log(`[Session: ${sessionId}] Type of messages array before invoke: ${typeof currentAgentState.messages}`);
  console.log(`[Session: ${sessionId}] Messages array length before invoke: ${currentAgentState.messages?.length}`);


  try {
    console.log(`[Session: ${sessionId}] Invoking agent with current state...`);
    const finalState = await app.invoke(currentAgentState); // This line is the key interaction
    console.log(`[Session: ${sessionId}] Agent invocation complete.`);

    // --- STEP 2: Save the Final State for the Next Turn ---
    // Make sure the state saved for the next turn is the one returned by LangGraph
    conversationStates.set(sessionId, finalState);
    console.log(`[Session: ${sessionId}] State saved for next turn.`);

    let agentResponse: string = 'Agent finished without a clear summary.';

    // --- Debugging Final State ---
    console.log('DEBUG: finalState received from agent (after invoke):', JSON.stringify(finalState, null, 2));
    console.log('DEBUG: finalState.messages type (after invoke):', typeof finalState.messages);
    console.log('DEBUG: finalState.messages content (after invoke):', finalState.messages);
    console.log('DEBUG: finalState.userQuery (after invoke):', finalState.userQuery);


    // --- Response Generation Logic ---
    if (finalState && finalState.finalSummary) {
      if (Array.isArray(finalState.finalSummary)) {
        const responseParts: string[] = [];
        for (const part of finalState.finalSummary) {
          if (part.type === 'text') {
            responseParts.push(part.text);
          } else if (part.type === 'tool_use') {
            console.log('DEBUG: Agent requested tool_use in finalSummary (not for user display):', JSON.stringify(part, null, 2));
            // You might add a placeholder like "The agent decided to use a tool to get more information."
            // if you want to indicate this to the user, but usually tool_use is internal.
            // If the graph is configured to END after tool_use, this is expected.
          }
        }
        agentResponse = responseParts.join('\n');
        console.log('DEBUG: Using finalSummary (parsed from array):', agentResponse);
      } else if (typeof finalState.finalSummary === 'string') { // If finalSummary is a simple string
        agentResponse = finalState.finalSummary;
        console.log('DEBUG: Using finalSummary (simple string):', agentResponse);
      } else { // Handle other unexpected types for finalSummary
        agentResponse = `[Agent finalSummary was unexpected type: ${typeof finalState.finalSummary}]`;
        console.warn('WARN: finalSummary had unexpected type:', typeof finalState.finalSummary, finalState.finalSummary);
      }
    } else if (finalState.messages && finalState.messages.length > 0) {
      // Fallback to the last message if finalSummary is not present
      const lastMsg = finalState.messages[finalState.messages.length - 1];
      if (lastMsg) {
        if (typeof lastMsg.content === 'object' && lastMsg.content !== null) {
          // This typically happens with tool outputs.
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
          console.warn('WARN: Last message content had unexpected type:', typeof lastMsg.content, lastMsg.content);
        }
      } else {
        agentResponse = 'Agent finished, but no response message found.';
        console.warn('WARN: Final state messages array was empty or last message was undefined.');
      }
    } else {
      agentResponse = 'Agent finished, but no final summary or messages to respond with.';
      console.warn('WARN: Final state had no finalSummary and no messages.');
    }

    return res.json({ response: agentResponse }); // Use return res.json to avoid multiple headers set

  } catch (error) {
    console.error(`[Session: ${sessionId}] ERROR during agent invocation:`, error);
    // Be more specific with error details in development, less in production
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'An error occurred while processing your request.', details: errorMessage });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Chat endpoint: POST http://localhost:${PORT}/chat`);
  console.log(`Health check endpoint: GET http://localhost:${PORT}/health`);
  console.log(`Static files served from: ${path.join(__dirname, '..', 'public')}`);
  console.log(`Access your index.html at: http://localhost:${PORT}/index.html`);
});
