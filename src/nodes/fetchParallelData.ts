import { AgentState } from '../model/agentState';
import { fetchEntityHistory } from './fetchEntityHistory';
import { fetchDatadogLogs } from './fetchDatadogLogs';


// --- NEW Parallel Node Orchestrator ---
export async function fetchParallelData(
    state: AgentState, // Use your defined AgentState type
): Promise<Partial<AgentState>> {
    console.log('[Node: fetchParallelData] Starting parallel data fetching...');

    // Create promises for both data fetches
    const fetchHistoryPromise = fetchEntityHistory(state);
    const fetchLogsPromise = fetchDatadogLogs(state);

    // Wait for both promises to resolve
    const [historyResult, logsResult] = await Promise.all([fetchHistoryPromise, fetchLogsPromise]);

    console.log('[Node: fetchParallelData] Parallel data fetching complete.');

    // Combine the results from both fetches
    // Ensure that 'messages' from each sub-function are merged correctly.
    // We want to preserve the original messages and then append new ones from both operations.
    const newMessages = [
        ...(historyResult.messages || []), // Ensure it's an array and handle undefined
        ...(logsResult.messages || []),
    ];

    return {
        ...historyResult, // This will bring in entityHistory and its messages
        ...logsResult, // This will bring in datadogLogs and its messages (overwriting historyResult's messages if present)
        messages: [...state.messages, ...newMessages], // Prepend original messages, then append new
    };
}