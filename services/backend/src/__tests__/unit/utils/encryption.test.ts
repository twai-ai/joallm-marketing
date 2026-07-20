import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, encryptApiKeys, decryptApiKeys, maskSensitiveData } from '../../../utils/encryption.js';

describe('Encryption Utils', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'test-api-key-12345';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':');
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different encrypted values for same input', () => {
      const plaintext = 'test-api-key-12345';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const encrypted = encrypt('');
      expect(encrypted).toBe('');
      expect(decrypt('')).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = 'sk-test!@#$%^&*()_+-={}[]|:";\'<>?,./';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'test-key-with-émojis-🔑-and-中文';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid encrypted format', () => {
      expect(() => decrypt('invalid-format')).toThrow('Failed to decrypt data');
    });
  });

  describe('encryptApiKeys and decryptApiKeys', () => {
    it('should encrypt and decrypt API keys object', () => {
      const apiKeys = {
        openai: 'sk-test-openai-key',
        anthropic: 'sk-ant-test-anthropic-key',
        groq: 'gsk_test_groq_key',
      };

      const encrypted = encryptApiKeys(apiKeys);
      const decrypted = decryptApiKeys(encrypted);

      expect(encrypted.openai).not.toBe(apiKeys.openai);
      expect(decrypted.openai).toBe(apiKeys.openai);
      expect(decrypted.anthropic).toBe(apiKeys.anthropic);
      expect(decrypted.groq).toBe(apiKeys.groq);
    });

    it('should handle undefined values', () => {
      const apiKeys = {
        openai: 'sk-test-key',
        anthropic: undefined,
        groq: '',
      };

      const encrypted = encryptApiKeys(apiKeys);
      const decrypted = decryptApiKeys(encrypted);

      expect(decrypted.openai).toBe('sk-test-key');
      expect(decrypted.anthropic).toBeUndefined();
      expect(decrypted.groq).toBeUndefined();
    });

    it('should handle empty object', () => {
      const apiKeys = {};
      const encrypted = encryptApiKeys(apiKeys);
      const decrypted = decryptApiKeys(encrypted);

      expect(encrypted).toEqual({});
      expect(decrypted).toEqual({});
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive data showing only first 4 characters', () => {
      const data = 'sk-1234567890abcdef';
      const masked = maskSensitiveData(data);
      
      // Function masks with up to 20 asterisks max (14 chars remaining = 14 asterisks)
      expect(masked).toBe('sk-1***************');
      expect(masked).toContain('sk-1');
      expect(masked).not.toContain('234567890');
    });

    it('should mask with custom visible characters', () => {
      const data = 'sk-1234567890abcdef';
      const masked = maskSensitiveData(data, 8);
      
      // Function masks with up to 20 asterisks max (10 chars remaining = 10 asterisks)
      expect(masked).toBe('sk-12345***********');
    });

    it('should return *** for short strings', () => {
      const data = 'abc';
      const masked = maskSensitiveData(data);
      
      expect(masked).toBe('***');
    });

    it('should handle empty string', () => {
      const masked = maskSensitiveData('');
      expect(masked).toBe('***');
    });
  });
});

