

import { getSymmetricKey } from './jwtSecret';
import * as jose from 'jose';
import { setToken, getToken, removeToken } from './genie';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';

const EXPIRY_TIME_MS = 24 * 60 * 60 * 1000;
export class TokenService {
  private static instance: TokenService;
  private currentToken: string | null = null;
  private tokenExpiryTime: number | null = null;

  private constructor() {
    this.currentToken = getToken();


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
    logger.info('[TokenService] Generating new JWE token locally...');


    const defaultName = process.env.DEFAULT_JWE_NAME || 'test_user';
    const defaultEmail = process.env.DEFAULT_JWE_EMAIL || 'test@example.com';
    const defaultGivenname = process.env.DEFAULT_JWE_GIVENNAME || 'Test';
    const defaultSurname = process.env.DEFAULT_JWE_SURNAME || 'User';
    const defaultRolesString = process.env.DEFAULT_JWE_ROLES || 'USER';
    const defaultRoles = defaultRolesString
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0);
    const defaultProfile = process.env.DEFAULT_JWE_PROFILE || 'main';

    const jwePayload = {
      name: dynamicPayload.name || defaultName,
      email: dynamicPayload.email || defaultEmail,
      givenname: dynamicPayload.givenname || defaultGivenname,
      surname: dynamicPayload.surname || defaultSurname,

      initials:
        (dynamicPayload.givenname?.charAt(0) || defaultGivenname.charAt(0)) +
        (dynamicPayload.surname?.charAt(0) || defaultSurname.charAt(0)),
      roles: dynamicPayload.roles || defaultRoles,
      profile: dynamicPayload.profile || defaultProfile,
      expiryDate: new Date(Date.now() + EXPIRY_TIME_MS).valueOf(),

    };

    let token: string;
    try {
      const symmetricKey = getSymmetricKey();

      logger.info('Generating JWE token with payload structure');
      logger.info('Using symmetric key for encryption');

      token = await new jose.CompactEncrypt(
        new TextEncoder().encode(JSON.stringify(jwePayload)),
      )
        .setProtectedHeader({
          alg: 'dir',
          enc: 'A256GCM',



        })
        .encrypt(symmetricKey);

      this.currentToken = token;

      this.tokenExpiryTime = jwePayload.expiryDate - 5 * 60 * 1000;
      setToken(token);
      logger.info('[TokenService] Successfully generated and set new JWE token.');


      try {




        const { plaintext, protectedHeader } = await jose.compactDecrypt(token, symmetricKey);
        const decryptedJson = JSON.parse(new TextDecoder().decode(plaintext));

        logger.info('CLIENT-SIDE SELF-DECRYPTION SUCCESSFUL!');
        if (
          !decryptedJson.name ||
          !decryptedJson.profile ||
          !decryptedJson.roles ||
          !decryptedJson.expiryDate
        ) {
          logger.error(
            'CRITICAL: Decrypted claims are missing expected fields (name, profile, roles, expiryDate)!',
          );
        }
      } catch (selfDecryptError) {
        logger.error(
          'CLIENT-SIDE SELF-DECRYPTION FAILED! This indicates a problem with JWE generation on the client.',
          selfDecryptError,
        );
      }

      return token;
    } catch (error: any) {
      logger.error('[TokenService] Error generating JWE token with symmetric key:', error.message);
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
      logger.info('[TokenService] Current token expired or missing. Generating new one...');
      await this.generateNewToken(dynamicClaims);
    }
    if (!this.currentToken) {
      throw new Error('Could not obtain a valid JWT token.');
    }
    return this.currentToken;
  }
}
