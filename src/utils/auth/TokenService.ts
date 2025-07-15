// utils/auth/TokenService.ts

import {
  getSymmetricKey,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_EXPIRATION_TIME_SECONDS,
} from './jwtSecret'; // Import the new key loading
import * as jose from 'jose';
import { setToken, getToken, removeToken } from './genie'; // Your in-memory token functions
import { v4 as uuidv4 } from 'uuid';

export class TokenService {
  private static instance: TokenService;
  private currentToken: string | null = null;
  private tokenExpiryTime: number | null = null; // Unix timestamp (milliseconds) when token expires

  private constructor() {
    this.currentToken = getToken();
    // For simplicity, we assume if currentToken exists from `getToken()`, it's valid for initial checks.
    // In a production setup, you might try to decode it and get its expiry.
  }

  public static initializeInstance(): void {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
  }

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      throw new Error(
        'TokenService not initialized. Call TokenService.initializeInstance() first.',
      );
    }
    return TokenService.instance;
  }

  private async generateNewToken(payloadClaims: Record<string, any> = {}): Promise<string> {
    console.log('[TokenService] Generating new JWT token locally with symmetric key...');

    const issuedAt = Math.floor(Date.now() / 1000); // Issued at (Unix timestamp)
    const expirationTime = issuedAt + JWT_EXPIRATION_TIME_SECONDS; // Use the configured expiration

    const claims = {
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: issuedAt,
      exp: expirationTime,
      jti: uuidv4(),
      ...payloadClaims, // Add any dynamic claims
    };

    let token: string;
    try {
      const symmetricKey = getSymmetricKey(); // Get the loaded symmetric key

      token = await new jose.SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' }) // Explicitly set HS256 algorithm
        .sign(symmetricKey); // Sign with the symmetric key

      this.currentToken = token;
      // Set expiry time a bit before actual expiry for proactive refresh
      this.tokenExpiryTime = expirationTime * 1000 - 5 * 60 * 1000; // 5 minutes buffer
      setToken(token); // Update your in-memory token store (which is the `_genieJwtToken` variable)
      console.log('[TokenService] Successfully generated and set new JWT token.');
      return token;
    } catch (error: any) {
      console.error('[TokenService] Error generating JWT token with symmetric key:', error.message);
      this.currentToken = null; // Clear token on failure
      this.tokenExpiryTime = null;
      removeToken();
      throw new Error(`Failed to generate JWT token: ${error.message}`);
    }
  }

  private isTokenExpired(): boolean {
    if (!this.currentToken || !this.tokenExpiryTime || Date.now() >= this.tokenExpiryTime) {
      return true;
    }
    return false;
  }

  public async getValidToken(dynamicClaims?: Record<string, any>): Promise<string> {
    if (this.isTokenExpired()) {
      console.log('[TokenService] Current token expired or missing. Generating new one...');
      await this.generateNewToken(dynamicClaims);
    }
    if (!this.currentToken) {
      throw new Error('Could not obtain a valid JWT token.');
    }
    return this.currentToken;
  }
}
