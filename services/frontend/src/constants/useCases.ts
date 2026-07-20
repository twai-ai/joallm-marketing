export type UseCaseStatus = 'active' | 'placeholder';
export type UseCaseAssetKind = 'media';
export type UseCaseId = 'media' | 'docs-ai' | 'data-intelligence' | 'acquisition';

export interface UseCaseDefinition {
  id: UseCaseId;
  label: string;
  shortLabel: string;
  homeRoute: string;
  assetRoute: (assetId: string) => string;
  status: UseCaseStatus;
  description: string;
  helper: string;
  audience: string;
  supportsAssetDetail: boolean;
  assetKind?: UseCaseAssetKind;
}

export const USE_CASES: UseCaseDefinition[] = [
  {
    id: 'media',
    label: 'Media AI',
    shortLabel: 'Media',
    homeRoute: '/studio/media-ai',
    assetRoute: (assetId: string) => `/studio/media-ai/${assetId}`,
    status: 'active',
    description: 'Upload audio or video, track AI processing, and review structured insights.',
    helper: 'This is the first live guided workspace and the reference pattern for future use-case surfaces.',
    audience: 'Creators, operators, and teams analyzing recordings',
    supportsAssetDetail: true,
    assetKind: 'media',
  },
  {
    id: 'acquisition',
    label: 'Acquisition Intelligence',
    shortLabel: 'Acquisition',
    homeRoute: '/studio/acquisition',
    assetRoute: (assetId: string) => `/studio/acquisition/${assetId}`,
    status: 'active',
    description: 'Connect acquisition surfaces into one trustworthy Person timeline across WhatsApp, Meta, and more.',
    helper: 'External systems execute. ATRISI Marketing acquires, normalizes, attributes, and remembers.',
    audience: 'Growth, admissions, partnerships, and institutional relationship teams',
    supportsAssetDetail: true,
  },
  {
    id: 'docs-ai',
    label: 'Document AI',
    shortLabel: 'Documents',
    homeRoute: '/studio/document-ai',
    assetRoute: (assetId: string) => `/studio/document-ai/${assetId}`,
    status: 'active',
    description: 'A guided workspace for ingesting document sets, tracking readiness, and launching grounded retrieval workflows.',
    helper: 'Upload documents here, then move into retrieval chat with the right sources already in focus.',
    audience: 'Knowledge managers and document-heavy teams',
    supportsAssetDetail: false,
  },
  {
    id: 'data-intelligence',
    label: 'Data Intelligence',
    shortLabel: 'Data',
    homeRoute: '/studio/data-intelligence',
    assetRoute: (assetId: string) => `/studio/data-intelligence/${assetId}`,
    status: 'placeholder',
    description: 'A future workspace for structured datasets, operational metrics, and intelligence pipelines over tabular and event data.',
    helper: 'Reserved for a guided data-first workflow family once the shared Studio patterns mature further.',
    audience: 'Operators, analysts, and teams working with structured data',
    supportsAssetDetail: false,
  },
];

export function getUseCaseById(id: string): UseCaseDefinition | undefined {
  return USE_CASES.find((useCase) => useCase.id === id);
}

export const PRIMARY_USE_CASE = USE_CASES[0];
