export type Difference = {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
};

export type Version = {
  fromVersion: number;
  toVersion: number;
  author: string;
  datetime: string;
  differences: Difference[];
};

export type EntityHistoryResponse = {
  versions: Version[];
};
