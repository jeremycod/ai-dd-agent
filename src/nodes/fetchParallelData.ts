import { AgentStateData } from '../model/agentState';
import { fetchEntityHistory } from './fetchEntityHistory';
import { fetchDatadogLogs } from './fetchDatadogLogs';
import { fetchUPSOfferPrice } from './fetchUPSOfferPrice';
import { BaseMessage, AIMessage, ToolMessage, HumanMessage } from '@langchain/core/messages';
import { fetchGenieOffer } from './fetchGenieOffer';
import { logger } from '../utils/logger';
import { fetchOfferServiceOffer } from './fetchOfferServiceOffer';


function messageExists(message: BaseMessage, messageArray: BaseMessage[]): boolean {
  return messageArray.some(existingMsg => {
    if (existingMsg === message) return true;

    if ((existingMsg as any).lc_id && (message as any).lc_id &&
        (existingMsg as any).lc_id[existingMsg.lc_id.length - 1] === (message as any).lc_id[message.lc_id.length - 1]) {
      return true;
    }

    const existingToolUseId = (existingMsg instanceof HumanMessage && (existingMsg.content as any)[0]?.type === 'tool_result')
        ? (existingMsg.content as any)[0].tool_use_id
        : null;
    const messageToolUseId = (message instanceof HumanMessage && (message.content as any)[0]?.type === 'tool_result')
        ? (message.content as any)[0].tool_use_id
        : null;

    if (existingToolUseId && messageToolUseId && existingToolUseId === messageToolUseId) {
      return true;
    }

    const existingToolCallIds = (existingMsg instanceof AIMessage && existingMsg.tool_calls)
        ? existingMsg.tool_calls.map(tc => tc.id).sort().join(',')
        : null;
    const messageToolCallIds = (message instanceof AIMessage && message.tool_calls)
        ? message.tool_calls.map(tc => tc.id).sort().join(',')
        : null;

    if (existingToolCallIds && messageToolCallIds && existingToolCallIds === messageToolCallIds) {
      return true;
    }

    if (existingMsg.getType() !== message.getType()) return false;
    if (existingMsg.name !== message.name) return false; // Important for ToolMessages

    try {
      return JSON.stringify(existingMsg.content) === JSON.stringify(message.content);
    } catch (e) {
      logger.warn("Could not stringify message content for comparison.", e);
      return false;
    }
  });
}


export async function fetchParallelData(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: fetchParallelData] Starting parallel data fetching...');

  const promises: Promise<Partial<AgentStateData>>[] = [];
  const calledFunctions: string[] = [];

  promises.push(fetchEntityHistory(state));
  calledFunctions.push('fetchEntityHistory');

  promises.push(fetchDatadogLogs(state));
  calledFunctions.push('fetchDatadogLogs');

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

  if (state.entityType === 'offer' && state.entityIds && state.entityIds.length > 0) {
    logger.info(
      '[Node: fetchOfferServiceOffer] Query is for offer. Adding fetchOfferServiceOffer to parallel calls.',
    );
    promises.push(fetchOfferServiceOffer(state));
    calledFunctions.push('fetchOfferServiceOffer');
  }

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

  logger.info(
    `[Node: fetchParallelData] Calling functions in parallel: ${calledFunctions.join(', ')}`,
  );

  const results = await Promise.all(promises);

  logger.info('[Node: fetchParallelData] All parallel data fetching complete.');

  const combinedState: Partial<AgentStateData> = {};
  const newMessagesForThisNode: BaseMessage[] = [];

  for (const result of results) {

    if (result.analysisResults) {
      combinedState.analysisResults = {
        ...(combinedState.analysisResults || {}),
        ...result.analysisResults,
      };
      delete result.analysisResults;
    }

    if (result.offerPriceDetails) {
      combinedState.offerPriceDetails = [
        ...(combinedState.offerPriceDetails || []),
        ...result.offerPriceDetails,
      ];
      delete result.offerPriceDetails;
    }

    if (result.genieOfferDetails) {
      combinedState.genieOfferDetails = [
        ...(combinedState.genieOfferDetails || []),
        ...result.genieOfferDetails,
      ];
      delete result.genieOfferDetails;
    }

    if (result.offerServiceDetails) {
      combinedState.offerServiceDetails = [
        ...(combinedState.offerServiceDetails || []),
        ...result.offerServiceDetails,
      ];
      delete result.offerServiceDetails;
    }

    if (result.datadogLogs) {
      combinedState.datadogLogs = result.datadogLogs;
      delete result.datadogLogs;
    }

    if (result.entityHistory) {
      combinedState.entityHistory = result.entityHistory;
      delete result.entityHistory;
    }

    if (result.messages) {
      for (const msg of result.messages) {
        if (!(msg instanceof HumanMessage) && !messageExists(msg, newMessagesForThisNode)) {
          newMessagesForThisNode.push(msg);
        }
      }
      delete result.messages;
    }

    Object.assign(combinedState, result);
  }

  // Assign the accumulated and deduplicated messages
  combinedState.messages = newMessagesForThisNode;
  logger.debug('[Node: fetchParallelData] Combined State BEFORE return:', JSON.stringify(combinedState, null, 2));
  return combinedState;
}
