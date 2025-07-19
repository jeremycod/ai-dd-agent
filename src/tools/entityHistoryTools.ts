import { DynamicStructuredTool } from '@langchain/core/tools';
import { DataManagerHistoryClient } from '../clients/DataManagerHistoryClient';
import { EnvironmentType } from '../model/types/general';
import { Version } from '../model/types/entityHistory';
import {
  GetEntityHistoryToolSchema,
  GetEntityHistoryToolSchemaInput,
  AnalyzeEntityHistoryToolInputSchema,
  AnalyzeEntityHistoryToolInputSchemaInput,
} from '../model/schemas';
import { logger } from '../utils/logger';

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
      const client = new DataManagerHistoryClient(mappedEnvironment); // Initialize the client with the environment
      const response: Version[] = await client.fetchEntityHistory(entityType, ids[0], limit); // Replace with the correct method
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

// Export the tool definition
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

    const now = currentTime ? new Date(currentTime) : new Date('2025-07-04T16:23:47-07:00'); // Use provided current time or the context's time
    const criticalChanges: string[] = [];

    // --- NEW: Define field name prefixes or exact names to EXCLUDE from analysis ---
    const excludedFieldPrefixes = ['legacy', 'internal_']; // Example: 'internal_audit_field'
    const excludedExactFieldNames = ['metadata -> lastModifiedDate']; // Example: Specific field to ignore
    // You could also use regex for more complex patterns:
    // const excludedFieldRegex = /^legacy|internal_/;

    for (const record of entityHistory) {
      // We don't need recordDate if we're not using it for filtering records, only for date diffs
      const changesFoundForRecord: string[] = [];

      for (const diff of record.differences) {
        const { fieldName, oldValue, newValue } = diff;

        // 1. Check for exclusion by prefix
        if (excludedFieldPrefixes.some((prefix) => fieldName.startsWith(prefix))) {
          logger.info(`DEBUG: Skipping field '${fieldName}' due to excluded prefix.`);
          continue;
        }

        // 2. Check for exclusion by exact name
        if (excludedExactFieldNames.includes(fieldName)) {
          logger.info(`DEBUG: Skipping field '${fieldName}' due to exact exclusion.`);
          continue;
        }

        // --- GENERAL CRITICAL CHANGE LOGIC FOR NON-EXCLUDED FIELDS ---

        // Rule A: General change detection (any non-excluded field that changes)
        if (oldValue !== newValue) {
          let changeDescription = `Field **${fieldName}** changed: from \`${oldValue || 'N/A'}\` to \`${newValue || 'N/A'}\`.`;
          changesFoundForRecord.push(changeDescription);
        }

        // Rule B: Check for deletions (oldValue existed, newValue is empty/null/Set())
        // This rule applies to any non-excluded field
        if (oldValue && (newValue === null || newValue === '' || newValue === 'Set()')) {
          let deletionDescription = `Field **${fieldName}** was cleared/deleted: old value was \`${oldValue}\`.`;
          // Add this as a separate, potentially more critical note if it wasn't just a "change"
          // You might want to remove Rule A's description if this is preferred for deletions
          if (!changesFoundForRecord.includes(deletionDescription)) {
            // Avoid duplicates if Rule A already caught it
            changesFoundForRecord.push(deletionDescription);
          }
        }

        // Rule C: Special handling for date fields (applies to any date-like field not excluded)
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

        // Rule D: Special handling for 'is_active' or status fields (applies generally)
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

        // Rule E: Add more specific rules for other "critical by nature" changes
        // Example: If a "products" or "pricing" field is touched, regardless of old/new values, it might be critical
        if (
          fieldName.includes('products') ||
          fieldName.includes('pricing') ||
          fieldName.includes('eligibility')
        ) {
          // This could be further refined by parsing JSON and comparing contents
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
