/**
 * Institutional Knowledge OS — canonical platform contracts.
 *
 * Stack: Acquisition → Timeline Service → Interpretation → Memory → Evidence → Intelligence
 *
 * Studio / product: ATRISI Marketing (Acquisition Intelligence surface)
 * KnowledgeArtifact = Layer Interpretation output (not a raw storage blob).
 * Timeline Service is generic (Person, Initiative, Campaign, Organization, …).
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
 * Timeline Service — generic chronological view for any institutional subject.
 * Prefer Timeline over RelationshipTimeline; timelines are not Person-only.
 */
export type TimelineSubjectType =
  | 'person'
  | 'initiative'
  | 'campaign'
  | 'organization'
  | 'institution'
  | 'program';

export type TimelineEntryKind =
  | 'event'
  | 'interaction'
  | 'artifact'
  | 'decision'
  | 'learning'
  | 'communication'
  | 'evidence'
  | 'outcome';

export interface TimelineEntry {
  id: string;
  kind: TimelineEntryKind;
  occurredAt: string;
  summary?: string | null;
  refId: string;
  initiativeId?: string | null;
  attributes?: Record<string, unknown>;
}

export interface Timeline {
  subjectType: TimelineSubjectType;
  subjectId: string;
  ownerUserId: string;
  organizationId?: string | null;
  /** Present when subjectType === 'person' */
  maturity?: RelationshipMaturity | null;
  events?: AcquisitionEvent[];
  interactions?: Interaction[];
  artifacts?: KnowledgeArtifact[];
  evidence?: Evidence[];
  entries: TimelineEntry[];
}

/** @deprecated Prefer Timeline — kept for compatibility during Phase A */
export type RelationshipTimeline = Timeline & {
  personId: string;
};

/** @deprecated Prefer TimelineEntryKind */
export type RelationshipTimelineEntryKind = TimelineEntryKind;

/** @deprecated Prefer TimelineEntry */
export type RelationshipTimelineEntry = TimelineEntry;

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

// ─── Studio Marketing Asset (create/publish — not ATRISI Marketing core) ─────

export type MarketingAssetKind =
  | 'linkedin_post'
  | 'x_thread'
  | 'instagram_caption'
  | 'meta_ad'
  | 'whatsapp_broadcast'
  | 'email'
  | 'blog'
  | 'landing_page'
  | 'video'
  | 'image'
  | 'brochure'
  | 'other';

export type MarketingAssetStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

/**
 * Content as an institutional asset (lives in Studio / Marketing Studio).
 * Publishing via connectors emits AcquisitionEvents into ATRISI Marketing.
 */
export interface MarketingAsset {
  id: string;
  ownerUserId: string;
  organizationId?: string | null;
  initiativeId?: string | null;
  campaignId?: string | null;
  kind: MarketingAssetKind;
  title: string;
  status: MarketingAssetStatus;
  body?: string | null;
  versions?: Record<string, unknown>[];
  publishingTargets?: string[];
  knowledgeDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
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
