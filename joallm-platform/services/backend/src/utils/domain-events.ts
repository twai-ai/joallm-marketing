import { randomUUID } from 'node:crypto';

// Domain event types (copied from @joallm/sdk)
export type DomainEventName =
  | 'chat.session.created'
  | 'chat.message.appended'
  | 'rag.document.indexed'
  | 'rag.search.executed'
  | 'policy.decision.evaluated';

export interface DomainEventMetadata {
  correlationId?: string;
  causationId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  type: DomainEventName;
  source: string;
  occurredAt: string;
  payload: TPayload;
  metadata?: DomainEventMetadata;
}

export interface ChatSessionCreatedPayload {
  sessionId: string;
  userId?: string;
  model: string;
}

export interface ChatMessageAppendedPayload {
  sessionId: string;
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  userId?: string;
  model: string;
}

export interface RagDocumentIndexedPayload {
  fileId: string;
  userId?: string;
  chunkCount: number;
  indexDurationMs: number;
}

export interface RagSearchExecutedPayload {
  sessionId?: string;
  userId?: string;
  query: string;
  topK: number;
  latencyMs: number;
}

export type PolicyDecisionResult = 'allow' | 'deny';

export interface PolicyDecisionEvaluatedPayload {
  policyId: string;
  subject: string;
  action: string;
  resource?: string;
  result: PolicyDecisionResult;
  explanation?: string;
}

export type DomainEventPayloads = {
  'chat.session.created': ChatSessionCreatedPayload;
  'chat.message.appended': ChatMessageAppendedPayload;
  'rag.document.indexed': RagDocumentIndexedPayload;
  'rag.search.executed': RagSearchExecutedPayload;
  'policy.decision.evaluated': PolicyDecisionEvaluatedPayload;
};

export type TypedDomainEvent<K extends DomainEventName = DomainEventName> = DomainEvent<DomainEventPayloads[K]> & {
  type: K;
};

interface EventFactoryOptions<TName extends DomainEventName, TPayload extends DomainEventPayloads[TName]> {
  type: TName;
  payload: TPayload;
  source: string;
  metadata?: DomainEventMetadata;
}

function createDomainEvent<TName extends DomainEventName>(
  options: EventFactoryOptions<TName, DomainEventPayloads[TName]>
): TypedDomainEvent<TName> {
  return {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...options
  };
}

// Domain event dispatcher
type DomainEventDispatcher = (event: TypedDomainEvent) => void | Promise<void>;

const dispatchers = new Set<DomainEventDispatcher>();

export function registerDomainEventDispatcher(handler: DomainEventDispatcher) {
  dispatchers.add(handler);
  return () => dispatchers.delete(handler);
}

export async function emitDomainEvent<TName extends DomainEventName>(
  type: TName,
  payload: DomainEventPayloads[TName],
  source: string,
  metadata?: DomainEventMetadata
): Promise<TypedDomainEvent<TName>> {
  const event = createDomainEvent({
    type,
    payload,
    source,
    metadata
  });

  await Promise.allSettled(
    Array.from(dispatchers).map(async (handler) => {
      await handler(event);
    })
  );

  return event;
}
