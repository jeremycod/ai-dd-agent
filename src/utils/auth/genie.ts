export const getToken = (): string | null => {
  return process.env.JWT_TOKEN || null;
};

import { logger } from '../logger';

export const setToken = (token: string): void => {



  logger.warn(
    'Attempted to set JWT token in a Node.js environment. Consider using environment variables or a secure key-value store.',
  );
  process.env.JWT_TOKEN = token;
};

export const removeToken = (): void => {
  logger.warn(
    'Attempted to remove JWT token from a Node.js environment. Token is usually managed via environment variables or secure stores.',
  );
  delete process.env.JWT_TOKEN;
};
