import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';

const extractException = (log: any): string | null => {
  let attributes = log?.attributes;

  if (typeof attributes === 'string') {
    try {
      attributes = JSON.parse(attributes); // Parse attributes if it's a JSON string
    } catch (error) {
      return null; // Return null if parsing fails
    }
  }

  const exception = attributes?.exception;
  return exception || null; // Return the exception or null
};

export const mockDataDogLogs = async (id: string): Promise<string> => {
  const filePath = path.join(__dirname, '../logs', `${id}.csv`);
  const rows: any[] = [];

  // Read and parse the CSV file
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        rows.push({
          attributes: {
            status: row.status || 'info',
            service: row.Service || 'pageViewService',
            tags: row.tags ? JSON.parse(row.tags) : [],
            timestamp: row.Date,
            host: row.Host || '',
            attributes: {
              hostname: row.Host || '',
              pageViews: row.pageViews,
              user: row.user,
              service: row.Service || '',
              //exception: extractException(row) || '',
            },
            message: row.message || '',
            exception: extractException(row) || '',
          },
          type: 'log',
          id: row.id,
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });

  // Construct the final JSON object
  const result = {
    meta: {
      page: {
        after:
          'eyJhZnRlciI6IkFRQUFBWFVBWGQ5MU05d3lUZ0FBQUFCQldGVkJXR1E1TVZaclFtRnpkRVoyVEc5QlFRIn0',
      },
    },
    data: rows,
    links: {
      next: 'https://api.datadoghq.com/api/v2/logs/events?sort=timestamp&filter%5Bquery%5D=%2A&page%5Bcursor%5D=eyJhZnRlciI6IkFRQUFBWFVBWGQ5MU05d3lUZ0FBQUFCQldGVkJXR1E1TVZaclFtRnpkRVoyVEc5QlFRIn0&filter%5Bfrom%5D=2020-10-07T00%3A00%3A00%2B00%3A00&filter%5Bto%5D=2020-10-07T00%3A15%3A00%2B00%3A00',
    },
  };

  return JSON.stringify(result, null, 2);
};
