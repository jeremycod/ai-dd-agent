import { AgentStateData } from '../model/agentState';
import { AIMessage } from '@langchain/core/messages';

// Assuming these tools are imported from their respective files as `DynamicStructuredTool` instances
import { analyzeDatadogErrorsTool } from '../tools/datadogLogsTool';
import { analyzeDatadogWarningsTool } from '../tools/datadogLogsTool';
import { analyzeEntityHistoryTool } from '../tools/entityHistoryTools';
import { analyzeUPCOfferPriceTool } from '../tools/offerServiceTools'; // This is *your* analyzeUPCOfferPriceTool function, not a LangChain Tool instance

export async function runParallelAnalysisTools(
    state: AgentStateData,
): Promise<Partial<AgentStateData>> {
  console.log('[Node: runParallelAnalysisTools] Entering...');
  const { datadogLogs, messages, entityHistory, offerPriceDetails, queryCategory } = state; // Destructure only what's needed

  // Initialize an array to hold promises for tools that are LangChain.js Tool instances (which have .invoke())
  const langchainToolPromises: Promise<string>[] = []; // Assuming these tools return string summaries
  // Initialize an array to hold promises for custom functions that return Partial<AgentStateData>
  const customFunctionPromises: Promise<Partial<AgentStateData>>[] = [];

  const analysisResultsAccumulator: AgentStateData['analysisResults'] = { ...state.analysisResults }; // Start with existing
  const newMessagesAccumulator: AIMessage[] = [];

  // --- Conditional Datadog/Entity History Analysis ---
  if (datadogLogs.length > 0) {
    langchainToolPromises.push(analyzeDatadogErrorsTool.invoke({ logs: datadogLogs }));
    langchainToolPromises.push(analyzeDatadogWarningsTool.invoke({ logs: datadogLogs }));
    console.log('[Node: runParallelAnalysisTools] Added Datadog analysis tools.');
  } else {
    analysisResultsAccumulator.datadogErrors = 'No logs retrieved to check for errors.';
    analysisResultsAccumulator.datadogWarnings = 'No logs retrieved to check for warnings.';
    newMessagesAccumulator.push(new AIMessage('No Datadog logs were available for analysis.'));
  }

  if (entityHistory.length > 0) {
    langchainToolPromises.push(analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }));
    console.log('[Node: runParallelAnalysisTools] Added Entity History analysis tool.');
  } else {
    analysisResultsAccumulator.entityHistory = 'No entity history found.';
    newMessagesAccumulator.push(new AIMessage('No entity history was available for analysis.'));
  }

  // --- Conditional UPC Offer Price Analysis ---
  // This is a custom function, not a LangChain Tool instance, so it's called directly
  if (
      queryCategory === 'OFFER_PRICE' &&
      offerPriceDetails &&
      offerPriceDetails.length > 0 // <-- This will now be correct due to AgentStateData change
  ) {
    console.log('[Node: runParallelAnalysisTools] Adding analyzeUPCOfferPriceTool to parallel execution.');
    customFunctionPromises.push(analyzeUPCOfferPriceTool(state)); // This is *your* custom function
  } else if (queryCategory === 'OFFER_PRICE') {
    analysisResultsAccumulator.upcOfferPrice = 'Could not retrieve UPC Offer Price details for analysis.';
    newMessagesAccumulator.push(new AIMessage('Could not retrieve UPC Offer Price details for analysis.'));
  }


  if (langchainToolPromises.length === 0 && customFunctionPromises.length === 0) {
    console.log('[Node: runParallelAnalysisTools] No specific analysis tools to run.');
    return {
      analysisResults: analysisResultsAccumulator,
      messages: [...messages, ...newMessagesAccumulator, new AIMessage('No specific analysis tools were run as no relevant data was available.')],
    };
  }

  console.log(`[Node: runParallelAnalysisTools] Running analysis tools in parallel. LangChain Tools: ${langchainToolPromises.length}, Custom Functions: ${customFunctionPromises.length}`);

  // Execute all promises in parallel
  const [langchainToolResults, customFunctionResults] = await Promise.all([
    Promise.all(langchainToolPromises),
    Promise.all(customFunctionPromises)
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

  console.log('[Node: runParallelAnalysisTools] Parallel analysis completed.');

  return {
    analysisResults: analysisResultsAccumulator,
    messages: [
      ...messages,
      ...newMessagesAccumulator, // Add messages generated by the tools
      new AIMessage('Parallel analysis completed. Proceeding to summarizing findings.'),
    ],
  };
}