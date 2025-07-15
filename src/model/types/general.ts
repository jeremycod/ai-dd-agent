export const ENTITY_TYPE_VALUES = [
  'campaign',
  'offer',
  'product',
  'sku',
  'general',
  'unknown',
] as const;
export const ENVIRONMENT_TYPE_VALUES = ['production', 'staging', 'development', 'unknown'] as const;
export const QUERY_CATEGORY_VALUES = [
  'ENTITY_STATUS',
  'UI_ISSUE',
  'DATA_INCONSISTENCY',
  'DATA_MAPPING',
  'ENTITY_CONFIGURATION',
  'OFFER_PRICE',
  'SYSTEM_BEHAVIOR',
  'GENERAL_QUESTION',
  'UNKNOWN_CATEGORY',
  'unclassified',
] as const;

export type EntityType = (typeof ENTITY_TYPE_VALUES)[number]; // "campaign" | "offer" | ...
export type EnvironmentType = (typeof ENVIRONMENT_TYPE_VALUES)[number]; // "production" | "staging" | ...
export type QueryCategory = (typeof QUERY_CATEGORY_VALUES)[number]; // "ENTITY_STATUS" | "UI_ISSUE" | ...
