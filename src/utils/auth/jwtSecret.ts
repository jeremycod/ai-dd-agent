// src/utils/auth/jwtSecret.ts
import { importJWK, type JWK } from 'jose'; // Still good

const JWT_JWK_STRING =
  process.env.GENIE_JWT_JWK ||
  '{"kty":"oct","k":"7Og6VnjjEtbcMb_OpGksOtstSZvMzsv0QTKcmAAsuFo","alg":"A256GCM"}';

// Type this as Uint8Array, as importJWK for 'oct' keys returns Uint8Array in jose v5.
// We will then explicitly cast the result of importJWK to Uint8Array.
let _jwtSecretKey: Uint8Array | undefined;

/**
 * Loads the symmetric key from the provided JWK string.
 * This should be called once at application startup.
 */
export const loadSymmetricKey = async () => {
  try {
    const jwk: JWK = JSON.parse(JWT_JWK_STRING);
    // Explicitly cast the result of importJWK to Uint8Array.
    // This tells TypeScript "I know what I'm doing here, this will be a Uint8Array".
    _jwtSecretKey = (await importJWK(jwk, 'HS256')) as Uint8Array;
    console.log('JWT symmetric key loaded successfully from JWK.');
  } catch (error) {
    console.error('Failed to load JWT symmetric key from JWK:', error);
    throw new Error('Critical: Failed to load JWT symmetric key for signing.');
  }
};

export const getSymmetricKey = (): Uint8Array => {
  if (!_jwtSecretKey) {
    throw new Error('JWT symmetric key not loaded. Call loadSymmetricKey() first.');
  }
  return _jwtSecretKey;
};

export const JWT_ISSUER = process.env.JWT_ISSUER || 'your-node-app-issuer';
export const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'your-graphql-api';
export const JWT_EXPIRATION_TIME_SECONDS = 24 * 60 * 60;
