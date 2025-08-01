import { createLogger, format, transports } from 'winston';

const javaStyleFormat = format.printf(({ level, message, timestamp, ...meta }) => {
  let logMessage = `{${timestamp}} [${level.toUpperCase()}] ${message}`;
  
  // Add any additional metadata as JSON
  if (Object.keys(meta).length > 0) {
    logMessage += ` ${JSON.stringify(meta, null, 2)}`;
  }
  
  return logMessage;
});

export const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.splat(), // Enable string interpolation
    format.errors({ stack: true }), // Handle error objects
    javaStyleFormat
  ),
  transports: [new transports.Console(), new transports.File({ filename: 'app.log' })],
});
