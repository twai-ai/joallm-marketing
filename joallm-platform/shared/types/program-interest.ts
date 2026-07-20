/**
 * Program Interest — the only object Education should pull from this platform.
 * @see docs/04-architecture/INSTITUTION_ACQUISITION_PLATFORM.md
 *
 * Education does NOT pull campaigns, creatives, or publishing jobs.
 */

export type ProgramInterestEvidenceKind =
  | 'clicked'
  | 'viewed'
  | 'downloaded'
  | 'form_submitted'
  | 'message_inbound'
  | 'webinar_attended'
  | 'event_attended'
  | 'referral'
  | 'other';

export type ProgramInterestEvidence = {
  kind: ProgramInterestEvidenceKind;
  summary?: string;
  occurredAt?: string;
  channel?: string;
  refId?: string;
  attributes?: Record<string, unknown>;
};

/**
 * Crosses the Acquire → Convert boundary.
 * Alias conceptually: AcquisitionOutcome.
 */
export type ProgramInterest = {
  id: string;
  personId: string;
  /** Targeting id aligned with atrisi.org programs catalog */
  programId: string;
  programName?: string;
  confidence: number;
  source: string;
  /** Attribution only — Education need not load full Campaign */
  campaignId?: string;
  campaignName?: string;
  intent?: string;
  evidence: ProgramInterestEvidence[];
  occurredAt: string;
  updatedAt?: string;
  organizationId?: string;
};

/** Minimal Education pull payload */
export type ProgramInterestPullItem = Pick<
  ProgramInterest,
  | 'id'
  | 'personId'
  | 'programId'
  | 'programName'
  | 'confidence'
  | 'source'
  | 'campaignId'
  | 'campaignName'
  | 'intent'
  | 'evidence'
  | 'occurredAt'
>;
