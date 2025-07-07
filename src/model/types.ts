export const ENTITY_TYPE_VALUES = ['campaign', 'offer', 'product', 'sku', 'general', 'unknown'] as const;
export const ENVIRONMENT_TYPE_VALUES = ['production', 'staging', 'development', 'unknown'] as const;
export const QUERY_CATEGORY_VALUES = [
    'ENTITY_STATUS',
    'UI_ISSUE',
    'DATA_INCONSISTENCY',
    'DATA_MAPPING',
    'ENTITY_CONFIGURATION',
    'SYSTEM_BEHAVIOR',
    'GENERAL_QUESTION',
    'UNKNOWN_CATEGORY',
    'unclassified'
] as const;

export type EntityType = typeof ENTITY_TYPE_VALUES[number]; // "campaign" | "offer" | ...
export type EnvironmentType = typeof ENVIRONMENT_TYPE_VALUES[number]; // "production" | "staging" | ...
export type QueryCategory = typeof QUERY_CATEGORY_VALUES[number]; // "ENTITY_STATUS" | "UI_ISSUE" | ...


export type Difference = {
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
};

export type Version = {
    fromVersion: number;
    toVersion: number;
    author: string;
    datetime: string; // ISO 8601 date string
    differences: Difference[];
};

export type EntityHistoryResponse = { // Renamed from EntityHistory to avoid confusion with AgentState property
    versions: Version[];
};