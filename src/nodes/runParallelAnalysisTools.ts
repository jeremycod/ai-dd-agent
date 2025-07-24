import { AgentStateData } from '../model/agentState';
import { AIMessage } from '@langchain/core/messages';

import { analyzeDatadogErrorsTool, analyzeDatadogWarningsTool } from '../tools/datadogLogsTool';
import { analyzeEntityHistoryTool } from '../tools/entityHistoryTools';
import { analyzeUPSOfferPriceTool } from '../tools/upsTools';
import { compareOffersTool } from '../tools/offerComparisonTools';
import { generateNewAIMessage } from '../utils/auth/helpers';
import { logger } from '../utils/logger';

import { Offer as OfferServiceOffer } from '../model/types/offerService';
import { Offer as GenieOffer } from '../model/types/genieGraphql';


type AnalysisPromiseResult = {
  type: 'datadogErrors' | 'datadogWarnings' | 'entityHistory' | 'upsOfferPrice' | 'offerComparison';
  id?: string;
  result: string | Partial<AgentStateData>;
};

export async function runParallelAnalysisTools(
    state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  logger.info('[Node: runParallelAnalysisTools] Entering...');
  const {
    datadogLogs,
    messages,
    entityHistory,
    offerPriceDetails,
    genieOfferDetails,
    offerServiceDetails,
    queryCategory,
    entityIds,
    entityType,
  } = state;

  const analysisResultsAccumulator: AgentStateData['analysisResults'] = {
    ...state.analysisResults, // Preserve existing results if any
  };
  const newMessagesAccumulator: AIMessage[] = [];

  const allAnalysisPromises: Promise<AnalysisPromiseResult>[] = [];

  if (datadogLogs && datadogLogs.length > 0) {
    logger.info('[Node: runParallelAnalysisTools] Adding Datadog analysis tools.');
    allAnalysisPromises.push(
        analyzeDatadogErrorsTool.invoke({ logs: datadogLogs, ids: entityIds }).then(res => ({ type: 'datadogErrors', result: res })),
        analyzeDatadogWarningsTool.invoke({ logs: datadogLogs, ids: entityIds }).then(res => ({ type: 'datadogWarnings', result: res }))
    );
  } else {
    analysisResultsAccumulator.datadogErrors = 'No logs retrieved to check for errors.';
    analysisResultsAccumulator.datadogWarnings = 'No logs retrieved to check for warnings.';
    newMessagesAccumulator.push(
        generateNewAIMessage('No Datadog logs were available for analysis.'),
    );
    logger.info('[Node: runParallelAnalysisTools] Datadog analysis skipped (no logs).');
  }

  if (entityHistory && entityHistory.length > 0) {
    logger.info('[Node: runParallelAnalysisTools] Adding Entity History analysis tool.');
    allAnalysisPromises.push(
        analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }).then(res => ({ type: 'entityHistory', result: res }))
    );
  } else {
    analysisResultsAccumulator.entityHistory = 'No entity history found.';
    newMessagesAccumulator.push(
        generateNewAIMessage('No entity history was available for analysis.'),
    );
    logger.info('[Node: runParallelAnalysisTools] Entity History analysis skipped (no history).');
  }

  if (
      queryCategory === 'OFFER_PRICE' &&
      offerPriceDetails &&
      offerPriceDetails.length > 0
  ) {
    logger.info(
        '[Node: runParallelAnalysisTools] Adding analyzeUPSOfferPriceTool to parallel execution.',
    );
    allAnalysisPromises.push(
        analyzeUPSOfferPriceTool(state).then(res => ({ type: 'upsOfferPrice', result: res }))
    );
  } else if (queryCategory === 'OFFER_PRICE') {
    analysisResultsAccumulator.upsOfferPrice =
        'Could not retrieve UPS Offer Price details for analysis.';
    newMessagesAccumulator.push(
        generateNewAIMessage('Could not retrieve UPS Offer Price details for analysis.'),
    );
    logger.info('[Node: runParallelAnalysisTools] UPS Offer Price analysis skipped (no details).');
  }

  if (entityType === 'offer' && entityIds && entityIds.length > 0) {
    logger.info('[Node: runParallelAnalysisTools] Checking for offer comparison opportunities.');
    let anyOfferComparisonAdded = false;
    for (const offerId of entityIds) {
      const currentOfferServiceOffer = (offerServiceDetails as OfferServiceOffer[] | undefined)?.find(
          (offer) => offer.id === offerId,
      ) || null;

      const currentGenieOffer = (genieOfferDetails as GenieOffer[] | undefined)?.find(
          (offer) => offer.id === offerId,
      ) || null;

      if (currentOfferServiceOffer || currentGenieOffer) {
        allAnalysisPromises.push(
            compareOffersTool.invoke({
              offerId: offerId,
              offerServiceOffer: currentOfferServiceOffer,
              genieOffer: currentGenieOffer,
            }).then(res => ({ type: 'offerComparison', id: offerId, result: res })),
        );
        logger.info(`[Node: runParallelAnalysisTools] Added compareOffersTool for offer ID: ${offerId}.`);
        anyOfferComparisonAdded = true;
      } else {
        analysisResultsAccumulator[`offerComparison_${offerId}`] = `No Offer Service or Genie data found for offer ID: ${offerId} to compare.`;
        newMessagesAccumulator.push(generateNewAIMessage(`No data for offer ID ${offerId} to compare.`));
        logger.info(`[Node: runParallelAnalysisTools] No comparison data for offer ID: ${offerId}.`);
      }
    }
    if (!anyOfferComparisonAdded) {
      analysisResultsAccumulator.offerComparison = 'Offer comparison skipped: No relevant offer data found for any provided IDs.';
      newMessagesAccumulator.push(generateNewAIMessage('Offer comparison skipped. No offer data found for comparison.'));
      logger.info('[Node: runParallelAnalysisTools] Offer comparison analysis skipped (no comparison opportunities).');
    }
  } else {
    analysisResultsAccumulator.offerComparison = 'Offer comparison skipped: Not an offer query or no IDs provided.';
    newMessagesAccumulator.push(generateNewAIMessage('Offer comparison skipped.'));
    logger.info('[Node: runParallelAnalysisTools] Offer comparison analysis skipped (not offer query or no IDs).');
  }


  if (allAnalysisPromises.length === 0) {
    logger.info('[Node: runParallelAnalysisTools] No specific analysis tools were added to run.');
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

  logger.info(`[Node: runParallelAnalysisTools] Running ${allAnalysisPromises.length} analysis tools in parallel.`);

  const allResults = await Promise.allSettled(allAnalysisPromises);

  for (const item of allResults) {
    if (item.status === 'fulfilled') {
      const result = item.value; // The resolved value from our promise (type: AnalysisPromiseResult)
      switch (result.type) {
        case 'datadogErrors':
          analysisResultsAccumulator.datadogErrors = result.result as string;
          break;
        case 'datadogWarnings':
          analysisResultsAccumulator.datadogWarnings = result.result as string;
          break;
        case 'entityHistory':
          analysisResultsAccumulator.entityHistory = result.result as string;
          break;
        case 'upsOfferPrice':
          const upsResult = result.result as Partial<AgentStateData>;
          if (upsResult.analysisResults) {
            Object.assign(analysisResultsAccumulator, upsResult.analysisResults);
          }
          if (upsResult.messages) {
            newMessagesAccumulator.push(...(upsResult.messages as AIMessage[]));
          }
          break;
        case 'offerComparison':
          if (result.id) {
            analysisResultsAccumulator[`offerComparison_${result.id}`] = result.result as string;
          } else {
            logger.warn(`[Node: runParallelAnalysisTools] Offer comparison result missing ID:`, result);
          }
          break;
        default:
          logger.warn(`[Node: runParallelAnalysisTools] Unknown result type encountered: ${result.type}`);
      }
    } else {
      const reason = item.reason;
      let errorMessage = `Analysis tool failed: ${reason?.message || reason?.name || String(reason)}`;
      let analysisType = 'unknown';

      logger.error(`[Node: runParallelAnalysisTools] A parallel analysis tool rejected:`, reason);

      if (reason && typeof reason === 'object') {
        if (reason.message?.includes('Datadog')) analysisType = 'datadog';
        else if (reason.message?.includes('entity history')) analysisType = 'entityHistory';
        else if (reason.message?.includes('UPS Offer Price')) analysisType = 'upsOfferPrice';
        else if (reason.message?.includes('offer comparison')) analysisType = 'offerComparison';
      }

      newMessagesAccumulator.push(
          generateNewAIMessage(`An error occurred during ${analysisType} analysis. Please check server logs for details.`),
      );
      (analysisResultsAccumulator as any)[`${analysisType}Error`] = `Error: ${errorMessage}`;
    }
  }

  logger.info('[Node: runParallelAnalysisTools] Parallel analysis completed and results processed.');

  return {
    analysisResults: analysisResultsAccumulator,
    messages: [
      ...messages,
      ...newMessagesAccumulator,
      generateNewAIMessage('Parallel analysis completed. Proceeding to summarizing findings.'),
    ],
  };
}