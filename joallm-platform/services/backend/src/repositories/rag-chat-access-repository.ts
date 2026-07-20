import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../database/connection.js';
import { chatSessions, files } from '../database/schema.js';

export type ChatSessionAccessRecord = {
  id: string;
  userId: string | null;
};

export class RagChatAccessRepository {
  async getAccessibleDocumentIds(documentIds: string[], userId: string): Promise<string[]> {
    if (documentIds.length === 0) {
      return [];
    }

    const ownedFiles = await db
      .select({ id: files.id })
      .from(files)
      .where(and(inArray(files.id, documentIds), eq(files.userId, userId)));

    return ownedFiles.map((file) => file.id);
  }

  async findChatSessionById(sessionId: string): Promise<ChatSessionAccessRecord | null> {
    const [session] = await db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
      })
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);

    return session || null;
  }

  async findOwnedChatSessionById(sessionId: string, userId: string): Promise<ChatSessionAccessRecord | null> {
    const [session] = await db
      .select({
        id: chatSessions.id,
        userId: chatSessions.userId,
      })
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
      .limit(1);

    return session || null;
  }
}

export const ragChatAccessRepository = new RagChatAccessRepository();
