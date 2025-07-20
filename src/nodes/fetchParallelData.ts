// src/nodes/fetchParallelData.ts

import { AgentStateData } from '../model/agentState';
import { fetchEntityHistory } from './fetchEntityHistory';
import { fetchDatadogLogs } from './fetchDatadogLogs';
import { fetchUPSOfferPrice } from './fetchUPSOfferPrice';
import { BaseMessage, AIMessage, ToolMessage, HumanMessage } from '@langchain/core/messages'; // Import specific message types for better type checking/filtering
import { fetchGenieOffer } from './fetchGenieOffer';
import { logger } from '../utils/logger';
import { fetchOfferServiceOffer } from './fetchOfferServiceOffer';

// Helper function to check if a message is already in an array
function messageExists(message: BaseMessage, messageArray: BaseMessage[]): boolean {
  return messageArray.some(existingMsg => {
    // 1. Check if they are the exact same object reference (fastest)
    if (existingMsg === message) return true;

    // 2. Check for unique LangChain internal ID (if available and reliable across runs)
    // LangChain often adds unique IDs, check their structure
    if ((existingMsg as any).lc_id && (message as any).lc_id &&
        (existingMsg as any).lc_id[existingMsg.lc_id.length - 1] === (message as any).lc_id[message.lc_id.length - 1]) {
      return true; // Match by LC internal ID
    }

    // 3. For ToolMessages (or HumanMessages acting as tool_result), compare by tool_use_id
    // This is the most important for your specific error
    const existingToolUseId = (existingMsg instanceof HumanMessage && (existingMsg.content as any)[0]?.type === 'tool_result')
        ? (existingMsg.content as any)[0].tool_use_id
        : null;
    const messageToolUseId = (message instanceof HumanMessage && (message.content as any)[0]?.type === 'tool_result')
        ? (message.content as any)[0].tool_use_id
        : null;

    if (existingToolUseId && messageToolUseId && existingToolUseId === messageToolUseId) {
      return true; // Both are tool results with the same tool_use_id
    }

    // 4. For AIMessages with tool_use, compare by tool_call_id
    const existingToolCallIds = (existingMsg instanceof AIMessage && existingMsg.tool_calls)
        ? existingMsg.tool_calls.map(tc => tc.id).sort().join(',')
        : null;
    const messageToolCallIds = (message instanceof AIMessage && message.tool_calls)
        ? message.tool_calls.map(tc => tc.id).sort().join(',')
        : null;

    if (existingToolCallIds && messageToolCallIds && existingToolCallIds === messageToolCallIds) {
      return true; // Both are AI tool uses with the same tool_call_ids
    }


    // 5. Fallback for other messages (System, Human, AI text-only) - Compare type and content (JSON stringify for complex content)
    if (existingMsg.getType() !== message.getType()) return false;
    if (existingMsg.name !== message.name) return false; // Important for ToolMessages

    try {
      // Deep comparison for content, robust enough for strings or structured arrays
      return JSON.stringify(existingMsg.content) === JSON.stringify(message.content);
    } catch (e) {
      // Fallback for extreme cases (circular refs, etc.)
      logger.warn("Could not stringify message content for comparison.", e);
      return false;
    }
  });
}


export async function fetchParallelData(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: fetchParallelData] Starting parallel data fetching...');

  // Initialize an array to hold all promises
  const promises: Promise<Partial<AgentStateData>>[] = [];
  // Initialize an array to hold the names of the functions called for logging
  const calledFunctions: string[] = [];

  // Always include these baseline fetches
  promises.push(fetchEntityHistory(state));
  calledFunctions.push('fetchEntityHistory');

  promises.push(fetchDatadogLogs(state));
  calledFunctions.push('fetchDatadogLogs');

  // -- Conditional Call for fetching Genie Offer
  if (state.entityType === 'offer' && state.entityIds && state.entityIds.length > 0) {
    logger.info(
      '[Node: fetchGenieOffer] Query is for offer issue. Adding fetchGenieOffer to parallel calls.',
    );
    const genieOfferPromises = state.entityIds.map(
      (offerId) => fetchGenieOffer({ ...state, entityIds: [offerId] }), // Pass a state with only one ID for this specific call
    );
    promises.push(...genieOfferPromises);
    calledFunctions.push(`fetchGenieOffer (for ${state.entityIds.length} IDs)`);
  }

  // -- Conditional Call for fetching Offer Service Offer
  if (state.entityType === 'offer' && state.entityIds && state.entityIds.length > 0) {
    logger.info(
      '[Node: fetchOfferServiceOffer] Query is for offer. Adding fetchOfferServiceOffer to parallel calls.',
    );
    promises.push(fetchOfferServiceOffer(state));
    calledFunctions.push('fetchOfferServiceOffer');
  }

  // --- Conditional Call for fetchUPSOfferPrice ---
  if (
    state.queryCategory === 'OFFER_PRICE' &&
    state.entityType === 'offer' &&
    state.entityIds &&
    state.entityIds.length > 0
  ) {
    logger.info(
      '[Node: fetchParallelData] Query is for OFFER_PRICE. Adding fetchUPSOfferPrice to parallel calls.',
    );
    const offerPricePromises = state.entityIds.map((offerId) =>
      fetchUPSOfferPrice({ ...state, entityIds: [offerId] }),
    );
    promises.push(...offerPricePromises);
    calledFunctions.push(`fetchUPSOfferPrice (for ${state.entityIds.length} IDs)`);
  }
  // --- End Conditional Call ---

  logger.info(
    `[Node: fetchParallelData] Calling functions in parallel: ${calledFunctions.join(', ')}`,
  );

  // Wait for all promises to resolve
  const results = await Promise.all(promises);

  logger.info('[Node: fetchParallelData] All parallel data fetching complete.');

  // Combine the results from all fetches
  const combinedState: Partial<AgentStateData> = {};
  const newMessagesForThisNode: BaseMessage[] = [];// Start with the original messages

  for (const result of results) {
    // Merge analysisResults and other data properties deeply
    if (result.analysisResults) {
      combinedState.analysisResults = {
        ...(combinedState.analysisResults || {}),
        ...result.analysisResults,
      };
      // Remove from result to avoid shallow overwrite by Object.assign later
      delete result.analysisResults;
    }

    // Merge offerPriceDetails (if present)
    if (result.offerPriceDetails) {
      combinedState.offerPriceDetails = [
        ...(combinedState.offerPriceDetails || []),
        ...result.offerPriceDetails,
      ];
      delete result.offerPriceDetails;
    }

    // Merge genieOfferDetails (if present)
    if (result.genieOfferDetails) {
      combinedState.genieOfferDetails = [
        ...(combinedState.genieOfferDetails || []),
        ...result.genieOfferDetails,
      ];
      delete result.genieOfferDetails;
    }

    // Merge offerServiceOffers (if present)
    if (result.offerServiceDetails) {
      combinedState.offerServiceDetails = [
        ...(combinedState.offerServiceDetails || []),
        ...result.offerServiceDetails,
      ];
      delete result.offerServiceDetails;
    }

    // Handle datadogLogs - assuming fetchDatadogLogs is the only one populating this
    if (result.datadogLogs) {
      combinedState.datadogLogs = result.datadogLogs; // Datadog logs likely replace, not merge
      delete result.datadogLogs;
    }

    // Handle entityHistory - assuming fetchEntityHistory is the only one populating this
    if (result.entityHistory) {
      combinedState.entityHistory = result.entityHistory; // Entity history likely replaces, not merge
      delete result.entityHistory;
    }

    // Add new messages from this result, ensuring no duplicates.
    // We assume original messages are only from state.messages (HumanMessage/past AIMessages)
    // and tool outputs/new AI messages come from the results.
    if (result.messages) {
      for (const msg of result.messages) {
        // This 'messageExists' check here is now for deduplicating messages *within* the results
        // from parallel fetches, not against the entire history.
        // It's still good to prevent duplicates if a sub-fetch function somehow returns the same message twice.
        if (!(msg instanceof HumanMessage) && !messageExists(msg, newMessagesForThisNode)) {
          newMessagesForThisNode.push(msg);
        }
      }
      // CRITICAL: Remove 'messages' from 'result' so Object.assign doesn't overwrite the channel later
      delete result.messages;
    }

    // Merge all other properties (userQuery, entityType, timeRange etc.)
    // Note: This assumes these are single-value properties that either replace or are consistent.
    // For example, timeRange, entityType should ideally be consistent across parallel calls if derived from initial state.
    Object.assign(combinedState, result);
  }

  // Assign the accumulated and deduplicated messages
  combinedState.messages = newMessagesForThisNode;
  logger.debug('[Node: fetchParallelData] Combined State BEFORE return:', JSON.stringify(combinedState, null, 2));
  return combinedState;
}
