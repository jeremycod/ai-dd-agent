import { AgentState, AgentStateData } from '../model/agentState';
import { fetchEntityHistory } from './fetchEntityHistory';
import { fetchDatadogLogs } from './fetchDatadogLogs';
import { fetchUPCOfferPrice } from './fetchUPCOfferPrice';
import { BaseMessage } from '@langchain/core/messages';

export async function fetchParallelData(
    state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  console.log('[Node: fetchParallelData] Starting parallel data fetching...');

  // Initialize an array to hold all promises
  const promises: Promise<Partial<AgentStateData>>[] = [];
  // Initialize an array to hold the names of the functions called for logging
  const calledFunctions: string[] = [];

  // Always include these baseline fetches
  promises.push(fetchEntityHistory(state));
  calledFunctions.push('fetchEntityHistory');

  promises.push(fetchDatadogLogs(state));
  calledFunctions.push('fetchDatadogLogs');


  // --- Conditional Call for fetchUPCOfferPrice ---
  // Check if the query is categorized as OFFER_PRICE,
  // entityType is 'offer', and entityIds exist.
  if (
      state.queryCategory === 'OFFER_PRICE' &&
      state.entityType === 'offer' &&
      state.entityIds &&
      state.entityIds.length > 0
  ) {
    console.log('[Node: fetchParallelData] Query is for OFFER_PRICE. Adding fetchUPCOfferPrice to parallel calls.');
    // The fetchUPCOfferPrice node is designed to handle fetching for the first ID.
    // If you need to make *multiple* calls for *each* ID in `state.entityIds`,
    // the logic here will become more complex. For now, assuming `fetchUPCOfferPrice`
    // will operate on `state.entityIds[0]` as per our previous setup.

    // If fetchUPCOfferPrice already iterates entityIds internally, then a single call is fine.
    // If fetchUPCOfferPrice expects a single ID, and you have multiple, you'd do this:
    const offerPricePromises = state.entityIds.map(offerId =>
        fetchUPCOfferPrice({ ...state, entityIds: [offerId] }) // Pass a state with only one ID for this specific call
    );
    promises.push(...offerPricePromises);
    calledFunctions.push(`fetchUPCOfferPrice (for ${state.entityIds.length} IDs)`);

    // If fetchUPCOfferPrice is already designed to iterate state.entityIds internally:
    // promises.push(fetchUPCOfferPrice(state));
    // calledFunctions.push('fetchUPCOfferPrice');
  }
  // --- End Conditional Call ---


  console.log(`[Node: fetchParallelData] Calling functions in parallel: ${calledFunctions.join(', ')}`);

  // Wait for all promises to resolve
  const results = await Promise.all(promises);

  console.log('[Node: fetchParallelData] All parallel data fetching complete.');

  // Combine the results from all fetches
  const combinedState: Partial<AgentStateData> = {};
  let allNewMessages: BaseMessage[] = [];

  for (const result of results) {
    // Merge properties from each result into combinedState
    // Messages need special handling to accumulate, not overwrite
    if (result.messages) {
      allNewMessages = allNewMessages.concat(result.messages);
      delete result.messages; // Remove messages from individual result to avoid overwriting
    }
    Object.assign(combinedState, result); // Merge all other properties
  }

  // Prepend original messages, then append all new messages from parallel fetches
  combinedState.messages = [...state.messages, ...allNewMessages];

  return combinedState;
}