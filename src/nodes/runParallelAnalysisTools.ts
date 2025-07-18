import { AgentStateData } from '../model/agentState';
import { AIMessage } from '@langchain/core/messages';

// Assuming these tools are imported from their respective files as `DynamicStructuredTool` instances
import { analyzeDatadogErrorsTool } from '../tools/datadogLogsTool';
import { analyzeDatadogWarningsTool } from '../tools/datadogLogsTool';
import { analyzeEntityHistoryTool } from '../tools/entityHistoryTools';
import { analyzeUPSOfferPriceTool } from '../tools/upsTools';
import { generateNewAIMessage } from '../utils/auth/helpers'; // This is *your* analyzeUPSOfferPriceTool function, not a LangChain Tool instance
import { logger } from '../utils/logger';

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
  } = state; // Destructure only what's needed

  // Initialize an array to hold promises for tools that are LangChain.js Tool instances (which have .invoke())
  const langchainToolPromises: Promise<string>[] = []; // Assuming these tools return string summaries
  // Initialize an array to hold promises for custom functions that return Partial<AgentStateData>
  const customFunctionPromises: Promise<Partial<AgentStateData>>[] = [];

  const analysisResultsAccumulator: AgentStateData['analysisResults'] = {
    ...state.analysisResults,
  }; // Start with existing
  const newMessagesAccumulator: AIMessage[] = [];

  // --- Conditional Datadog/Entity History Analysis ---
  if (datadogLogs.length > 0) {
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

  if (entityHistory.length > 0) {
    langchainToolPromises.push(analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }));
    logger.info('[Node: runParallelAnalysisTools] Added Entity History analysis tool.');
  } else {
    analysisResultsAccumulator.entityHistory = 'No entity history found.';
    newMessagesAccumulator.push(
      generateNewAIMessage('No entity history was available for analysis.'),
    );
  }

  // --- Conditional UPS Offer Price Analysis ---
  // This is a custom function, not a LangChain Tool instance, so it's called directly
  if (
    queryCategory === 'OFFER_PRICE' &&
    offerPriceDetails &&
    offerPriceDetails.length > 0 // <-- This will now be correct due to AgentStateData change
  ) {
    logger.info(
      '[Node: runParallelAnalysisTools] Adding analyzeUPSOfferPriceTool to parallel execution.',
    );
    customFunctionPromises.push(analyzeUPSOfferPriceTool(state)); // This is *your* custom function
  } else if (queryCategory === 'OFFER_PRICE') {
    analysisResultsAccumulator.upsOfferPrice =
      'Could not retrieve UPS Offer Price details for analysis.';
    newMessagesAccumulator.push(
      generateNewAIMessage('Could not retrieve UPS Offer Price details for analysis.'),
    );
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
  if (datadogLogs.length > 0) {
    analysisResultsAccumulator.datadogErrors = langchainToolResults[resultIndex++];
    analysisResultsAccumulator.datadogWarnings = langchainToolResults[resultIndex++];
  }
  if (entityHistory.length > 0) {
    analysisResultsAccumulator.entityHistory = langchainToolResults[resultIndex++];
  }

  // Process Custom Function results (assuming they return Partial<AgentStateData>)
  for (const result of customFunctionResults) {
    if (result.analysisResults) {
      Object.assign(analysisResultsAccumulator, result.analysisResults); // Merge analysis results
    }
    if (result.messages) {
      newMessagesAccumulator.push(...(result.messages as AIMessage[])); // Concatenate messages
    }
  }

  logger.info('[Node: runParallelAnalysisTools] Parallel analysis completed.');

  return {
    analysisResults: analysisResultsAccumulator,
    messages: [
      ...messages,
      ...newMessagesAccumulator, // Add messages generated by the tools
      generateNewAIMessage('Parallel analysis completed. Proceeding to summarizing findings.'),
    ],
  };
}
