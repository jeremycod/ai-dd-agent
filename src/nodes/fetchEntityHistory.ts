import {AgentState} from "../model/agentState";
import {AIMessage} from "@langchain/core/messages";
import {getEntityHistoryTool} from "../tools/entityHistoryTools";
import {EntityHistory} from "../model/history";

export async function fetchEntityHistory(
    state: AgentStateAnnotation.State,
): Promise<Partial<AgentState>> {
    console.log('[Node: fetchEntityHistory] Fetching entity history...');
    const { entityIds, entityType, environment, messages } = state;
    if (entityIds.length === 0) {
        console.warn('[Node: fetchEntityHistory] No entity IDs to fetch history for.');
        return {
            entityHistory: [],
            messages: [
                ...messages,
                new AIMessage('Could not fetch Entity History as no specific IDs were identified.'),
            ],
        };
    }
    // Call the getEntityHistory tool
    const toolCallResult = await getEntityHistoryTool.invoke({
        ids: entityIds,
        environment: environment,
        entityType: entityType,
        limit: 10,
    });

    // LangGraph expects `messages` to be appended and the next step can use it
    // For this pattern, we want to store the actual logs separately for analysis.
    return {
        entityHistory: (toolCallResult as { history: EntityHistory[] }).history,
        messages: [
            ...messages,
            new AIMessage('Fetched Entity History. Proceeding to parallel analysis.'),
        ], // Add tool output to history for LLM context
    };
}