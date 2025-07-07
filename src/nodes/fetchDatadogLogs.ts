import {AgentStateData} from "../model/agentState";
import {AIMessage} from "@langchain/core/messages";
import {getMockDatadogLogsTool} from "../tools/datadogLogsTool";
import {DatadogLog} from "../model/datadog";

export async function fetchDatadogLogs(
    state: AgentStateData,
): Promise<Partial<AgentStateData>> {
    console.log('[Node: fetchDatadogLogs] Entering...');
    const { entityIds, entityType, timeRange, messages } = state;

    if (entityIds.length === 0) {
        console.warn('[Node: fetchDatadogLogs] No entity IDs to fetch logs for.');
        return {
            datadogLogs: [],
            messages: [
                ...messages,
                new AIMessage('Could not fetch Datadog logs as no specific IDs were identified.'),
            ],
        };
    }
    // Call the getDatadogLogs tool
    const toolCallResult = await getMockDatadogLogsTool.invoke({
        ids: entityIds,
        entityType: entityType,
        timeRange: timeRange,
        additionalQuery: `env:prod`, // Always target production, or make this configurable
    });

    // LangGraph expects `messages` to be appended and the next step can use it
    // For this pattern, we want to store the actual logs separately for analysis.
    return {
        datadogLogs: (toolCallResult as { datadogLogs: DatadogLog[] }).datadogLogs,
        messages: [
            ...messages,
            new AIMessage('Fetched Datadog Logs. Proceeding to parallel analysis.'),
        ], // Add tool output to history for LLM context
    };
}