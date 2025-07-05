import {AgentState} from "../model/agentState";
import {AIMessage} from "@langchain/core/messages";

export async function respondToUser(state: AgentState): Promise<Partial<AgentState>> {
    console.log('[Node: respondToUser] Entering...');
    // This node just takes the final summary and potentially adds a concluding message
    const finalMessageContent =
        state.finalSummary ||
        "I'm sorry, I couldn't fully analyze the situation. Please try rephrasing your request or provide more details.";
    return {
        messages: [...state.messages, new AIMessage(finalMessageContent)],
    };
}