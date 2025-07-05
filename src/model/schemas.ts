// schemas.ts (or wherever you keep your Zod schemas)
import { z } from 'zod';

export const UserQueryExtractionSchema = z.object({
  entityIds: z
    .array(z.string())
    .describe('Array of identified entity IDs. Can be empty if no IDs are found.'),
  entityType: z
    .enum(['campaign', 'offer', 'product', 'sku', 'unknown'])
    .describe("Type of the entity. Defaults to 'unknown' if not specified."),
  environment: z
    .enum(['production', 'staging', 'development', 'unknown'])
    .describe(
      "The target environment for the investigation. Must be 'production', 'staging', 'development', or 'unknown' if not specified.",
    ),
  timeRange: z
    .string()
    .optional()
    .describe(
      "Optional: Time range for the investigation (e.g., '1h', '24h', '7d', '2025-07-01 to 2025-07-03'). Defaults to '24h' if not found.",
    ),
  // Add other fields you might want to extract from the query
});

export type UserQueryExtraction = z.infer<typeof UserQueryExtractionSchema>;
