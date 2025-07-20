// src/nodes/runParallelAnalysisTools.ts

import { AgentStateData } from '../model/agentState';
import { AIMessage } from '@langchain/core/messages';

import { analyzeDatadogErrorsTool, analyzeDatadogWarningsTool } from '../tools/datadogLogsTool';
import { analyzeEntityHistoryTool } from '../tools/entityHistoryTools';
import { analyzeUPSOfferPriceTool } from '../tools/upsTools';
import { compareOffersTool } from '../tools/offerComparisonTools';
import { generateNewAIMessage } from '../utils/auth/helpers';
import { logger } from '../utils/logger';

// Import the specific Offer types needed for comparison logic
import { Offer as OfferServiceOffer } from '../model/types/offerService';
import { Offer as GenieOffer } from '../model/types/genieGraphql'; // ADJUST PATH AS NEEDED

export async function runParallelAnalysisTools(
    state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  logger.info('[Node: runParallelAnalysisTools] Entering...');
  const {
    datadogLogs,
    messages,
    entityHistory,
    offerPriceDetails,
    genieOfferDetails, // <--- Destructure genieOfferDetails
    offerServiceDetails, // <--- Destructure offerServiceDetails (assuming this holds OfferServiceOffer[])
    queryCategory,
    entityIds, // <--- Need entityIds to loop for comparison
      entityType
  } = state;

  const langchainToolPromises: Promise<string>[] = [];
  const customFunctionPromises: Promise<Partial<AgentStateData>>[] = [];

  const analysisResultsAccumulator: AgentStateData['analysisResults'] = {
    ...state.analysisResults,
  };
  const newMessagesAccumulator: AIMessage[] = [];

  // --- Conditional Datadog/Entity History Analysis ---
  if (datadogLogs && datadogLogs.length > 0) { // Add null/undefined check for datadogLogs
    langchainToolPromises.push(analyzeDatadogErrorsTool.invoke({ logs: datadogLogs }));
    langchainToolPromises.push(analyzeDatadogWarningsTool.invoke({ logs: datadogLogs }));
    logger.info('[Node: runParallelAnalysisTools] Added Datadog analysis tools.');
  } else {
    analysisResultsAccumulator.datadogErrors = 'No logs retrieved to check for errors.';
    analysisResultsAccumulator.datadogWarnings = 'No logs retrieved to check for warnings.';
    newMessagesAccumulator.push(
        generateNewAIMessage('No Datadog logs were available for analysis.'),
    );
  }

  if (entityHistory && entityHistory.length > 0) { // Add null/undefined check for entityHistory
    langchainToolPromises.push(analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }));
    logger.info('[Node: runParallelAnalysisTools] Added Entity History analysis tool.');
  } else {
    analysisResultsAccumulator.entityHistory = 'No entity history found.';
    newMessagesAccumulator.push(
        generateNewAIMessage('No entity history was available for analysis.'),
    );
  }

  // --- Conditional UPS Offer Price Analysis ---
  if (
      queryCategory === 'OFFER_PRICE' &&
      offerPriceDetails &&
      offerPriceDetails.length > 0
  ) {
    logger.info(
        '[Node: runParallelAnalysisTools] Adding analyzeUPSOfferPriceTool to parallel execution.',
    );
    customFunctionPromises.push(analyzeUPSOfferPriceTool(state));
  } else if (queryCategory === 'OFFER_PRICE') {
    analysisResultsAccumulator.upsOfferPrice =
        'Could not retrieve UPS Offer Price details for analysis.';
    newMessagesAccumulator.push(
        generateNewAIMessage('Could not retrieve UPS Offer Price details for analysis.'),
    );
  }

  // --- Conditional Offer Comparison Analysis ---
  // Iterate through entityIds to find matching offers from both sources
  if (entityType === 'offer' && entityIds && entityIds.length > 0) {
    logger.info('[Node: runParallelAnalysisTools] Checking for offer comparison opportunities.');
    for (const offerId of entityIds) {
      // Find the specific OfferService Offer for this ID
      const currentOfferServiceOffer = (offerServiceDetails as OfferServiceOffer[] | undefined)?.find(
          (offer) => offer.id === offerId,
      ) || null; // Ensure it's OfferServiceOffer type

      // Find the specific Genie Offer for this ID
      const currentGenieOffer = (genieOfferDetails as GenieOffer[] | undefined)?.find(
          (offer) => offer.id === offerId,
      ) || null; // Ensure it's GenieOffer type

      // Only compare if at least one of them is found
      if (currentOfferServiceOffer || currentGenieOffer) {
        langchainToolPromises.push(
            compareOffersTool.invoke({
              offerId: offerId,
              offerServiceOffer: currentOfferServiceOffer,
              genieOffer: currentGenieOffer,
            }),
        );
        logger.info(`[Node: runParallelAnalysisTools] Added compareOffersTool for offer ID: ${offerId}.`);
      } else {
        analysisResultsAccumulator[`offerComparison_${offerId}`] = `No Offer Service or Genie data found for offer ID: ${offerId} to compare.`;
        newMessagesAccumulator.push(generateNewAIMessage(`No data for offer ID ${offerId} to compare.`));
      }
    }
  } else {
    analysisResultsAccumulator.offerComparison = 'Offer comparison skipped: Not an offer query or no IDs provided.';
    newMessagesAccumulator.push(generateNewAIMessage('Offer comparison skipped.'));
  }


  if (langchainToolPromises.length === 0 && customFunctionPromises.length === 0) {
    logger.info('[Node: runParallelAnalysisTools] No specific analysis tools to run.');
    return {
      analysisResults: analysisResultsAccumulator,
      messages: [
        ...messages,
        ...newMessagesAccumulator,
        generateNewAIMessage(
            'No specific analysis tools were run as no relevant data was available.',
        ),
      ],
    };
  }

  logger.info(
      `[Node: runParallelAnalysisTools] Running analysis tools in parallel. LangChain Tools: ${langchainToolPromises.length}, Custom Functions: ${customFunctionPromises.length}`,
  );

  // Execute all promises in parallel
  const [langchainToolResults, customFunctionResults] = await Promise.all([
    Promise.all(langchainToolPromises),
    Promise.all(customFunctionPromises),
  ]);

  // Process LangChain Tool results (assuming they return strings)
  let resultIndex = 0;
  if (datadogLogs && datadogLogs.length > 0) { // Add null/undefined check
    analysisResultsAccumulator.datadogErrors = langchainToolResults[resultIndex++];
    analysisResultsAccumulator.datadogWarnings = langchainToolResults[resultIndex++];
  }
  if (entityHistory && entityHistory.length > 0) { // Add null/undefined check
    analysisResultsAccumulator.entityHistory = langchainToolResults[resultIndex++];
  }

  // Process results from compareOffersTool dynamically
  if (entityType === 'offer' && entityIds && entityIds.length > 0) {
    for (const offerId of entityIds) {
      // Find the corresponding result for this offerId.
      // This requires careful management of `resultIndex` or matching by content/ID if results are not strictly ordered.
      // For simplicity, we'll assume sequential processing here.
      // A more robust approach would be to return an object from the tool like { offerId: string, comparisonResult: string }
      // and then map over customFunctionResults.
      // For now, let's just assign the next available result from langchainToolResults.
      // A better pattern for multiple dynamic tool calls is to map the promises to an object:
      // const comparisonPromises = entityIds.map(async (id) => ({ id, result: await compareOffersTool.invoke(...) }));
      // Then await Promise.all(comparisonPromises) to get [{id, result}, {id, result}, ...]

      // For current structure, we'll assign sequentially, but be aware this is fragile if other dynamic tools are added.
      // To be safer, let's create a separate array for offer comparison promises.
    }
  }

  // Re-organize Promise.all to handle dynamic results better
  // Let's refactor the promises collection and results processing slightly for clarity and robustness.

  const allToolPromises: Array<Promise<{ type: string; id?: string; result: string | Partial<AgentStateData>; }>> = [];

  // Add Datadog/Entity History Promises (return type: { type: 'datadogError' | 'datadogWarning' | 'entityHistory', result: string })
  if (datadogLogs && datadogLogs.length > 0) {
    allToolPromises.push(analyzeDatadogErrorsTool.invoke({ logs: datadogLogs }).then(res => ({ type: 'datadogErrors', result: res })));
    allToolPromises.push(analyzeDatadogWarningsTool.invoke({ logs: datadogLogs }).then(res => ({ type: 'datadogWarnings', result: res })));
  }
  if (entityHistory && entityHistory.length > 0) {
    allToolPromises.push(analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }).then(res => ({ type: 'entityHistory', result: res })));
  }

  // Add UPS Offer Price Promises (return type: { type: 'upsOfferPrice', result: Partial<AgentStateData> })
  if (queryCategory === 'OFFER_PRICE' && offerPriceDetails && offerPriceDetails.length > 0) {
    allToolPromises.push(analyzeUPSOfferPriceTool(state).then(res => ({ type: 'upsOfferPrice', result: res })));
  }

  // Add Offer Comparison Promises (return type: { type: 'offerComparison', id: string, result: string })
  if (entityType === 'offer' && entityIds && entityIds.length > 0) {
    for (const offerId of entityIds) {
      const currentOfferServiceOffer = (state.offerServiceDetails as OfferServiceOffer[] | undefined)?.find(
          (offer) => offer.id === offerId,
      ) || null;

      const currentGenieOffer = (state.genieOfferDetails as GenieOffer[] | undefined)?.find(
          (offer) => offer.id === offerId,
      ) || null;

      if (currentOfferServiceOffer || currentGenieOffer) {
        allToolPromises.push(
            compareOffersTool.invoke({
              offerId: offerId,
              offerServiceOffer: currentOfferServiceOffer,
              genieOffer: currentGenieOffer,
            }).then(res => ({ type: 'offerComparison', id: offerId, result: res })),
        );
      } else {
        // Handle cases where no data is available for comparison for a specific ID
        analysisResultsAccumulator[`offerComparison_${offerId}`] = `No Offer Service or Genie data found for offer ID: ${offerId} to compare.`;
        newMessagesAccumulator.push(generateNewAIMessage(`No data for offer ID ${offerId} to compare.`));
      }
    }
  }

  if (allToolPromises.length === 0) {
    logger.info('[Node: runParallelAnalysisTools] No specific analysis tools to run.');
    return {
      analysisResults: analysisResultsAccumulator,
      messages: [
        ...messages,
        ...newMessagesAccumulator,
        generateNewAIMessage(
            'No specific analysis tools were run as no relevant data was available.',
        ),
      ],
    };
  }

  logger.info(`[Node: runParallelAnalysisTools] Running analysis tools in parallel. Total promises: ${allToolPromises.length}`);

  const allResults = await Promise.all(allToolPromises);

  for (const item of allResults) {
    switch (item.type) {
      case 'datadogErrors':
        analysisResultsAccumulator.datadogErrors = item.result as string;
        break;
      case 'datadogWarnings':
        analysisResultsAccumulator.datadogWarnings = item.result as string;
        break;
      case 'entityHistory':
        analysisResultsAccumulator.entityHistory = item.result as string;
        break;
      case 'upsOfferPrice':
        const upsResult = item.result as Partial<AgentStateData>;
        if (upsResult.analysisResults) {
          Object.assign(analysisResultsAccumulator, upsResult.analysisResults);
        }
        if (upsResult.messages) {
          newMessagesAccumulator.push(...(upsResult.messages as AIMessage[]));
        }
        break;
      case 'offerComparison':
        // Store comparison result with the specific offer ID in analysisResults
        analysisResultsAccumulator[`offerComparison_${item.id}`] = item.result as string;
        break;
      default:
        logger.warn(`[Node: runParallelAnalysisTools] Unknown result type: ${item.type}`);
    }
  }

  logger.info('[Node: runParallelAnalysisTools] Parallel analysis completed.');

  return {
    analysisResults: analysisResultsAccumulator,
    messages: [
      ...messages,
      ...newMessagesAccumulator,
      generateNewAIMessage('Parallel analysis completed. Proceeding to summarizing findings.'),
    ],
  };
}