import { createLogger, format, transports } from 'winston';

const javaStyleFormat = format.printf(({ level, message, timestamp }) => {
    return `{${timestamp}} [${level.toUpperCase()}] ${message}`;
});

export const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        javaStyleFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'app.log' })
    ],
});