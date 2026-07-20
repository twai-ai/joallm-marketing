/**
 * Institutional Knowledge OS — canonical platform contracts.
 *
 * Constitutional layers:
 *   Knowledge Acquisition → Knowledge Interpretation → Institutional Memory → Institutional Intelligence
 *
 * Studio surface today: Acquisition Intelligence
 * KnowledgeArtifact is an interpreted representation (Layer 2), not a raw storage blob.
 *
 * Phase 1 tenancy uses ownerUserId (+ optional organizationId).
 * Target uniqueness: organizationId + provider + externalId.
 */

// ─── Enums / unions ───────────────────────────────────────────────────────────

export type PersonStatus =
  | 'anonymous'
  | 'identified'
  | 'verified'
  | 'merged'
  | 'archived';

/**
 * Constitutional relationship evolution — preferred over lead/conversion funnels.
 * Intelligence queries: Source = Meta AND maturity = mentoring
 */
export type RelationshipMaturity =
  | 'unknown'
  | 'observed'
  | 'identified'
  | 'engaged'
  | 'participating'
  | 'contributing'
  | 'leading'
  | 'mentoring'
  | 'partnering';

export type IdentityProvider =
  | 'email'
  | 'phone'
  | 'linkedin'
  | 'meta'
  | 'google'
  | 'whatsapp'
  | 'education_platform'
  | 'builder_challenge'
  | 'anonymous_cookie'
  | 'custom';

export type InitiativeStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type CampaignStatus = InitiativeStatus;

export type SourceConnectionStatus = 'active' | 'paused' | 'error' | 'disconnected';

export type RawProcessingStatus =
  | 'received'
  | 'queued'
  | 'processed'
  | 'failed'
  | 'ignored';

export type InteractionKind =
  | 'visit'
  | 'submission'
  | 'message'
  | 'call'
  | 'meeting'
  | 'webinar'
  | 'learning_activity'
  | 'application'
  | 'enrollment'
  | 'decision'
  | 'other';

export type InteractionDirection = 'inbound' | 'outbound' | 'internal';

export type KnowledgeArtifactType =
  | 'email'
  | 'message'
  | 'audio'
  | 'video'
  | 'transcript'
  | 'document'
  | 'form_response'
  | 'note'
  | 'application_essay'
  | 'voice_note';

export type JourneyStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type EvidenceKind =
  | 'interaction'
  | 'artifact'
  | 'attribution'
  | 'decision'
  | 'external'
  | 'derived';

export type SignalKind =
  | 'engagement'
  | 'intent'
  | 'risk'
  | 'opportunity'
  | 'relationship'
  | 'other';

/** Initial canonical event type vocabulary (extensible string allowed on AcquisitionEvent). */
export type CanonicalAcquisitionEventType =
  | 'page.viewed'
  | 'cta.clicked'
  | 'form.started'
  | 'form.submitted'
  | 'program.viewed'
  | 'application.started'
  | 'application.submitted'
  | 'email.received'
  | 'email.sent'
  | 'email.opened'
  | 'email.clicked'
  | 'email.replied'
  | 'message.received'
  | 'message.sent'
  | 'call.started'
  | 'call.completed'
  | 'meeting.scheduled'
  | 'meeting.attended'
  | 'webinar.registered'
  | 'webinar.attended'
  | 'challenge.started'
  | 'challenge.submitted'
  | 'challenge.completed'
  | 'prework.started'
  | 'prework.completed'
  | 'learner.enrolled'
  | 'assessment.completed';

// ─── Core entities (Phase 1+) ─────────────────────────────────────────────────

/**
 * Canonical human record within a tenant.
 * Phase 1: ownerUserId is required; organizationId is optional and becoming primary.
 */
export interface Person {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  displayName?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  status: PersonStatus;
  /** Constitutional evolution stage — Evidence-backed; not a CRM lead temperature */
  relationshipMaturity?: RelationshipMaturity | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps source-specific identities to one canonical Person.
 * Unique: ownerUserId + provider + externalId (Phase 1).
 * Target unique: organizationId + provider + externalId.
 */
export interface PersonIdentity {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId: string;
  provider: IdentityProvider;
  externalId: string;
  confidence: number;
  isVerified: boolean;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface Initiative {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  name: string;
  description?: string | null;
  status: InitiativeStatus;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Channel execution subordinate to an Initiative — not a first-class business object. */
export interface Campaign {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  initiativeId: string;
  name: string;
  channel?: string | null;
  status: CampaignStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SourceConnection {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  provider: string;
  name: string;
  status: SourceConnectionStatus;
  externalAccountId?: string | null;
  config?: Record<string, unknown>;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Immutable original source payload before normalization. */
export interface RawAcquisitionRecord {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  sourceConnectionId: string;
  externalEventId?: string | null;
  eventName?: string | null;
  receivedAt: string;
  occurredAt?: string | null;
  headers?: Record<string, unknown> | null;
  payload: Record<string, unknown>;
  payloadHash: string;
  processingStatus: RawProcessingStatus;
  errorMessage?: string | null;
  createdAt?: string;
}

export interface AcquisitionEvent {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  sourceConnectionId: string;
  rawRecordId: string;
  source: string;
  externalEventId?: string | null;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  personId?: string | null;
  initiativeId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  attributes: Record<string, unknown>;
  schemaVersion: number;
  createdAt?: string;
}

/** Relationship-facing projection of one or more events. */
export interface Interaction {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId: string;
  initiativeId?: string | null;
  campaignId?: string | null;
  sourceEventId: string;
  kind: InteractionKind;
  direction?: InteractionDirection | null;
  summary?: string | null;
  occurredAt: string;
  createdAt: string;
}

/**
 * Layer 2 — Knowledge Interpretation output.
 * Not a raw storage blob: an interpreted representation (topics, intent, commitments, signals)
 * that may reference underlying files / RAG documents / media assets.
 */
export interface KnowledgeArtifact {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId?: string | null;
  initiativeId?: string | null;
  acquisitionEventId?: string | null;
  interactionId?: string | null;
  artifactType: KnowledgeArtifactType;
  /** Human-readable title for timeline surfaces */
  title?: string | null;
  /** Interpreted structure: topics, questions, commitments, intent, sentiment, speakers, … */
  interpretation?: Record<string, unknown> | null;
  /** Optional capability / relationship signals extracted during interpretation */
  signals?: Record<string, unknown> | null;
  sourceFileId?: string | null;
  knowledgeDocumentId?: string | null;
  mediaAssetId?: string | null;
  occurredAt?: string | null;
  createdAt: string;
}

/**
 * First-class Relationship Timeline — canonical view of a Person.
 * Studio and all verticals query this service; do not fork per-product timelines.
 */
export interface RelationshipTimeline {
  personId: string;
  ownerUserId: string;
  organizationId?: string | null;
  maturity?: RelationshipMaturity | null;
  events: AcquisitionEvent[];
  interactions: Interaction[];
  artifacts: KnowledgeArtifact[];
  evidence?: Evidence[];
  /** Reserved for decisions, learning activities, communications, outcomes as they land */
  entries?: RelationshipTimelineEntry[];
}

export type RelationshipTimelineEntryKind =
  | 'event'
  | 'interaction'
  | 'artifact'
  | 'decision'
  | 'learning'
  | 'communication'
  | 'evidence'
  | 'outcome';

export interface RelationshipTimelineEntry {
  id: string;
  kind: RelationshipTimelineEntryKind;
  occurredAt: string;
  summary?: string | null;
  refId: string;
  initiativeId?: string | null;
  attributes?: Record<string, unknown>;
}

/** Attribution of an event/interaction to an initiative (and optional campaign). */
export interface Attribution {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId?: string | null;
  acquisitionEventId?: string | null;
  interactionId?: string | null;
  initiativeId: string;
  campaignId?: string | null;
  confidence: number;
  method: 'explicit' | 'inferred' | 'manual' | 'rule';
  createdAt: string;
}

// ─── Phase 2+ contracts (types only until ingestion is reliable) ──────────────

export interface Journey {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  initiativeId?: string | null;
  name: string;
  status: JourneyStatus;
  definition?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface JourneyState {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  journeyId: string;
  personId: string;
  currentStep?: string | null;
  state: Record<string, unknown>;
  enteredAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId?: string | null;
  initiativeId?: string | null;
  interactionId?: string | null;
  knowledgeArtifactId?: string | null;
  acquisitionEventId?: string | null;
  kind: EvidenceKind;
  summary: string;
  confidence: number;
  provenance?: Record<string, unknown>;
  occurredAt?: string | null;
  createdAt: string;
}

export interface Signal {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  personId?: string | null;
  initiativeId?: string | null;
  kind: SignalKind;
  name: string;
  value?: number | null;
  payload?: Record<string, unknown>;
  evidenceIds?: string[];
  observedAt: string;
  createdAt: string;
}

// ─── Backward-compatible aliases ──────────────────────────────────────────────

/** @deprecated Prefer PersonStatus */
export type AcquisitionPersonStatus = PersonStatus;

/** @deprecated Prefer IdentityProvider */
export type AcquisitionIdentityProvider = IdentityProvider;

/** @deprecated Prefer Person */
export type AcquisitionPerson = Person;
