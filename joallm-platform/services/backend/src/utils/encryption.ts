import crypto from 'crypto';
import { config } from '../config/config.js';
import { logger } from './logger.js';

/**
 * Encryption utility for sensitive data storage
 * Uses AES-256-GCM for encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derive encryption key from master key using PBKDF2
 */
function deriveKey(masterKey: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    masterKey,
    salt,
    ITERATIONS,
    KEY_LENGTH,
    'sha512'
  );
}

/**
 * Encrypt sensitive data
 * @param text - Plain text to encrypt
 * @returns Encrypted text in format: salt:iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  try {
    if (!text || text.trim() === '') {
      return '';
    }

    const masterKey = config.encryptionKey;
    if (!masterKey) {
      throw new Error('Encryption key not configured');
    }

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Derive key from master key
    const key = deriveKey(masterKey, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return format: salt:iv:authTag:encryptedData
    return [
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted
    ].join(':');

  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 * @param encryptedText - Encrypted text in format: salt:iv:authTag:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  try {
    if (!encryptedText || encryptedText.trim() === '') {
      return '';
    }

    const masterKey = config.encryptionKey;
    if (!masterKey) {
      throw new Error('Encryption key not configured');
    }

    // Parse encrypted data
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted data format');
    }

    const [saltHex, ivHex, authTagHex, encrypted] = parts;

    // Convert from hex
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    // Derive key from master key
    const key = deriveKey(masterKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt an object of API keys
 * @param apiKeys - Object containing API keys
 * @returns Object with encrypted API keys
 */
export function encryptApiKeys(apiKeys: Record<string, string | undefined>): Record<string, string> {
  const encrypted: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(apiKeys)) {
    if (value && value.trim() !== '') {
      encrypted[key] = encrypt(value);
    }
  }
  
  return encrypted;
}

/**
 * Decrypt an object of API keys
 * @param encryptedApiKeys - Object containing encrypted API keys
 * @returns Object with decrypted API keys
 */
export function decryptApiKeys(encryptedApiKeys: Record<string, string | undefined>): Record<string, string | undefined> {
  const decrypted: Record<string, string | undefined> = {};
  
  for (const [key, value] of Object.entries(encryptedApiKeys)) {
    if (value && value.trim() !== '') {
      try {
        decrypted[key] = decrypt(value);
      } catch (error) {
        logger.warn(`Failed to decrypt API key for ${key}:`, error);
        decrypted[key] = undefined;
      }
    } else {
      decrypted[key] = undefined;
    }
  }
  
  return decrypted;
}

/**
 * Mask sensitive data for logging
 * @param data - Sensitive data to mask
 * @param visibleChars - Number of characters to show (default: 4)
 * @returns Masked string
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars) {
    return '***';
  }
  return `${data.substring(0, visibleChars)}${'*'.repeat(Math.min(data.length - visibleChars, 20))}`;
}



