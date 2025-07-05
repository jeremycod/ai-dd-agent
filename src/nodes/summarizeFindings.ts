import {AgentState} from "../model/agentState";
import {AIMessage, BaseMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {SUMMARIZATION_MESSAGE} from "../constants";
import {summarizerLLM} from "../anthropicAgent";

export async function summarizeFindings(state: AgentState): Promise<Partial<AgentState>> {
    console.log('[Node: summarizeFindings] Entering...');
    const { messages, userQuery, analysisResults, entityIds, entityType } = state;

    // Define the SystemMessage specifically for the summarization task.
    // This will be the FIRST message sent to the Anthropic LLM for this call.
    const summarizationSystemMessage = new SystemMessage(SUMMARIZATION_MESSAGE);

    // Craft the content of the HumanMessage that will provide the data to be summarized.
    // We'll try to get the initial user query from messages, falling back to userQuery string if needed.
    const initialUserQueryContent =
        messages.find((msg) => msg instanceof HumanMessage)?.content || userQuery;

    const dataForSummaryPrompt = `
    Based on the following user query and the subsequent analysis results, provide a concise summary of the problems found and potential next steps.
    
    User Query: ${initialUserQueryContent}

    Analysis Results for ${entityType} IDs (${entityIds.join(', ')}):
    - Datadog Errors: ${analysisResults.datadogErrors || 'N/A'}
    - Datadog Warnings: ${analysisResults.datadogWarnings || 'N/A'}
    - History of recent changes: ${analysisResults.entityHistory || 'N/A'}

    Synthesize this information, highlighting critical issues and proposing actionable advice.
  `;

    // Filter out ANY existing SystemMessages from the state.messages array.
    // This is crucial because Anthropic only allows one SystemMessage, and it must be the first.
    // We are explicitly providing the summarizationSystemMessage as the first message for this call.
    const relevantHistoryWithoutSystemMessages = messages.filter(
        (msg) => !(msg instanceof SystemMessage),
    );

    // Construct the final array of messages to send to the Anthropic LLM for this specific invocation.
    const messagesForLLMCall: BaseMessage[] = [
        summarizationSystemMessage, // 1. The specific SystemMessage for summarization
        ...relevantHistoryWithoutSystemMessages, // 2. All previous Human and AI messages from the state
        new HumanMessage(dataForSummaryPrompt), // 3. The current HumanMessage containing data for summarization
    ];

    try {
        console.log('Messages being sent to LLM:', JSON.stringify(messagesForLLMCall, null, 2));
        const response = await summarizerLLM.invoke(messagesForLLMCall); // Invoke the LLM with the correctly structured messages
        const finalSummaryText = response.content;

        // Append the LLM's summary (which is an AIMessage) to the overall state history.
        // Ensure you're appending 'response' directly which is an AIMessage
        const updatedMessages = [...messages, response];

        return {
            finalSummary: finalSummaryText,
            messages: updatedMessages,
        };
    } catch (error) {
        console.error('[Node: summarizeFindings] Error summarizing findings:', error);
        // Provide a fallback summary/message if the LLM call fails
        return {
            finalSummary: 'Failed to generate a summary due to an internal error.',
            messages: [
                ...messages,
                new AIMessage(
                    'I encountered an error while summarizing the findings. Please check the logs.',
                ),
            ],
        };
    }
}
