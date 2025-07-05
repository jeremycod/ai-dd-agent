import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { app } from './workflow';
import { PROMPT } from './constants';
import { AgentState } from './model/agentState';

// --- Example Usage ---
(async () => {
  const userQuery1 = `I'm having trouble with publishing/opening the campaign pages to the following UFC 318 IAP Upsell Campaigns in Genie+ Prod at the moment. I was in the middle of Saving Changes -> Publishing, but the page to the campaign stopped loading and does not reload even when I try to open it in a new window. Please advise.
    92ab7a5d-f827-4095-913c-bc43a164348e
    65ca4675-5129-439c-bba1-19a5f9e412ab
    198187c7-3b59-4c76-4c76-a4e7-5bb242e79378`; // Fixed a typo in the last ID if it was wrong
  const userQuery = `I am having trouble with the following offer 62240d06-821d-495a-bb67-b4d6c924167e in staging environment.`;
  if (!app || typeof app !== 'object') {
    throw new Error('The `app` object is not initialized or is invalid.');
  }

  if (typeof app.stream !== 'function') {
    throw new Error('The `stream` method is not available on the `app` object.');
  }
  //console.log(`User: ${userQuery}`);
  // This is the correct way to initialize the state.
  // It's a plain JS object that *conforms* to the AgentState type.
  const initialState: AgentState = {
    messages: [new SystemMessage(PROMPT), new HumanMessage(userQuery)],

    entityIds: [], // Will be populated by parseUserQuery
    entityType: 'unknown', // Will be populated by parseUserQuery
    timeRange: '1h', // Default, will be updated by parseUserQuery
    datadogLogs: [],
    analysisResults: {},
    runParallelAnalysis: false, // Will be set to true if IDs are found
    finalSummary: undefined,
  };

  const stream = await app.invoke(initialState);
  const finalState = stream;

  if (finalState) {
    if (finalState.finalSummary) {
      console.log("\n--- Agent's Final Summary ---");
      console.log(finalState.finalSummary);
    } else if (finalState.messages && finalState.messages.length > 0) {
      console.log("\n--- Agent's Final Message ---");
      const lastMsg = finalState.messages[finalState.messages.length - 1];
      console.log(lastMsg?.content || 'Agent finished without a clear summary.');
    } else {
      console.log('No messages found in finalState.');
    }
  } else {
    console.log('Graph did not return a final state.');
  }
})().catch(console.error);
