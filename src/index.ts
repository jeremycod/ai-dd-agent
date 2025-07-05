import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { app } from './workflow'; // Assuming 'app' is your compiled LangGraph workflow
import { PROMPT } from './constants';
import { AgentState } from './model/agentState'; // Assuming AgentState is defined here

// --- Example Usage ---
(async () => {
  // Define a map to simulate conversation states (for multi-turn testing)
  // In a real application, this would be persistent storage.
  const conversationStates = new Map<string, AgentState>();

  // Helper function to simulate a chat turn
  async function simulateChatTurn(sessionId: string, userQuery: string) {
    console.log(`\n--- [Session: ${sessionId}] User Query: "${userQuery}" ---`);

    if (!app || typeof app !== 'object' || typeof app.invoke !== 'function') {
      throw new Error('The `app` object is not initialized or is invalid, or `invoke` method is missing.');
    }

    let currentAgentState: AgentState;

    // --- STEP 1: Load Existing State or Initialize New ---
    if (conversationStates.has(sessionId)) {
      console.log(`[Session: ${sessionId}] Loading existing state.`);
      currentAgentState = conversationStates.get(sessionId)!;
      // Append the new user message to the existing message history
      currentAgentState.messages.push(new HumanMessage(userQuery));
      // Reset temporary fields that shouldn't persist across turns if they are not meant to
      currentAgentState.finalSummary = undefined; // Clear previous summary
      currentAgentState.analysisResults = {}; // Clear previous analysis results
      // Preserve entityIds, entityType, environment, etc., unless parseUserQuery explicitly overwrites
    } else {
      console.log(`[Session: ${sessionId}] Initializing new state.`);
      // First turn for this session: Start with the SystemMessage and the user's first query
      currentAgentState = {
        messages: [new SystemMessage(PROMPT), new HumanMessage(userQuery)],
        entityIds: [], // Will be populated by parseUserQuery
        entityType: 'unknown', // Default, will be populated by parseUserQuery
        environment: 'unknown', // Default to unknown
        timeRange: '24h', // Default time range
        datadogLogs: [],
        entityHistory: [],
        analysisResults: {},
        runParallelAnalysis: false, // Will be set to true if IDs are found
        finalSummary: undefined,
      };
    }

    try {
      console.log(`[Session: ${sessionId}] Invoking agent with current state...`);
      const finalState = await app.invoke(currentAgentState);
      console.log(`[Session: ${sessionId}] Agent invocation complete.`);

      // --- STEP 2: Save the Final State for the Next Turn ---
      conversationStates.set(sessionId, finalState);
      console.log(`[Session: ${sessionId}] State saved for next turn.`);

      let agentResponse: string = 'Agent finished without a clear summary.';

      if (finalState) {
        console.log('DEBUG: finalState received from agent:', JSON.stringify(finalState, null, 2));

        if (finalState.finalSummary) {
          // Check if finalSummary is an array (Anthropic's content format with tool_use or text parts)
          if (Array.isArray(finalState.finalSummary)) {
            const responseParts: string[] = [];
            for (const part of finalState.finalSummary) {
              if (part.type === 'text') {
                responseParts.push(part.text);
              } else if (part.type === 'tool_use') {
                console.warn(
                    `[Session: ${sessionId}] DEBUG: Agent requested tool_use in finalSummary:`,
                    JSON.stringify(part, null, 2),
                );
                // In a non-server context, this means the graph might not have reached a "finish" point for a textual response.
                // It suggests the LLM in summarizeFindings is still outputting tool calls.
                // Add a placeholder for the user for this example.
                responseParts.push(`(Agent intends to use tool: ${part.name} with input ${JSON.stringify(part.input)})`);
              }
            }
            agentResponse = responseParts.join('\n');
            console.log(`[Session: ${sessionId}] DEBUG: Using finalSummary (parsed):`, agentResponse);
          } else if (typeof finalState.finalSummary === 'string') {
            // This is the ideal scenario for the final, human-readable summary
            agentResponse = finalState.finalSummary;
            console.log(`[Session: ${sessionId}] DEBUG: Using finalSummary (string):`, agentResponse);
          } else {
            console.warn(
                `[Session: ${sessionId}] WARNING: finalSummary had unexpected type:`,
                typeof finalState.finalSummary,
            );
            agentResponse = `[Agent response content was unexpected type in finalSummary]`;
          }
        } else if (finalState.messages && finalState.messages.length > 0) {
          // Fallback if finalSummary is not set, use the last message in history
          const lastMsg = finalState.messages[finalState.messages.length - 1];
          if (typeof lastMsg?.content === 'object' && lastMsg.content !== null) {
            try {
              // This case implies the last message was a tool_use or similar complex object
              agentResponse = '```json\n' + JSON.stringify(lastMsg.content, null, 2) + '\n```';
              console.log(`[Session: ${sessionId}] DEBUG: Using last message content (object):`, agentResponse);
            } catch (e: any) {
              agentResponse = `[Error: Could not stringify tool output content from last message: ${e.message}]`;
            }
          } else if (typeof lastMsg?.content === 'string') {
            agentResponse = lastMsg.content;
            console.log(`[Session: ${sessionId}] DEBUG: Using last message content (string):`, agentResponse);
          } else {
            agentResponse = `[Agent response content was unexpected type in last message: ${typeof lastMsg?.content}]`;
          }
        } else {
          console.log(`[Session: ${sessionId}] No messages found in finalState.`);
        }
      } else {
        console.log(`[Session: ${sessionId}] Graph did not return a final state.`);
      }

      console.log(`\n--- [Session: ${sessionId}] Agent's Response ---`);
      console.log(agentResponse);
      return agentResponse; // Return the response for testing multi-turn flows
    } catch (error) {
      console.error(`[Session: ${sessionId}] Error invoking agent:`, error);
      return `An error occurred while processing your request: ${error.message}`;
    }
  }

  // --- Run your test cases here ---
  const sessionId1 = 'test_session_1';
  await simulateChatTurn(sessionId1, `I am having trouble with the following offer 62240d06-821d-495a-bb67-b4d6c924167e in staging environment.`);

  // Example of a second turn (if your agent supports it)
  // await simulateChatTurn(sessionId1, `Can you tell me more about the Datadog logs?`);

  const sessionId2 = 'test_session_2';
  await simulateChatTurn(sessionId2, `What's the status of campaign 92ab7a5d-f827-4095-913c-bc43a164348e in production?`);

})().catch(console.error);