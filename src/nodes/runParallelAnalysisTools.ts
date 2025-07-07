import {AgentStateData} from "../model/agentState";
import {AIMessage} from "@langchain/core/messages";
import {analyzeDatadogErrorsTool, analyzeDatadogWarningsTool} from "../tools/datadogLogsTool";
import {analyzeEntityHistoryTool} from "../tools/entityHistoryTools";

export async function runParallelAnalysisTools(state: AgentStateData): Promise<Partial<AgentStateData>> {
    console.log('[Node: runParallelAnalysisTools] Entering...');
    const { datadogLogs, entityIds, timeRange, messages, entityHistory } = state;

    if (datadogLogs.length === 0 && entityHistory.length === 0) {
        console.log('[Node: runParallelAnalysisTools] No logs to analyze. Skipping parallel tools.');
        return {
            analysisResults: {
                datadogErrors: 'No logs retrieved to check for errors.',
                datadogWarnings: 'No logs retrieved to check for warnings.',
                entityHistory: 'No entity history found',
            },
            messages: [...messages, new AIMessage('No logs were available for detailed analysis.')],
        };
    }

    // Execute multiple tools in parallel
    const [datadogErrorsResult, datadogWarningsResult, entityHistoryResult] = await Promise.all([
        analyzeDatadogErrorsTool.invoke({ logs: datadogLogs }),
        analyzeDatadogWarningsTool.invoke({ logs: datadogLogs }),
        analyzeEntityHistoryTool.invoke({ entityHistory: entityHistory }),
    ]);

    const analysisResults = {
        datadogErrors: datadogErrorsResult,
        datadogWarnings: datadogWarningsResult,
        entityHistory: entityHistoryResult,
    };

    return {
        analysisResults: analysisResults,
        messages: [
            ...messages,
            new AIMessage('Parallel analysis completed. Proceeding to summarizing findings.'),
        ],
    };
}
