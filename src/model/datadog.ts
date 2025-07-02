export type DatadogLog<T = Record<string, any>> = {
  attributes: {
    status: string;
    service: string;
    tags?: string[] | null;
    timestamp: string;
    host: string;
    attributes: T; // This 'attributes' key will hold the specific log attributes
    message: string;
    exception: string;
  };
  type: string;
  id: string;
};

export type DataDogResponse<T = Record<string, any>> = {
  meta?: {
    page: {
      after: string;
    };
  };
  data: DatadogLog<T>[]; // Here's the change: data is now an array of DatadogLog
  links?: {
    next: string;
  };
};
