export type Difference = {
  fieldName: string;
  oldValue: string;
  newValue: string;
};

export type Version = {
  fromVersion: number;
  toVersion: number;
  author: string;
  datetime: string; // ISO 8601 date string
  differences: Difference[];
};

export type EntityHistory = {
  versions: Version[];
};
