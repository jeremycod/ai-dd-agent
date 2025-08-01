import { AgentStateData, DatadogLog } from '../model';
import { logger, generateNewAIMessage } from '../utils';
import { getDatadogLogsTool } from '../tools';
import { v2 } from '@datadog/datadog-api-client';

function mapEnvironmentToTag(environment: string): string {
  const environmentMap: Record<string, string> = {
    production: 'env:prod',
    staging: 'env:qa',
    development: 'env:dev',
  };
  return environmentMap[environment] || 'env:unknown';
}
function generateServiceSubquery(services: string[]): string {
  return `(${services.map((service) => `service:${service}`).join(' OR ')})`;
}

export async function fetchDatadogLogs(state: AgentStateData): Promise<Partial<AgentStateData>> {
  logger.info('[Node: fetchDatadogLogs] Entering...');
  const { entityIds, entityType, timeRange, messages } = state;

  if (entityIds.length === 0) {
    console.warn('[Node: fetchDatadogLogs] No entity IDs to fetch logs for.');
    return {
      datadogLogs: [],
      messages: [
        ...messages,
        generateNewAIMessage('Could not fetch Datadog logs as no specific IDs were identified.'),
      ],
    };
  }
  const services = ['genie', 'genieserver'];
  const subquery = generateServiceSubquery(services);
  // --- MISSING PART: Invoke the tool to get toolCallResult ---
  const environmentQuery = mapEnvironmentToTag(state.environment || 'production'); // Assuming 'environment' is on AgentStateData
  const additionalQuery = `${subquery} ${environmentQuery}`;
  const toolCallResult = await getDatadogLogsTool.invoke({
    ids: entityIds,
    entityType: entityType,
    timeRange: timeRange,
    additionalQuery: additionalQuery,
  });
  // --- END MISSING PART ---

  const mappedDatadogLogs: DatadogLog[] = (toolCallResult.datadogLogs as v2.Log[]).map(
    (log: v2.Log) => {
      const logAttributes = log.attributes || {}; // Ensure attributes is an object, even if undefined

      // --- Logic to determine 'exception' value ---
      let exceptionValue: string = '';
      // Example: If log status is 'error' or 'crit', and message contains "exception" or "error"
      if (logAttributes.status && ['error', 'crit'].includes(logAttributes.status.toLowerCase())) {
        if (logAttributes.message && /(exception|error)/i.test(logAttributes.message)) {
          exceptionValue = logAttributes.message; // Use full message as exception
        } else {
          exceptionValue = `Log status: ${logAttributes.status}`; // Generic exception based on status
        }
      }
      // You could also check other custom fields, e.g.,
      // if (logAttributes.error_details) { exceptionValue = logAttributes.error_details; }
      // --- End exception logic ---

      // Prepare additionalAttributes by excluding known fields
      const { message, status, service, host, tags, timestamp, ...additionalAttrs } = logAttributes;

      return {
        id: log.id,
        type: log.type,
        attributes: {
          status: status || 'unknown',
          service: service || 'unknown',
          tags: tags || [],
          timestamp: timestamp || new Date().toISOString(),
          host: host || 'unknown',
          message: message || '',
          exception: exceptionValue, // Assign the derived exception value
          additionalAttributes: additionalAttrs, // Assign the remaining dynamic attributes
        },
      } as DatadogLog; // Cast the constructed object to DatadogLog
    },
  );
  let summaryMessage = `Datadog logs fetching completed for ${entityIds.length} entities.`;
  if (mappedDatadogLogs.length > 0) {
    summaryMessage += ` Successfully retrieved ${mappedDatadogLogs.length} logs.`;
  }

  return {
    datadogLogs: mappedDatadogLogs,
    messages: [
      ...messages,
      generateNewAIMessage('Fetched Datadog Logs. Proceeding to parallel analysis.'),
    ],
    analysisResults: {
      ...state.analysisResults,
      datadogLogs: summaryMessage,
    },
  };
} // This closing brace was missing for the fetchDatadogLogs function
