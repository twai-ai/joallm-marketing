export type DomainEventName =
  | 'chat.session.created'
  | 'chat.message.appended'
  | 'rag.document.indexed'
  | 'rag.search.executed'
  | 'policy.decision.evaluated'
  | 'acquisition.raw.received'
  | 'acquisition.event.normalized'
  | 'acquisition.person.resolved'
  | 'acquisition.interaction.created'
  | 'acquisition.artifact.linked';

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

export interface AcquisitionRawReceivedPayload {
  rawRecordId: string;
  sourceConnectionId: string;
  ownerUserId: string;
  organizationId?: string;
  source: string;
}

export interface AcquisitionEventNormalizedPayload {
  eventId: string;
  rawRecordId: string;
  eventType: string;
  personId?: string;
  ownerUserId: string;
}

export interface AcquisitionPersonResolvedPayload {
  personId: string;
  provider: string;
  externalId: string;
  ownerUserId: string;
  created: boolean;
}

export interface AcquisitionInteractionCreatedPayload {
  interactionId: string;
  personId: string;
  sourceEventId: string;
  kind: string;
  ownerUserId: string;
}

export interface AcquisitionArtifactLinkedPayload {
  knowledgeArtifactId: string;
  acquisitionEventId?: string;
  interactionId?: string;
  artifactType: string;
  ownerUserId: string;
}

export type DomainEventPayloads = {
  'chat.session.created': ChatSessionCreatedPayload;
  'chat.message.appended': ChatMessageAppendedPayload;
  'rag.document.indexed': RagDocumentIndexedPayload;
  'rag.search.executed': RagSearchExecutedPayload;
  'policy.decision.evaluated': PolicyDecisionEvaluatedPayload;
  'acquisition.raw.received': AcquisitionRawReceivedPayload;
  'acquisition.event.normalized': AcquisitionEventNormalizedPayload;
  'acquisition.person.resolved': AcquisitionPersonResolvedPayload;
  'acquisition.interaction.created': AcquisitionInteractionCreatedPayload;
  'acquisition.artifact.linked': AcquisitionArtifactLinkedPayload;
};

export type TypedDomainEvent<K extends DomainEventName = DomainEventName> = DomainEvent<DomainEventPayloads[K]> & {
  type: K;
};

export interface EventFactoryOptions<TName extends DomainEventName, TPayload extends DomainEventPayloads[TName]> {
  type: TName;
  payload: TPayload;
  source: string;
  metadata?: DomainEventMetadata;
}

import { randomUUID } from 'node:crypto';

export function createDomainEvent<TName extends DomainEventName>(
  options: EventFactoryOptions<TName, DomainEventPayloads[TName]>
): TypedDomainEvent<TName> {
  return {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    ...options
  };
}
