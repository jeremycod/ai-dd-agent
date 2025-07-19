// src/utils/auth/jwtSecret.ts
import { importJWK, type JWK } from 'jose';
import { logger } from '../logger';

const JWT_JWK_STRING =
  process.env.GENIE_JWT_JWK ||
  '{"kty":"oct","k":"7Og6VnjjEtbcMb_OpGksOtstSZvMzsv0QTKcmAAsuFo","alg":"A256GCM"}';

let _jwtSecretKey: Uint8Array | undefined;

export const loadSymmetricKey = async () => {
  try {
    const jwk: JWK = JSON.parse(JWT_JWK_STRING);
    _jwtSecretKey = (await importJWK(jwk)) as Uint8Array;
    logger.info('JWT symmetric key loaded successfully from JWK.');
    logger.info('Loaded Symmetric Key Byte Length:', _jwtSecretKey.byteLength);
    if (_jwtSecretKey.byteLength !== 32) {
      console.warn(
        'Warning: Symmetric key length is not 32 bytes (256-bit). This might be an issue for A256GCM.',
      );
    }
  } catch (error) {
    logger.error('Failed to load JWT symmetric key from JWK:', error);
    throw new Error('Critical: Failed to load JWT symmetric key for encryption.');
  }
};

export const getSymmetricKey = (): Uint8Array => {
  if (!_jwtSecretKey) {
    throw new Error('JWT symmetric key not loaded. Call loadSymmetricKey() first.');
  }
  return _jwtSecretKey;
};

// REMOVE OR COMMENT OUT THESE, AS THEY ARE NOT USED IN THE PAYLOAD STRUCTURE
// export const JWT_ISSUER = process.env.JWT_ISSUER || 'your-node-app-issuer';
// export const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'your-graphql-api';
// export const JWT_EXPIRATION_TIME_SECONDS = 24 * 60 * 60; // No longer directly used as 'exp'
