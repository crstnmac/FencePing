import crypto from 'crypto';
import { auth } from '../config/index.js';

const ENCRYPTION_KEY = auth.ENCRYPTION_KEY;

const ALGORITHM = 'aes-256-gcm';
const KEY_BUFFER = Buffer.from(ENCRYPTION_KEY, 'hex');

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encryptData(plaintext: string): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
  cipher.setAAD(Buffer.from('geofence-auth', 'utf8'));
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt sensitive data using AES-256-GCM
 */
export function decryptData(encryptedData: EncryptedData): string {
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  decipher.setAAD(Buffer.from('geofence-auth', 'utf8'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt OAuth credentials for secure database storage
 */
export function encryptCredentials(credentials: any): string {
  const plaintext = JSON.stringify(credentials);
  const encrypted = encryptData(plaintext);
  return JSON.stringify(encrypted);
}

/**
 * Decrypt OAuth credentials from database
 */
export function decryptCredentials(encryptedString: string): any {
  try {
    const encryptedData: EncryptedData = JSON.parse(encryptedString);
    const plaintext = decryptData(encryptedData);
    return JSON.parse(plaintext);
  } catch (error) {
    throw new Error('Failed to decrypt credentials');
  }
}

/**
 * Generate cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash sensitive data using SHA-256
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate API key with prefix
 */
export function generateApiKey(prefix: string = 'gf'): { key: string; hash: string } {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const key = `${prefix}_${randomPart}`;
  const hash = hashData(key);
  
  return { key, hash };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}