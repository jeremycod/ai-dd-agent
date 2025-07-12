
import { client } from '@datadog/datadog-api-client';
import { v2 } from '@datadog/datadog-api-client';

import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  AnalyzeDatadogErrorsToolSchema,
  AnalyzeDatadogErrorsToolSchemaInput,
  AnalyzeDatadogWarningsToolSchema,
  AnalyzeDatadogWarningsToolSchemaInput,
  GetDataDogLogsToolSchema,
  GetDataDogLogsToolSchemaInput,
} from '../model/schemas';
import { TIMESTAMP_ASCENDING } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/RUMSort';
import { BaseServerConfiguration } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-common';
const { LogsApi } = v2;

const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const DATADOG_SITE = process.env.DATADOG_SITE || 'datadoghq.com';

if (!DATADOG_API_KEY || !DATADOG_APP_KEY) {
  console.error('Datadog API and Application keys are required.');
  // In a real app, you might throw or handle this more gracefully
  // process.exit(1);
}

const configuration = client.createConfiguration({
  authMethods: {
    apiKeyAuth: DATADOG_API_KEY,
    appKeyAuth: DATADOG_APP_KEY,
  },
  baseServer: new BaseServerConfiguration(DATADOG_SITE, {}),
});

const logsApi = new LogsApi(configuration);

/**
 * Helper to convert time range string (e.g., "1h", "30m") to milliseconds.
 */
function parseTimeRange(timeRange: string): { fromMs: number; toMs: number } {
  const toMs = Date.now();
  const timeUnit = timeRange.slice(-1);
  const timeValue = parseInt(timeRange.slice(0, -1));

  let fromMs: number;
  switch (timeUnit) {
    case 'm':
      fromMs = toMs - timeValue * 60 * 1000;
      break;
    case 'h':
      fromMs = toMs - timeValue * 3600 * 1000;
      break;
    case 'd':
      fromMs = toMs - timeValue * 24 * 3600 * 1000;
      break;
    default:
      fromMs = toMs - 3600 * 1000; // Default to 1 hour
  }
  return { fromMs, toMs };
}

export type DatadogLog = v2.Log;
// --- Tool 1: Get Datadog Logs ---
export const getDatadogLogsTool = new DynamicStructuredTool({
  name: 'getDatadogLogs',
  description:
    "Fetches logs from Datadog based on a query, time range, and specific entity IDs (campaigns, offers, products). Prioritize 'status:error OR status:warn' in the query.",
  schema: GetDataDogLogsToolSchema as any,
  func: async ({
    ids,
    entityType,
    timeRange,
    additionalQuery,
    limit,
  }: GetDataDogLogsToolSchemaInput) => {
    console.log(
      `Executing getDatadogLogsTool for ${entityType} IDs: ${ids.join(', ')} in ${timeRange}`,
    );
    const { fromMs, toMs } = parseTimeRange(timeRange);

    // Build the Datadog query string
    let ddQuery = `(${ids.join(' OR ')})`;
    if (additionalQuery) {
      ddQuery += ` ${additionalQuery}`;
    }

    try {
      const response = await logsApi.listLogs({
        body: {
          filter: {
            query: ddQuery,
            from: new Date(fromMs).toISOString(),
            to: new Date(toMs).toISOString(),
          },
          page: {
            limit: limit,
          },
          sort: TIMESTAMP_ASCENDING,
        },
      });
      return {
        datadogLogs: response.data || [],
        message: `Successfully retrieved ${response.data?.length || 0} logs for ${entityType} IDs: ${ids.join(', ')}.`,
      };
    } catch (error) {
      console.error('Error fetching Datadog logs:', error);
      return {
        datadogLogs: [],
        message: `Error fetching Datadog logs: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

// --- Tool 2: Analyze Datadog Errors ---
export const analyzeDatadogErrorsTool = new DynamicStructuredTool({
  name: 'analyzeDatadogErrors',
  description:
    'Analyzes a list of Datadog logs to specifically identify and summarize error patterns. Focus on unique error messages, their counts, and affected services/components.',
  schema: AnalyzeDatadogErrorsToolSchema as any,
  func: async ({ logs }: AnalyzeDatadogErrorsToolSchemaInput) => {
    if (logs.length === 0) {
      return 'No error logs provided for analysis.';
    }

    const errors: { message: string; service: string; timestamp: string }[] = [];
    const uniqueErrorMessages = new Map<string, number>();
    const serviceErrorCounts: { [key: string]: number } = {};

    for (const log of logs) {
      const message = log.attributes?.message || 'No message';
      const status = log.attributes?.status;
      const service = log.attributes?.service || 'unknown_service';

      if (
        status.toLowerCase() === 'error' ||
        status === 'critical' ||
        status === 'emergency' ||
        message.toLowerCase().includes('error')
      ) {
        errors.push({ message, service, timestamp: log.attributes?.timestamp });
        const trimmedMessage = message.split('\n')[0].substring(0, 200); // For grouping
        uniqueErrorMessages.set(trimmedMessage, (uniqueErrorMessages.get(trimmedMessage) || 0) + 1);
        serviceErrorCounts[service] = (serviceErrorCounts[service] || 0) + 1;
      }
    }

    if (errors.length === 0) {
      return 'No critical errors found within the provided logs.';
    }

    let summary = `Found ${errors.length} error/critical logs.\n\n`;
    summary += 'Top unique error messages (count: message):\n';
    Array.from(uniqueErrorMessages.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5) // Top 5 unique errors
      .forEach(([msg, count]) => {
        summary += `- ${count}: "${msg}"\n`;
      });

    summary += '\nErrors by service:\n';
    for (const service in serviceErrorCounts) {
      summary += `- ${service}: ${serviceErrorCounts[service]} errors\n`;
    }

    // In a real scenario, this would be more advanced, perhaps using NLP/embeddings to group similar errors
    // or identifying services with sudden error spikes.

    return summary;
  },
});

// --- Tool 3: Analyze Datadog Warnings ---
export const analyzeDatadogWarningsTool = new DynamicStructuredTool({
  name: 'analyzeDatadogWarnings',
  description:
    'Analyzes a list of Datadog logs to identify and summarize warning patterns. Focus on unique warning messages, their counts, and affected services/components.',
  schema: AnalyzeDatadogWarningsToolSchema as any,
  func: async ({ logs }: AnalyzeDatadogWarningsToolSchemaInput) => {
    if (logs.length === 0) {
      return 'No warning logs provided for analysis.';
    }

    const warnings: { message: string; exception: string; service: string; timestamp: string }[] =
      [];
    const uniqueWarningMessages = new Map<string, number>();
    const serviceWarningCounts: { [key: string]: number } = {};

    for (const log of logs) {
      const message = log.attributes?.message || 'No message';
      const exception = log.attributes?.attributes?.exception || 'No exception';
      const status = log.attributes?.status;
      const service = log.attributes?.service || 'unknown_service';

      if (status.toLowerCase() === 'warn' || message.toLowerCase().includes('warn')) {
        warnings.push({ message, exception, service, timestamp: log.attributes?.timestamp });
        let keyParts: string[] = [];

        // Prioritize and include the exception details in the key
        if (exception.trim() !== '' && exception.trim().toLowerCase() !== 'no exception') {
          // Take the first line of the exception and trim it to a reasonable length
          const trimmedException = exception.split('\n')[0].substring(0, 150).trim();
          keyParts.push(`[EXC]${trimmedException}`);
        } else {
          keyParts.push('[EXC]NoException'); // Explicitly state if no meaningful exception
        }

        const trimmedMessage = message.split('\n')[0].substring(0, 200);
        keyParts.push(`[MSG]${trimmedMessage}`);

        // Join the parts to form the composite key
        const compositeKey = keyParts.join('::'); // Example: "[EXC]NullPointer::[MSG]Failed to save data"

        // Create a composite key that includes both the trimmed message and the exception
        // If exception can be null/undefined, handle that (e.g., provide a default string)

        uniqueWarningMessages.set(compositeKey, (uniqueWarningMessages.get(compositeKey) || 0) + 1);
        serviceWarningCounts[service] = (serviceWarningCounts[service] || 0) + 1;
      }
    }

    if (warnings.length === 0) {
      return 'No significant warnings found within the provided logs.';
    }

    let summary = `Found ${warnings.length} warning logs.\n\n`;
    summary += 'Top unique warning messages (count: message::exception):\n';
    Array.from(uniqueWarningMessages.entries())
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 5) // Top 5 unique warnings
      .forEach(([msg, count]) => {
        summary += `- ${count}: "${msg}"\n`;
      });

    summary += '\nWarnings by service:\n';
    for (const service in serviceWarningCounts) {
      summary += `- ${service}: ${serviceWarningCounts[service]} warnings\n`;
    }
    return summary;
  },
});
