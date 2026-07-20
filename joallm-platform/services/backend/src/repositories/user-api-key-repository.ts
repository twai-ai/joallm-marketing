import { eq } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { users } from '../database/schema.js';
import { decryptApiKeys } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

export class UserApiKeyRepository {
  async getDecryptedApiKeys(userId: string): Promise<Record<string, string | undefined>> {
    try {
      const user = await db
        .select({ apiKeys: users.apiKeys })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const encryptedKeys = (user[0]?.apiKeys as Record<string, string>) || {};
      return decryptApiKeys(encryptedKeys);
    } catch (error) {
      logger.error('Failed to fetch user API keys:', error);
      return {};
    }
  }
}

export const userApiKeyRepository = new UserApiKeyRepository();
