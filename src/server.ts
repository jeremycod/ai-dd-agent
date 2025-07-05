// src/server.ts

import express from 'express';
import bodyParser from 'body-parser';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { app } from './workflow';
import { AgentState } from './model/agentState';
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
const conversationStates = new Map<string, AgentState>(); // Maps sessionId -> AgentState

server.post('/chat', async (req, res) => {
  const sessionId: string = req.body.sessionId || 'default_session';
  const { userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: 'User query is required.' });
  }

  if (!app || typeof app !== 'object' || typeof app.invoke !== 'function') {
    console.error('The `app` object is not initialized or is invalid.');
    return res.status(500).json({ error: 'Agent service is not available.' });
  }
  let currentAgentState: AgentState;
  // --- STEP 1: Load Existing State or Initialize New ---
  if (conversationStates.has(sessionId)) {
    console.log(`[Session: ${sessionId}] Loading existing state.`);
    currentAgentState = conversationStates.get(sessionId)!;
    // Append the new user message to the existing message history
    currentAgentState.messages.push(new HumanMessage(userQuery));
    // Reset temporary fields that shouldn't persist across turns if they are not meant to
    // For example, if `analysisResults` or `finalSummary` are only for a single response cycle.
    currentAgentState.finalSummary = undefined; // Clear previous summary
    // Other fields like entityIds, entityType, environment should remain if not overwritten by parseUserQuery
  } else {
    console.log(`[Session: ${sessionId}] Initializing new state.`);
    // First turn for this session: Start with the SystemMessage and the user's first query
    currentAgentState = {
      messages: [new SystemMessage(PROMPT), new HumanMessage(userQuery)],
      entityIds: [],
      entityType: 'unknown',
      environment: 'unknown', // Default to unknown
      timeRange: '24h', // Default time range
      datadogLogs: [],
      entityHistory: [],
      analysisResults: {},
      runParallelAnalysis: false,
      finalSummary: undefined,
    };
  }

  try {
    console.log(`[Session: ${sessionId}] Invoking agent with current state...`);
    // Pass the potentially loaded and updated state to the LangGraph
    const finalState = await app.invoke(currentAgentState);
    console.log(`[Session: ${sessionId}] Agent invocation complete.`);

    // --- STEP 2: Save the Final State for the Next Turn ---
    conversationStates.set(sessionId, finalState);
    console.log(`[Session: ${sessionId}] State saved for next turn.`);

    let agentResponse: string = 'Agent finished without a clear summary.';

    if (finalState) {
      // --- DEBUGGING LOGS ---
      console.log('DEBUG: finalState received from agent:', JSON.stringify(finalState, null, 2));
      console.log('DEBUG: finalState.messages type:', typeof finalState.messages);
      console.log('DEBUG: finalState.messages content:', finalState.messages);

      if (finalState.finalSummary && Array.isArray(finalState.finalSummary)) {
        // Initialize an array to hold all parts of the response
        const responseParts: string[] = [];

        // Iterate through the array of content parts
        for (const part of finalState.finalSummary) {
          if (part.type === 'text') {
            responseParts.push(part.text);
          } else if (part.type === 'tool_use') {
            // You generally don't want to show raw tool_use objects to the user.
            // Instead, you might log it, or decide if this means a follow-up action.
            // For a user-facing response, you'd usually only include text.
            // For debugging, you could stringify it:
            console.log(
              'DEBUG: Agent requested tool_use in finalSummary:',
              JSON.stringify(part, null, 2),
            );
            // You could also add a user-friendly message about the tool being called
            // responseParts.push(`(Agent is using tool: ${part.name})`);
          }
          // Add other types if your schema supports them (e.g., 'image_url')
        }

        // Join all text parts to form the final agent response
        agentResponse = responseParts.join('\n'); // Join with newlines for readability

        console.log('DEBUG: Using finalSummary (parsed):', agentResponse);

        // If the finalSummary contained a tool_use, your agent might still be in an intermediate step.
        // Consider if this means you need to run the graph again with the tool output.
        // For now, we'll just extract the text for the user.
      } else if (finalState.messages && finalState.messages.length > 0) {
        // Your existing fallback logic if finalSummary is not set or not an array
        const lastMsg = finalState.messages[finalState.messages.length - 1];
        // ... (rest of your existing logic for lastMsg.content) ...
        if (typeof lastMsg?.content === 'object' && lastMsg.content !== null) {
          try {
            agentResponse = '```json\n' + JSON.stringify(lastMsg.content, null, 2) + '\n```';
          } catch (e: any) {
            agentResponse = `[Error: Could not stringify tool output content: ${e.message}]`;
          }
        } else if (typeof lastMsg?.content === 'string') {
          agentResponse = lastMsg.content;
        } else {
          agentResponse = `[Agent response content was unexpected type: ${typeof lastMsg?.content}]`;
        }
      }
    }

    // Remove the specific HTML formatting example from earlier, as the agent
    // is now expected to provide Markdown.
    // if (agentResponse.includes("Based on the analysis, here's a summary of the issues found:")) {
    //     formattedAgentResponse = `...`; // REMOVE OR COMMENT OUT THIS BLOCK
    // }

    res.json({ response: agentResponse });
  } catch (error) {
    console.error('Error invoking agent:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Chat endpoint: POST http://localhost:${PORT}/chat`);
  console.log(`Health check endpoint: GET http://localhost:${PORT}/health`);
  console.log(`Static files served from: ${path.join(__dirname, '..', 'public')}`);
  console.log(`Access your index.html at: http://localhost:${PORT}/index.html`);
});
