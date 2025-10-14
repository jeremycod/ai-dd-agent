export const getToken = (): string | null => {
  return process.env.JWT_TOKEN || null;
};

import { logger } from '../logger';

export const setToken = (token: string): void => {
  // In a server environment, you generally wouldn't "set" a token this way.
  // It would be read from a configuration/environment variable.
  // If you need dynamic setting, consider a more robust solution below.
  logger.warn(
    'Attempted to set JWT token in a Node.js environment. Consider using environment variables or a secure key-value store.',
  );
  process.env.JWT_TOKEN = token; // This will only affect the current process
};

export const removeToken = (): void => {
  logger.warn(
    'Attempted to remove JWT token from a Node.js environment. Token is usually managed via environment variables or secure stores.',
  );
  delete process.env.JWT_TOKEN; // This will only affect the current process
};
