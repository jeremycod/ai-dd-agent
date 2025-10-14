import * as crypto from 'crypto';
import { logger } from '../logger';

export class CryptoTokenService {
  private static instance: CryptoTokenService;
  private currentToken: string | null = null;
  private tokenExpiryTime: number | null = null;
  private symmetricKey: Buffer | null = null;

  private constructor() {}

  public static initializeInstance(): void {
    if (!CryptoTokenService.instance) {
      CryptoTokenService.instance = new CryptoTokenService();
    }
  }

  public static getInstance(): CryptoTokenService {
    if (!CryptoTokenService.instance) {
      throw new Error('CryptoTokenService not initialized. Call initializeInstance() first.');
    }
    return CryptoTokenService.instance;
  }

  private loadSymmetricKey(): void {
    if (this.symmetricKey) return;
    
    const JWT_JWK_STRING = process.env.GENIE_JWT_JWK;
    if (!JWT_JWK_STRING) {
      throw new Error('GENIE_JWT_JWK environment variable is required');
    }

    try {
      console.log('Raw JWK string:', JWT_JWK_STRING);
      const jwk = JSON.parse(JWT_JWK_STRING);
      // Decode base64url key
      const keyBase64 = jwk.k.replace(/-/g, '+').replace(/_/g, '/');
      this.symmetricKey = Buffer.from(keyBase64, 'base64');
      logger.info('Symmetric key loaded successfully from JWK');
    } catch (error) {
      console.error('Failed to load symmetric key:', error);
      console.error('JWK string type:', typeof JWT_JWK_STRING);
      console.error('JWK string value:', JWT_JWK_STRING);
      throw new Error('Failed to load symmetric key for encryption');
    }
  }

  private async generateNewToken(): Promise<string> {
    this.loadSymmetricKey();
    
    const payload = {
      name: process.env.DEFAULT_JWE_NAME || 'test_user',
      email: process.env.DEFAULT_JWE_EMAIL || 'test@example.com',
      givenname: process.env.DEFAULT_JWE_GIVENNAME || 'Test',
      surname: process.env.DEFAULT_JWE_SURNAME || 'User',
      initials: (process.env.DEFAULT_JWE_GIVENNAME?.charAt(0) || 'T') + (process.env.DEFAULT_JWE_SURNAME?.charAt(0) || 'U'),
      roles: process.env.DEFAULT_JWE_ROLES?.split(',').map(r => r.trim()) || ['USER'],
      profile: process.env.DEFAULT_JWE_PROFILE || 'main',
      expiryDate: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    try {
      // Create JWE using Node.js crypto
      const plaintext = JSON.stringify(payload);
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', this.symmetricKey!, iv);
      
      let encrypted = cipher.update(plaintext, 'utf8', 'base64url');
      encrypted += cipher.final('base64url');
      const authTag = cipher.getAuthTag();

      // Create JWE compact serialization
      const header = {
        alg: 'dir',
        enc: 'A256GCM'
      };
      
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedKey = ''; // Empty for direct encryption
      const encodedIV = iv.toString('base64url');
      const encodedCiphertext = encrypted;
      const encodedTag = authTag.toString('base64url');

      const token = `${encodedHeader}.${encodedKey}.${encodedIV}.${encodedCiphertext}.${encodedTag}`;
      
      this.currentToken = token;
      this.tokenExpiryTime = payload.expiryDate - (5 * 60 * 1000); // 5 min buffer
      
      logger.info('Successfully generated JWE token using Node.js crypto');
      return token;
    } catch (error) {
      logger.error('Error generating JWE token:', error);
      throw new Error(`Failed to generate JWE token: ${error}`);
    }
  }

  private isTokenExpired(): boolean {
    return !this.currentToken || !this.tokenExpiryTime || Date.now() >= this.tokenExpiryTime;
  }

  public async getValidToken(): Promise<string> {
    // Check for manual token override (for API capture mode)
    const manualToken = process.env.GENIE_MANUAL_TOKEN;
    if (manualToken && process.env.CAPTURE_API_RESPONSES === 'true') {
      logger.info('Using manual token override for API capture mode');
      return manualToken;
    }
    
    if (this.isTokenExpired()) {
      logger.info('Generating new JWE token...');
      await this.generateNewToken();
    }
    
    if (!this.currentToken) {
      throw new Error('Could not obtain a valid JWT token');
    }
    
    return this.currentToken;
  }
}

export const loadSymmetricKey = async () => {
  logger.info('Using crypto-based auth');
  return Promise.resolve();
};

export const TokenService = CryptoTokenService;