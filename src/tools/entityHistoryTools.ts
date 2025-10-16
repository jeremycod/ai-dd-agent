import { DynamicStructuredTool } from '@langchain/core/tools';
import { DataManagerHistoryClient } from '../clients';
import {
  EnvironmentType,
  Version,
  GetEntityHistoryToolSchema,
  GetEntityHistoryToolSchemaInput,
  AnalyzeEntityHistoryToolInputSchema,
  AnalyzeEntityHistoryToolInputSchemaInput,
} from '../model';
import { logger } from '../utils';

export const getEntityHistoryTool = new DynamicStructuredTool({
  name: 'getEntityHistoryTool',
  description:
    'Fetches history from Data Manager based on a query, environment, entity type, and specific entity ID (campaign, offer, sku). ',
  schema: GetEntityHistoryToolSchema as any,
  func: async ({ ids, environment, entityType, limit }: GetEntityHistoryToolSchemaInput) => {
    logger.info(
      `Executing getEntityHistoryTool for ${entityType} ID: ${ids} for entity ${entityType} in environment ${environment} with limit ${limit}`,
    );

    try {
      const environmentMap: Record<EnvironmentType, 'prod' | 'qa' | 'dev'> = {
        production: 'prod',
        staging: 'qa',
        development: 'dev',
        unknown: 'prod',
      };

      const mappedEnvironment = environmentMap[environment];
      const client = new DataManagerHistoryClient(mappedEnvironment);
      const response: Version[] = await client.fetchEntityHistory(entityType, ids[0], limit);
      return {
        history: response || [],
        message: `Successfully retrieved ${response?.length || 0} history records for ${entityType} IDs: ${ids.join(', ')}.`,
      };
    } catch (error) {
      logger.error('Error fetching entity history:', error);
      return {
        history: [],
        message: `Error fetching entity history: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});


export const analyzeEntityHistoryTool = new DynamicStructuredTool({
  name: 'analyzeEntityHistory',
  description:
    'Analyzes entity history records to find potentially critical changes that could be relevant for issue diagnosis. ' +
    'It identifies changes like start/end date modifications, status changes (e.g., active/inactive), ' +
    "and deletions of fields, while explicitly excluding certain fields (e.g., 'legacy' fields). " +
    'The tool will return a summary of detected critical changes or confirm if no critical changes were found. ' +
    'Provide the full array of entity history records.',
  schema: AnalyzeEntityHistoryToolInputSchema as any,
  func: async ({ entityHistory, currentTime }: AnalyzeEntityHistoryToolInputSchemaInput) => {
    if (!entityHistory || entityHistory.length === 0) {
      return 'No entity history records provided for analysis.';
    }

    const now = currentTime ? new Date(currentTime) : new Date('2025-07-04T16:23:47-07:00');
    const criticalChanges: string[] = [];


    const excludedFieldPrefixes = ['legacy', 'internal_'];
    const excludedExactFieldNames = ['metadata -> lastModifiedDate'];



    for (const record of entityHistory) {

      const changesFoundForRecord: string[] = [];

      for (const diff of record.differences) {
        const { fieldName, oldValue, newValue } = diff;


        if (excludedFieldPrefixes.some((prefix) => fieldName.startsWith(prefix))) {
          logger.info(`DEBUG: Skipping field '${fieldName}' due to excluded prefix.`);
          continue;
        }


        if (excludedExactFieldNames.includes(fieldName)) {
          logger.info(`DEBUG: Skipping field '${fieldName}' due to exact exclusion.`);
          continue;
        }




        if (oldValue !== newValue) {
          let changeDescription = `Field **${fieldName}** changed: from \`${oldValue || 'N/A'}\` to \`${newValue || 'N/A'}\`.`;
          changesFoundForRecord.push(changeDescription);
        }



        if (oldValue && (newValue === null || newValue === '' || newValue === 'Set()')) {
          let deletionDescription = `Field **${fieldName}** was cleared/deleted: old value was \`${oldValue}\`.`;


          if (!changesFoundForRecord.includes(deletionDescription)) {

            changesFoundForRecord.push(deletionDescription);
          }
        }


        if (fieldName.includes('startDate') || fieldName.includes('start_date')) {
          if (newValue && new Date(newValue) > now) {
            changesFoundForRecord.push(
              `   - New start date \`${newValue}\` is in the future, potentially for a scheduled launch.`,
            );
          } else if (newValue && new Date(newValue) <= now) {
            changesFoundForRecord.push(
              `   - New start date \`${newValue}\` is in the past or present, likely making the entity active.`,
            );
          }
        }
        if (fieldName.includes('endDate') || fieldName.includes('end_date')) {
          if (newValue && new Date(newValue) < now) {
            changesFoundForRecord.push(
              `   - New end date \`${newValue}\` is in the past, potentially making the entity inactive.`,
            );
          } else if (newValue && new Date(newValue) >= now) {
            changesFoundForRecord.push(
              `   - New end date \`${newValue}\` is in the future, indicating planned deactivation.`,
            );
          }
        }


        if (fieldName.includes('is_active') || fieldName.includes('status')) {
          if (
            newValue &&
            (newValue.toLowerCase() === 'false' ||
              newValue.toLowerCase() === 'archived' ||
              newValue.toLowerCase() === 'inactive')
          ) {
            changesFoundForRecord.push(
              `   - Entity status changed to an inactive state (\`${newValue}\`). **This is highly critical and could explain an issue.**`,
            );
          } else if (
            newValue &&
            (newValue.toLowerCase() === 'true' ||
              newValue.toLowerCase() === 'published' ||
              newValue.toLowerCase() === 'active')
          ) {
            changesFoundForRecord.push(
              `   - Entity status changed to an active state (\`${newValue}\`).`,
            );
          }
        }



        if (
          fieldName.includes('products') ||
          fieldName.includes('pricing') ||
          fieldName.includes('eligibility')
        ) {

          if (oldValue !== newValue) {
            changesFoundForRecord.push(
              `   - Detected change in critical structure: **${fieldName}** (products/pricing/eligibility). Requires deeper look.`,
            );
          }
        }
      }

      if (changesFoundForRecord.length > 0) {
        criticalChanges.push(`--- Change made (by ${record.author} at ${record.datetime}) ---`);
        criticalChanges.push(...changesFoundForRecord.map((change) => `- ${change}`));
      }
    }

    if (criticalChanges.length === 0) {
      return 'No potentially critical changes identified in the provided entity history records.';
    } else {
      return (
        'Potentially critical changes identified in entity history:\n' + criticalChanges.join('\n')
      );
    }
  },
});
