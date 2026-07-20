import { eq } from 'drizzle-orm';
import { db } from '../../database/connection.js';
import { messages, chatSessions } from '../../database/schema.js';
import { llmService } from '../../services/llm-providers.js';
import { userApiKeyRepository } from '../../repositories/user-api-key-repository.js';
import { generateUniqueShortId } from '../../utils/short-id.js';
import { logger } from '../../utils/logger.js';

export type ChatMessage = {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Array<{ type: 'image' | 'file'; name: string; url: string }>;
};

export type ChatParameters = {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export type ChatInput = {
  messages: ChatMessage[];
  model: string;
  parameters?: ChatParameters;
  sessionId?: string;
  userId?: string;
};

export type ChatOutput = {
  message: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: string;
    model: string;
  };
  sessionId: string;
  shortId: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

export class ChatError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'ChatError';
  }
}

const DEFAULT_PARAMETERS: Required<ChatParameters> = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

async function getOrCreateSession(
  sessionId: string | undefined,
  userId: string | undefined,
  model: string,
  parameters: ChatParameters | undefined,
  firstMessageContent: string
): Promise<{ sessionId: string; shortId: string }> {
  if (sessionId) {
    const existing = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });
    return { sessionId, shortId: existing?.shortId || '' };
  }

  const shortId = await generateUniqueShortId(async (id) => {
    const existing = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.shortId, id),
    });
    return !!existing;
  });

  const [newSession] = await db
    .insert(chatSessions)
    .values({
      shortId,
      userId: userId ?? null,
      model,
      parameters: (parameters ?? null) as any,
      autoTitle: false,
      title: firstMessageContent.substring(0, 50) || 'New Chat',
    })
    .returning({ id: chatSessions.id, shortId: chatSessions.shortId });

  return { sessionId: newSession.id, shortId: newSession.shortId };
}

function buildLlmMessages(msgs: ChatMessage[]): Array<{ role: string; content: string }> {
  return msgs.map((msg) => {
    let content = msg.content;
    if (msg.attachments && msg.attachments.length > 0) {
      const attachmentInfo = msg.attachments
        .map((att) => `[Attachment: ${att.type} - ${att.name} (${att.url})]`)
        .join(' ');
      content = `${content}\n\nAttachments: ${attachmentInfo}`;
    }
    return { role: msg.role, content };
  });
}

async function tryAutoGenerateTitle(
  sessionId: string,
  userContent: string,
  assistantContent: string,
  userApiKeys: Record<string, string | undefined>
): Promise<void> {
  try {
    const count = await db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
    });
    if (count.length !== 2) return; // Only on first exchange

    const titlePrompt = `Based on the following conversation, generate a concise, descriptive title (3-6 words maximum). Only respond with the title, nothing else:\n\nUser: ${userContent}\nAssistant: ${assistantContent}`;

    const titleResponse = await llmService.generateResponse(
      [{ role: 'user', content: titlePrompt }],
      'llama-3.1-8b-instant',
      { temperature: 0.7, maxTokens: 50, topP: 1.0, frequencyPenalty: 0.0, presencePenalty: 0.0 },
      userApiKeys
    );

    let title = titleResponse.content.trim().replace(/^["']|["']$/g, '');
    if (title.length > 60) title = title.substring(0, 57) + '...';

    await db
      .update(chatSessions)
      .set({ title, autoTitle: true, updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    logger.info(`Auto-generated title for session ${sessionId}: ${title}`);
  } catch (err) {
    logger.warn('Failed to auto-generate title:', err);
  }
}

export async function runChat(input: ChatInput): Promise<ChatOutput> {
  const { messages: requestMessages, model, parameters, sessionId, userId } = input;
  const userMessage = requestMessages[requestMessages.length - 1];

  const { sessionId: currentSessionId, shortId: currentShortId } = await getOrCreateSession(
    sessionId,
    userId,
    model,
    parameters,
    userMessage?.content ?? ''
  );

  // Persist the user message
  await db.insert(messages).values({
    sessionId: currentSessionId,
    role: userMessage.role,
    content: userMessage.content,
    model,
    attachments: userMessage.attachments || null,
  });

  // Fetch user API keys for BYOK
  const userApiKeys = userId ? await userApiKeyRepository.getDecryptedApiKeys(userId) : {};

  // Call LLM
  const llmResponse = await llmService.generateResponse(
    buildLlmMessages(requestMessages),
    model,
    { ...DEFAULT_PARAMETERS, ...parameters },
    userApiKeys
  );

  // Persist the assistant message
  const [savedAssistant] = await db
    .insert(messages)
    .values({
      sessionId: currentSessionId,
      role: 'assistant',
      content: llmResponse.content,
      model: llmResponse.model,
      usage: llmResponse.usage,
    })
    .returning({ id: messages.id });

  // Fire-and-forget auto-title on first exchange
  tryAutoGenerateTitle(currentSessionId, userMessage.content, llmResponse.content, userApiKeys);

  return {
    message: {
      id: savedAssistant.id,
      role: 'assistant',
      content: llmResponse.content,
      timestamp: new Date().toISOString(),
      model: llmResponse.model,
    },
    sessionId: currentSessionId,
    shortId: currentShortId,
    usage: llmResponse.usage,
  };
}
