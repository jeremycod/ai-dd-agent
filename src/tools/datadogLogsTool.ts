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
} from '../model';
import { TIMESTAMP_ASCENDING } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/RUMSort';
import { BaseServerConfiguration } from '@datadog/datadog-api-client/dist/packages/datadog-api-client-common';
import { logger } from '../utils';
import { ApiCaptureWrapper } from '../services/apiCaptureWrapper';

const { LogsApi } = v2;

const DATADOG_API_KEY = process.env.DATADOG_API_KEY;
const DATADOG_APP_KEY = process.env.DATADOG_APP_KEY;
const DATADOG_SITE = process.env.DATADOG_SITE || 'datadoghq.com';

if (!DATADOG_API_KEY || !DATADOG_APP_KEY) {
  logger.error('Datadog API and Application keys are required.');


}

const configuration = client.createConfiguration({
  authMethods: {
    apiKeyAuth: DATADOG_API_KEY,
    appKeyAuth: DATADOG_APP_KEY,
  },
  baseServer: new BaseServerConfiguration(DATADOG_SITE, {}),
});

const logsApi = new LogsApi(configuration);
const apiCapture = new ApiCaptureWrapper();

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
      fromMs = toMs - 3600 * 1000;
  }
  return { fromMs, toMs };
}

export type DatadogLog = v2.Log;
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
    logger.info(
      `Executing getDatadogLogsTool for ${entityType} IDs: ${ids.join(', ')} in ${timeRange}`,
    );
    const { fromMs, toMs } = parseTimeRange(timeRange);

    let ddQuery = `(${ids.join(' OR ')})`;
    if (additionalQuery) {
      ddQuery += ` ${additionalQuery}`;
    }

    try {
      const originalCall = async () => {
        return await logsApi.listLogs({
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
      };
      
      const response = await apiCapture.wrapDatadogCall(
        originalCall,
        ids.join(','),
        timeRange
      );
      
      return {
        datadogLogs: response.data || [],
        message: `Successfully retrieved ${response.data?.length || 0} logs for ${entityType} IDs: ${ids.join(', ')}.`,
      };
    } catch (error) {
      logger.error('Error fetching Datadog logs:', error);
      return {
        datadogLogs: [],
        message: `Error fetching Datadog logs: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

export const analyzeDatadogErrorsTool = new DynamicStructuredTool({
  name: 'analyzeDatadogErrors',
  description:
      'Analyzes a list of Datadog logs to specifically identify and summarize error patterns. Focus on unique error messages, their counts, and affected services/components.',
  schema: AnalyzeDatadogErrorsToolSchema as any,
  func: async ({ logs, ids }: AnalyzeDatadogErrorsToolSchemaInput) => {
    if (logs.length === 0) {
      return 'No error logs provided for analysis.';
    }

    const IGNORED_ERROR_PATTERNS = ['SEQUELIZE_UNKNOWN_ERROR'];

    const trimErrorMessage = (message: string) => {
      return message.split('\n')[0].replace(/Error: |Exception: /g, '').trim();
    };

    const errorsById: { [id: string]: { message: string; exception: string; service: string; timestamp: string }[] } = {};
    const uniqueErrorMessagesById: { [id: string]: Map<string, number> } = {};
    const serviceErrorCountsById: { [id: string]: { [key: string]: number } } = {};


    const idsToSearch = Array.isArray(ids) && ids.length > 0 ? ids : [];

    for (const log of logs) {
      const message = log.attributes?.message || 'No message';
      const exception =
          log.attributes?.exception && log.attributes.exception.trim() !== ''
              ? log.attributes.exception
              : log.attributes?.additionalAttributes?.attributes?.exception || 'No exception';

      const status = log.attributes?.status;
      const service = log.attributes?.service || 'unknown_service';

      let logId: string = '_no_id_';

      const attributeId = log.attributes?.id || log.attributes?.['offer_id'] || log.attributes?.['campaign_id'] || log.attributes?.['entity_id'];
      if (attributeId && idsToSearch.includes(attributeId)) {
        logId = attributeId;
      } else {
        for (const searchId of idsToSearch) {
          const idRegex = new RegExp(`\\b${searchId}\\b|${searchId}`, 'i');
          if (message.includes(searchId) || idRegex.test(message) || exception.includes(searchId)) {
            logId = searchId;
            break;
          }
        }
      }
      if (!errorsById[logId]) {
        errorsById[logId] = [];
        uniqueErrorMessagesById[logId] = new Map<string, number>();
        serviceErrorCountsById[logId] = {};
      }

      if (
          status &&
          (status.toLowerCase() === 'error' ||
              status.toLowerCase() === 'critical' ||
              status.toLowerCase() === 'emergency' ||
              message.toLowerCase().includes('error'))
      ) {
        const shouldIgnore = IGNORED_ERROR_PATTERNS.some(pattern => 
          message.includes(pattern) || exception.includes(pattern)
        );
        if (shouldIgnore) continue;
        const trimmedException = trimErrorMessage(exception);
        errorsById[logId].push({ message, service, exception: trimmedException, timestamp: log.attributes?.timestamp });

        let keyParts: string[] = [];

        if (exception.trim() !== '' && exception.trim().toLowerCase() !== 'no exception') {
          const exceptionKey = trimmedException.split('\n')[0].substring(0, 150).trim();
          keyParts.push(`[EXC]${exceptionKey}`);
        } else {
          keyParts.push('[EXC]NoException');
        }

        const trimmedMessage = message.split('\n')[0].substring(0, 200);
        keyParts.push(`[MSG]${trimmedMessage}`);

        const compositeKey = keyParts.join('::');

        uniqueErrorMessagesById[logId].set(compositeKey, (uniqueErrorMessagesById[logId].get(compositeKey) || 0) + 1);
        serviceErrorCountsById[logId][service] = (serviceErrorCountsById[logId][service] || 0) + 1;
      }
    }

    let overallSummary = '';
    const allProcessedIds = Object.keys(errorsById).filter(id => errorsById[id].length > 0);

    if (allProcessedIds.length === 0) {
      return 'No critical errors found within the provided logs for the specified IDs.';
    }

    for (const id of allProcessedIds) {
      const idErrors = errorsById[id];
      const idUniqueErrors = uniqueErrorMessagesById[id];
      const idServiceCounts = serviceErrorCountsById[id];

      overallSummary += `\n---\n## Errors for ID: ${id === '_no_id_' ? 'Logs without a specific recognized ID' : id} (${idErrors.length} errors)\n\n`;

      overallSummary += '### Top unique error messages (count: message::exception):\n';
      Array.from(idUniqueErrors.entries())
          .sort(([, countA], [, countB]) => countB - countA)
          .slice(0, 5)
          .forEach(([msg, count]) => {
            overallSummary += `- ${count}: "${msg}"\n`;
          });

      overallSummary += '\n### Errors by service:\n';
      for (const service in idServiceCounts) {
        overallSummary += `- ${service}: ${idServiceCounts[service]} errors\n`;
      }
    }

    return overallSummary;
  },
});

export const analyzeDatadogWarningsTool = new DynamicStructuredTool({
  name: 'analyzeDatadogWarnings',
  description:
      'Analyzes a list of Datadog logs to identify and summarize warning patterns. Focus on unique warning messages, their counts, and affected services/components.',
  schema: AnalyzeDatadogWarningsToolSchema as any,
  func: async ({ logs, ids }: AnalyzeDatadogWarningsToolSchemaInput) => {
    if (logs.length === 0) {
      return 'No warning logs provided for analysis.';
    }

    const trimErrorMessage = (message: string) => {
      return message.split('\n')[0].replace(/Error: |Exception: /g, '').trim();
    };

    const warningsById: { [id: string]: { message: string; exception: string; service: string; timestamp: string }[] } = {};
    const uniqueWarningMessagesById: { [id: string]: Map<string, number> } = {};
    const serviceWarningCountsById: { [id: string]: { [key: string]: number } } = {};

    const idsToSearch = Array.isArray(ids) && ids.length > 0 ? ids : [];

    for (const log of logs) {
      const message = log.attributes?.message || 'No message';
      const exception =
          log.attributes?.exception && log.attributes.exception.trim() !== ''
              ? log.attributes.exception
              : log.attributes?.additionalAttributes?.attributes?.exception || 'No exception';
      const status = log.attributes?.status;
      const service = log.attributes?.service || 'unknown_service';

      let logId: string = '_no_id_';

      const attributeId = log.attributes?.id || log.attributes?.['offer_id'] || log.attributes?.['campaign_id'] || log.attributes?.['entity_id'];
      if (attributeId && idsToSearch.includes(attributeId)) {
        logId = attributeId;
      } else {
        for (const searchId of idsToSearch) {
          const idRegex = new RegExp(`\\b${searchId}\\b|${searchId}`, 'i');
          if (message.includes(searchId) || idRegex.test(message) || exception.includes(searchId)) {
            logId = searchId;
            break;
          }
        }
      }
      if (!warningsById[logId]) {
        warningsById[logId] = [];
        uniqueWarningMessagesById[logId] = new Map<string, number>();
        serviceWarningCountsById[logId] = {};
      }

      if (status && (status.toLowerCase() === 'warn' || message.toLowerCase().includes('warn'))) {
        const trimmedException = trimErrorMessage(exception);
        warningsById[logId].push({ message, exception: trimmedException, service, timestamp: log.attributes?.timestamp });

        let keyParts: string[] = [];

        if (exception.trim() !== '' && exception.trim().toLowerCase() !== 'no exception') {
          const exceptionKey = trimmedException.split('\n')[0].substring(0, 150).trim();
          keyParts.push(`[EXC]${exceptionKey}`);
        } else {
          keyParts.push('[EXC]NoException');
        }

        const trimmedMessage = message.split('\n')[0].substring(0, 200);
        keyParts.push(`[MSG]${trimmedMessage}`);

        const compositeKey = keyParts.join('::');

        uniqueWarningMessagesById[logId].set(compositeKey, (uniqueWarningMessagesById[logId].get(compositeKey) || 0) + 1);
        serviceWarningCountsById[logId][service] = (serviceWarningCountsById[logId][service] || 0) + 1;
      }
    }

    let overallSummary = '';
    const allProcessedIds = Object.keys(warningsById).filter(id => warningsById[id].length > 0);

    if (allProcessedIds.length === 0) {
      return 'No significant warnings found within the provided logs for the specified IDs.';
    }

    for (const id of allProcessedIds) {
      const idWarnings = warningsById[id];
      const idUniqueWarnings = uniqueWarningMessagesById[id];
      const idServiceCounts = serviceWarningCountsById[id];

      overallSummary += `\n---\n## Warnings for ID: ${id === '_no_id_' ? 'Logs without a specific recognized ID' : id} (${idWarnings.length} warnings)\n\n`;

      overallSummary += '### Top unique warning messages (count: message::exception):\n';
      Array.from(idUniqueWarnings.entries())
          .sort(([, countA], [, countB]) => countB - countA)
          .slice(0, 5)
          .forEach(([msg, count]) => {
            overallSummary += `- ${count}: "${msg}"\n`;
          });

      overallSummary += '\n### Warnings by service:\n';
      for (const service in idServiceCounts) {
        overallSummary += `- ${service}: ${idServiceCounts[service]} warnings\n`;
      }
    }

    return overallSummary;
  },
});