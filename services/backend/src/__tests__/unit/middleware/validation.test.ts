import { describe, it, expect } from 'vitest';
import { CommonSchemas, SanitizationUtils, ApiKeyValidation, SecurityValidation } from '../../../middleware/validation.js';

describe('Validation Middleware', () => {
  describe('CommonSchemas', () => {
    describe('email validation', () => {
      it('should accept valid email addresses', () => {
        const validEmails = [
          'test@example.com',
          'user.name@example.co.uk',
          'user+tag@example.com',
        ];

        validEmails.forEach(email => {
          expect(() => CommonSchemas.email.parse(email)).not.toThrow();
        });
      });

      it('should reject invalid email addresses', () => {
        const invalidEmails = [
          'not-an-email',
          '@example.com',
          'user@',
          'user @example.com',
        ];

        invalidEmails.forEach(email => {
          expect(() => CommonSchemas.email.parse(email)).toThrow();
        });
      });
    });

    describe('uuid validation', () => {
      it('should accept valid UUIDs', () => {
        const validUuids = [
          '123e4567-e89b-12d3-a456-426614174000',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        ];

        validUuids.forEach(uuid => {
          expect(() => CommonSchemas.uuid.parse(uuid)).not.toThrow();
        });
      });

      it('should reject invalid UUIDs', () => {
        const invalidUuids = [
          'not-a-uuid',
          '123-456-789',
          '123e4567e89b12d3a456426614174000', // Missing dashes
        ];

        invalidUuids.forEach(uuid => {
          expect(() => CommonSchemas.uuid.parse(uuid)).toThrow();
        });
      });
    });
  });

  describe('SanitizationUtils', () => {
    describe('sanitizeHtml', () => {
      it('should escape HTML special characters', () => {
        const input = '<script>alert("XSS")</script>';
        const sanitized = SanitizationUtils.sanitizeHtml(input);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).toContain('&lt;script&gt;');
      });

      it('should escape quotes', () => {
        const input = 'Test "quotes" and \'apostrophes\'';
        const sanitized = SanitizationUtils.sanitizeHtml(input);
        
        expect(sanitized).not.toContain('"');
        expect(sanitized).toContain('&quot;');
        expect(sanitized).toContain('&#x27;');
      });
    });

    describe('sanitizeFilename', () => {
      it('should remove invalid characters', () => {
        const input = 'test<file>:name|?.txt';
        const sanitized = SanitizationUtils.sanitizeFilename(input);
        
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
        expect(sanitized).not.toContain(':');
        expect(sanitized).toMatch(/^[a-zA-Z0-9._-]+$/);
      });

      it('should handle multiple underscores', () => {
        const input = 'test___file___name.txt';
        const sanitized = SanitizationUtils.sanitizeFilename(input);
        
        expect(sanitized).toBe('test_file_name.txt');
      });
    });

    describe('sanitizeQuery', () => {
      it('should trim and normalize whitespace', () => {
        const input = '  test   query   with   spaces  ';
        const sanitized = SanitizationUtils.sanitizeQuery(input);
        
        expect(sanitized).toBe('test query with spaces');
      });

      it('should remove dangerous characters', () => {
        const input = 'test <script> query';
        const sanitized = SanitizationUtils.sanitizeQuery(input);
        
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });

      it('should enforce max length', () => {
        const input = 'a'.repeat(1500);
        const sanitized = SanitizationUtils.sanitizeQuery(input);
        
        expect(sanitized.length).toBeLessThanOrEqual(1000);
      });
    });
  });

  describe('ApiKeyValidation', () => {
    describe('openai validation', () => {
      it('should accept valid OpenAI keys', () => {
        const validKeys = [
          'sk-' + 'a'.repeat(48),
          'sk-proj-' + 'a'.repeat(48),
        ];

        validKeys.forEach(key => {
          expect(ApiKeyValidation.openai(key)).toBe(true);
        });
      });

      it('should reject invalid OpenAI keys', () => {
        const invalidKeys = [
          'invalid-key',
          'sk-short',
          'gsk_' + 'a'.repeat(52), // Groq key format
        ];

        invalidKeys.forEach(key => {
          expect(ApiKeyValidation.openai(key)).toBe(false);
        });
      });
    });

    describe('groq validation', () => {
      it('should accept valid Groq keys', () => {
        const validKey = 'gsk_' + 'a'.repeat(52);
        expect(ApiKeyValidation.groq(validKey)).toBe(true);
      });

      it('should reject invalid Groq keys', () => {
        const invalidKeys = [
          'gsk_short',
          'sk-' + 'a'.repeat(48), // OpenAI format
        ];

        invalidKeys.forEach(key => {
          expect(ApiKeyValidation.groq(key)).toBe(false);
        });
      });
    });

    describe('validateByProvider', () => {
      it('should validate by provider name', () => {
        expect(ApiKeyValidation.validateByProvider('openai', 'sk-' + 'a'.repeat(48))).toBe(true);
        expect(ApiKeyValidation.validateByProvider('groq', 'gsk_' + 'a'.repeat(52))).toBe(true);
      });

      it('should use fallback validation for unknown providers', () => {
        const validKey = 'a'.repeat(30);
        expect(ApiKeyValidation.validateByProvider('unknown', validKey)).toBe(true);
        
        const invalidKey = 'short';
        expect(ApiKeyValidation.validateByProvider('unknown', invalidKey)).toBe(false);
      });
    });
  });

  describe('SecurityValidation', () => {
    describe('validateApiKey', () => {
      it('should accept valid API keys', () => {
        const validKeys = [
          'a'.repeat(32),
          'abc123_-'.repeat(5),
        ];

        validKeys.forEach(key => {
          expect(SecurityValidation.validateApiKey(key)).toBe(true);
        });
      });

      it('should reject invalid API keys', () => {
        const invalidKeys = [
          'short',
          'a'.repeat(200), // Too long
          'key with spaces',
          'key@with#special',
        ];

        invalidKeys.forEach(key => {
          expect(SecurityValidation.validateApiKey(key)).toBe(false);
        });
      });
    });

    describe('validateOrigin', () => {
      it('should validate exact origin matches', () => {
        const allowedOrigins = ['https://example.com', 'https://test.com'];
        
        expect(SecurityValidation.validateOrigin('https://example.com', allowedOrigins)).toBe(true);
        expect(SecurityValidation.validateOrigin('https://other.com', allowedOrigins)).toBe(false);
      });

      it('should validate wildcard patterns', () => {
        const allowedOrigins = ['https://*.example.com'];
        
        expect(SecurityValidation.validateOrigin('https://app.example.com', allowedOrigins)).toBe(true);
        expect(SecurityValidation.validateOrigin('https://api.example.com', allowedOrigins)).toBe(true);
        expect(SecurityValidation.validateOrigin('https://example.com', allowedOrigins)).toBe(false);
      });

      it('should accept wildcard for all origins', () => {
        const allowedOrigins = ['*'];
        
        expect(SecurityValidation.validateOrigin('https://any-domain.com', allowedOrigins)).toBe(true);
      });
    });
  });
});



