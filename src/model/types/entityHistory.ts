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

export type EntityHistoryResponse = {
  // Renamed from EntityHistory to avoid confusion with AgentState property
  versions: Version[];
};
