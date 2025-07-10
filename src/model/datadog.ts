export type DatadogLogAttributes = {
  status: string;
  service: string;
  tags?: string[] | null;
  timestamp: string;
  host: string;
  message: string;
  exception: string; // The specific field you need
  // This 'additionalAttributes' field will capture any other dynamic properties
  // from the Datadog log's 'attributes' that aren't explicitly typed above.
  additionalAttributes: Record<string, any>;
};

// This is your main DatadogLog type
export type DatadogLog = {
  id?: string; // Optional, as it might not always be needed or present
  type?: string; // e.g., 'log', optional
  // The 'attributes' field of your DatadogLog will conform to DatadogLogAttributes
  attributes: DatadogLogAttributes;
  // Any other top-level properties from v2.Log if needed, e.g.,
  // content?: string; // If you want the raw log content here
};
