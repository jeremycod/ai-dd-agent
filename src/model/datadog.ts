export type DatadogLogAttributes = {
  status: string;
  service: string;
  tags?: string[] | null;
  timestamp: string;
  host: string;
  message: string;
  exception: string;


  additionalAttributes: Record<string, any>;
};


export type DatadogLog = {
  id?: string;
  type?: string;

  attributes: DatadogLogAttributes;


};
