import { v4 as uuidv4 } from 'uuid';
import { mockDataDogLogs } from './mock-logs';
export class MockLogsApi {
  async searchLogs(id: string): Promise<DataDogResponse> {
    try {
      const rawJson = await mockDataDogLogs(id);
      const parsedJson = JSON.parse(rawJson);

      const processedResponse: DataDogResponse = {
        ...parsedJson,
        data: parsedJson.data.map(
          (log: any): DatadogLog =>
            ({
              attributes: {
                status: log.attributes.status || 'info',
                service: log.attributes.service || 'pageViewService',
                tags: log.attributes.tags || null,
                timestamp: log.attributes.timestamp || '',
                host: log.attributes.host || '',
                attributes: log.attributes || {},
                message: log.attributes.message || '',
              },
              type: log.type || 'log',
              id: log.id || uuidv4(),
            }) as DatadogLog,
        ),
      };
      return processedResponse;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  }
}
