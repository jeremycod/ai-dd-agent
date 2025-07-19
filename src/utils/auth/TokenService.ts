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
const EXPIRY_TIME_MS = 24 * 60 * 60 * 1000;
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

  private async generateNewToken(dynamicPayload: Record<string, any> = {}): Promise<string> {
    console.log('[TokenService] Generating new JWE token locally...');

    // Mimic the payload structure from the working consumer's buildJwePayload
    const defaultName = process.env.DEFAULT_JWE_NAME || 'test_user';
    const defaultEmail = process.env.DEFAULT_JWE_EMAIL || 'test@example.com';
    const defaultGivenname = process.env.DEFAULT_JWE_GIVENNAME || 'Test';
    const defaultSurname = process.env.DEFAULT_JWE_SURNAME || 'User';
    const defaultRolesString = process.env.DEFAULT_JWE_ROLES || 'USER';
    const defaultRoles = defaultRolesString.split(',').map(role => role.trim()).filter(role => role.length > 0);
    const defaultProfile = process.env.DEFAULT_JWE_PROFILE || 'main';


    const jwePayload = {
      name: dynamicPayload.name || defaultName,
      email: dynamicPayload.email || defaultEmail,
      givenname: dynamicPayload.givenname || defaultGivenname,
      surname: dynamicPayload.surname || defaultSurname,
      // Initials will still be derived dynamically
      initials: (dynamicPayload.givenname?.charAt(0) || defaultGivenname.charAt(0)) +
          (dynamicPayload.surname?.charAt(0) || defaultSurname.charAt(0)),
      roles: dynamicPayload.roles || defaultRoles, // Use the parsed default roles array
      profile: dynamicPayload.profile || defaultProfile,
      expiryDate: new Date(Date.now() + EXPIRY_TIME_MS).valueOf(), // Milliseconds
      // If backend expects jti, you might add: jti: uuidv4(),
    };

    let token: string;
    try {
      const symmetricKey = getSymmetricKey();

      console.log('JWE Plaintext Payload (JSON string) being encrypted:', jwePayload);
      console.log('Symmetric Key (bytes):', symmetricKey.byteLength);

      token = await new jose.CompactEncrypt(
          new TextEncoder().encode(JSON.stringify(jwePayload)) // Plaintext is the stringified JSON object
      )
          .setProtectedHeader({
            alg: 'dir',    // Key Management Algorithm: Direct Encryption
            enc: 'A256GCM', // Content Encryption Algorithm: AES GCM using 256-bit key
            // typ: 'JWT', // REMOVED: If the inner payload is just a JSON, not a full JWT
            // If backend's AuthenticationCommon does not parse this as a full JWT,
            // then 'typ: JWT' would be incorrect and cause issues.
          })
          .encrypt(symmetricKey);

      this.currentToken = token;
      // Note: Token expiry time now based on 'expiryDate' in payload, not standard 'exp'
      this.tokenExpiryTime = jwePayload.expiryDate - 5 * 60 * 1000; // 5 minutes buffer
      setToken(token);
      console.log('[TokenService] Successfully generated and set new JWE token.');
      console.log('Generated JWE Token:', token);

      // --- Client-side self-verification (Crucial for debugging) ---
      try {
        // For jwtDecrypt to work, the inner content must actually be a valid JWT
        // with standard claims (iss, aud, exp, iat).
        // Since your backend's buildJwePayload doesn't include these standard JWT claims,
        // we need to use generic decrypt if we want to confirm the raw JSON payload.
        const { plaintext, protectedHeader } = await jose.compactDecrypt(token, symmetricKey);
        const decryptedJson = JSON.parse(new TextDecoder().decode(plaintext)); // Decode bytes to string, then parse JSON

        console.log('CLIENT-SIDE SELF-DECRYPTION SUCCESSFUL!');
        console.log('Decrypted Header:', protectedHeader);
        console.log('Decrypted Plaintext (JSON Object):', decryptedJson);
        if (!decryptedJson.name || !decryptedJson.profile || !decryptedJson.roles || !decryptedJson.expiryDate) {
          console.error('CRITICAL: Decrypted claims are missing expected fields (name, profile, roles, expiryDate)!');
        }
      } catch (selfDecryptError) {
        console.error('CLIENT-SIDE SELF-DECRYPTION FAILED! This indicates a problem with JWE generation on the client.', selfDecryptError);
      }

      return token;
    } catch (error: any) {
      console.error('[TokenService] Error generating JWE token with symmetric key:', error.message);
      this.currentToken = null;
      this.tokenExpiryTime = null;
      removeToken();
      throw new Error(`Failed to generate JWE token: ${error.message}`);
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
