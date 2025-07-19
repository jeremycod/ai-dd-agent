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
  // A more robust check might involve comparing content, type, and tool_call_id if applicable.
  // For simplicity, let's use content and type. If you have unique IDs for messages, use them.
  return messageArray.some(
    (existingMsg) =>
      existingMsg.content === message.content &&
      existingMsg.getType === message.getType &&
      (existingMsg instanceof ToolMessage && message instanceof ToolMessage
        ? existingMsg.name === message.name
        : true),
    // If BaseMessage had a reliable unique ID, you'd use that:
    // && (existingMsg.id && message.id ? existingMsg.id === message.id : true)
  );
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
  const finalMessages: BaseMessage[] = [...state.messages]; // Start with the original messages

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
        // Only add if it's not a HumanMessage (which should only come from initial state)
        // and it doesn't already exist in our finalMessages array.
        if (!(msg instanceof HumanMessage) && !messageExists(msg, finalMessages)) {
          finalMessages.push(msg);
        }
      }
      // Remove messages from result so Object.assign doesn't try to merge it
      delete result.messages;
    }

    // Merge all other properties (userQuery, entityType, timeRange etc.)
    // Note: This assumes these are single-value properties that either replace or are consistent.
    // For example, timeRange, entityType should ideally be consistent across parallel calls if derived from initial state.
    Object.assign(combinedState, result);
  }

  // Assign the accumulated and deduplicated messages
  combinedState.messages = finalMessages;

  return combinedState;
}
