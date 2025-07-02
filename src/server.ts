// src/server.ts

import express from 'express';
import bodyParser from 'body-parser';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { app } from './workflow';
import { AgentState } from './model/agentState';
import { PROMPT } from './constants';

const server = express();
const PORT = 3000;

server.use(bodyParser.json());

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

server.post('/chat', async (req, res) => {
  const { userQuery } = req.body;

  if (!userQuery) {
    return res.status(400).json({ error: 'User query is required.' });
  }

  if (!app || typeof app !== 'object' || typeof app.invoke !== 'function') {
    console.error('The `app` object is not initialized or is invalid.');
    return res.status(500).json({ error: 'Agent service is not available.' });
  }

  try {
    const initialState: AgentState = {
      messages: [new SystemMessage(PROMPT), new HumanMessage(userQuery)],
      entityIds: [],
      entityType: 'unknown',
      timeRange: '1h',
      datadogLogs: [],
      analysisResults: {},
      runParallelAnalysis: false,
      finalSummary: undefined,
    };

    console.log(`Invoking agent with query: "${userQuery}"`);
    const finalState = await app.invoke(initialState);
    console.log('Agent invocation complete.');

    let agentResponse: string = 'Agent finished without a clear summary.';

    if (finalState) {
      // --- DEBUGGING LOGS ---
      console.log('DEBUG: finalState received from agent:', JSON.stringify(finalState, null, 2));
      console.log('DEBUG: finalState.messages type:', typeof finalState.messages);
      console.log('DEBUG: finalState.messages content:', finalState.messages);

      if (finalState.finalSummary) {
        agentResponse = finalState.finalSummary;
        console.log('DEBUG: Using finalSummary:', agentResponse);
      } else if (finalState.messages && finalState.messages.length > 0) {
        const lastMsg = finalState.messages[finalState.messages.length - 1];
        console.log('DEBUG: lastMsg object:', lastMsg);
        console.log('DEBUG: lastMsg type:', typeof lastMsg);
        console.log('DEBUG: lastMsg content:', lastMsg?.content);
        console.log('DEBUG: lastMsg content type:', typeof lastMsg?.content);

        // --- NEW: Handle cases where lastMsg.content might be an object ---
        if (typeof lastMsg?.content === 'object' && lastMsg.content !== null) {
          try {
            // Attempt to stringify the object content, e.g., for ToolMessage outputs
            agentResponse = '```json\n' + JSON.stringify(lastMsg.content, null, 2) + '\n```'; // Format as Markdown code block
            console.log('DEBUG: lastMsg.content was object, stringified to:', agentResponse);
          } catch (e) {
            agentResponse = `[Error: Could not stringify tool output content: ${e.message}]`;
            console.error('ERROR: Failed to JSON.stringify lastMsg.content:', e);
          }
        } else if (typeof lastMsg?.content === 'string') {
          agentResponse = lastMsg.content;
          console.log('DEBUG: lastMsg.content was string:', agentResponse);
        } else {
          // Fallback for unexpected content types
          agentResponse = `[Agent response content was unexpected type: ${typeof lastMsg?.content}]`;
          console.warn('WARN: Unexpected type for lastMsg.content:', typeof lastMsg?.content);
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
});
