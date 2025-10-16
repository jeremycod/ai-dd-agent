
import { z } from 'zod';
import {
  ENTITY_TYPE_VALUES,
  QUERY_CATEGORY_VALUES,
  ENVIRONMENT_TYPE_VALUES,
} from './types/general';

export const UserQueryExtractionSchema = z.object({
  category: z.enum(QUERY_CATEGORY_VALUES).describe("The predicted category of the user's query."),
  entityIds: z
    .array(z.string())
    .describe('Array of identified entity IDs. Can be empty if no IDs are found.'),
  entityType: z
    .enum(ENTITY_TYPE_VALUES)
    .describe("Type of the entity. Defaults to 'unknown' if not specified."),
  environment: z
    .enum(ENVIRONMENT_TYPE_VALUES)
    .describe(
      "The target environment for the investigation. Must be 'production', 'staging', 'development', or 'unknown' if not specified.",
    ),
  timeRange: z
    .string()
    .optional()
    .describe(
      "Optional: Time range for the investigation (e.g., '1h', '24h', '7d', '2025-07-01 to 2025-07-03'). Defaults to '24h' if not found.",
    ),
  initialResponse: z
    .string()
    .describe(
      "The agent's initial acknowledgment or plan, following the category, which will be the first message to the user.",
    ),

});

export type UserQueryExtraction = z.infer<typeof UserQueryExtractionSchema>;

export const GetEntityHistoryToolSchema = z.object({
  ids: z
    .array(z.string())
    .describe('IDs of specific entity (campaign, offer, or sku IDs) to retrieve history by.'),
  environment: z
    .enum(ENVIRONMENT_TYPE_VALUES)
    .describe(
      "Environment for which we are to retrieve entity history (e.g. 'production' or 'prod', 'staging' or 'qa', 'development' or 'dev'.",
    ),
  entityType: z
    .enum(ENTITY_TYPE_VALUES)
    .describe("The type of entity being investigated (e.g., 'campaign', 'offer', 'sku' )."),
  limit: z.number().optional().default(10).describe('The maximum history records (default: 10).'),
});

export type GetEntityHistoryToolSchemaInput = z.infer<typeof GetEntityHistoryToolSchema>;

export const GetDataDogLogsToolSchema = z.object({
  ids: z
    .array(z.string())
    .describe('An array of specific IDs (campaign, offer, or product IDs) to filter logs by.'),
  entityType: z
    .enum(ENTITY_TYPE_VALUES)
    .describe(
      "The type of entity being investigated (e.g., 'campaign', 'offer', 'product', or 'general' if not specific).",
    ),
  timeRange: z
    .string()
    .describe(
      "The time range for the query (e.g., '1h' for last hour, '24h' for last 24 hours, '5m' for 5 minutes).",
    ),
  additionalQuery: z
    .string()
    .optional()
    .describe(
      "Any additional Datadog log search query string (e.g., 'service:my-app', 'message:\"failed to connect\"').",
    ),
  limit: z
    .number()
    .optional()
    .default(500)
    .describe('The maximum number of logs to retrieve (default: 500).'),
});

export type GetDataDogLogsToolSchemaInput = z.infer<typeof GetDataDogLogsToolSchema>;

export const AnalyzeDatadogWarningsToolSchema = z.object({
  logs: z.array(z.any()).describe('An array of Datadog log objects to analyze.'),
  ids: z
      .array(z.string())
      .describe('An array of specific IDs (campaign, offer, or product IDs) to filter logs by.'),
});

export type AnalyzeDatadogWarningsToolSchemaInput = z.infer<
  typeof AnalyzeDatadogWarningsToolSchema
>;

export const AnalyzeDatadogErrorsToolSchema = z.object({
  logs: z.array(z.any()).describe('An array of Datadog log objects to analyze.'),
  ids: z
      .array(z.string())
      .describe('An array of specific IDs (campaign, offer, or product IDs) to filter logs by.'),
});

export type AnalyzeDatadogErrorsToolSchemaInput = z.infer<typeof AnalyzeDatadogErrorsToolSchema>;

const DifferenceSchema = z.object({
  fieldName: z
    .string()
    .describe("The name of the field that was changed, e.g., 'attributes -> startDate'"),
  oldValue: z
    .string()
    .nullable()
    .describe('The old value of the field before the change. Can be null or empty string.'),
  newValue: z
    .string()
    .nullable()
    .describe('The new value of the field after the change. Can be null or empty string.'),
});

const EntityHistoryRecordSchema = z.object({
  fromVersion: z.number().describe('The version number before the change.'),
  toVersion: z.number().describe('The version number after the change.'),
  author: z.string().describe('The author who made the change.'),
  datetime: z.string().datetime().describe('ISO 8601 timestamp of when the change occurred.'),
  differences: z
    .array(DifferenceSchema)
    .describe('An array of specific differences in this version change.'),
});

export const AnalyzeEntityHistoryToolInputSchema = z.object({
  entityHistory: z
    .array(EntityHistoryRecordSchema)
    .describe('An array of entity history records to analyze.'),
  currentTime: z
    .string()
    .datetime()
    .optional()
    .describe(
      "The current timestamp in ISO 8601 format (e.g., '2025-07-04T16:00:00Z'). Defaults to current time if not provided. Useful for determining if dates are in the past/future relative to a reference.",
    ),
});
export type AnalyzeEntityHistoryToolInputSchemaInput = z.infer<
  typeof AnalyzeEntityHistoryToolInputSchema
>;


export const GetUPSOfferPriceToolSchema = z.object({
  offerId: z.string().describe('The unique identifier of the offer.'),
  environment: z.enum(['production', 'staging', 'development']).describe('The environment.'),
});

export type GetUPSOfferPriceToolSchemaInput = z.infer<typeof GetUPSOfferPriceToolSchema>;


export const OfferPriceOutputSchema = z.object({
  offerId: z.string(),
  price: z.object({
    amount: z.number(),
    currency: z.string(),
  }),



});
export type OfferPriceOutput = z.infer<typeof OfferPriceOutputSchema>;

export const AnalyzeUPSOfferPriceToolInputSchema = z.object({
  offerPriceDetails: z.array(z.any()),



});

export type AnalyzeUPSOfferPriceToolInput = z.infer<typeof AnalyzeUPSOfferPriceToolInputSchema>;



export const GetGenieOfferToolSchema = z.object({
  offerId: z.string().describe('The unique identifier of the offer to retrieve.'),
  environment: z
    .enum(['production', 'staging', 'development', 'unknown'])
    .describe(
      'The environment (e.g., "production", "staging", "development") where the offer resides.',
    ),
});


export type GetGenieOfferToolSchemaInput = z.infer<typeof GetGenieOfferToolSchema>;

export const GetOfferServiceOfferToolSchema = z.object({
  offerId: z.string().describe('The unique identifier of the offer to retrieve.'),
  environment: z
    .enum(['production', 'staging', 'development', 'unknown'])
    .describe(
      'The environment (e.g., "production", "staging", "development") where the offer resides.',
    ),
});

export type GetOfferServiceOfferToolSchemaInput = z.infer<typeof GetOfferServiceOfferToolSchema>;

export const CompareOffersToolSchema = z.object({
  offerId: z.string().describe("The ID of the offer being compared."),
  offerServiceOffer: z.any().nullable().describe("The full Offer object from Offer Service, or null if not found."),
  genieOffer: z.any().nullable().describe("The full Offer object from Genie, or null if not found."),
  offerPriceDetails: z.any().nullable().optional().describe("The UPS offer price details for price comparison, or null if not available."),
});

export type CompareOffersToolSchemaInput = z.infer<typeof CompareOffersToolSchema>;
