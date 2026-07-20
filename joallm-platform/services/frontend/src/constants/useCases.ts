export type UseCaseStatus = 'active' | 'placeholder';
export type UseCaseAssetKind = 'media';
export type UseCaseId =
  | 'media'
  | 'docs-ai'
  | 'data-intelligence'
  | 'acquisition'
  | 'marketing-studio';

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

/**
 * Studio workspaces (create layer).
 * Brain operates on Timelines / Knowledge; Studio creates and publishes intent.
 */
export const USE_CASES: UseCaseDefinition[] = [
  {
    id: 'media',
    label: 'Media AI',
    shortLabel: 'Media',
    homeRoute: '/studio/media-ai',
    assetRoute: (assetId: string) => `/studio/media-ai/${assetId}`,
    status: 'active',
    description:
      'Upload audio or video, track processing, and produce Knowledge Artifacts for the Brain.',
    helper:
      'Studio interprets media. ATRISI Marketing remembers insights on the Timeline and Knowledge spine.',
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
    description:
      'Connect Channels (WhatsApp, Meta, …) via Platform Connectors into one trustworthy Person Timeline.',
    helper:
      'External systems execute. ATRISI Marketing acquires, normalizes, attributes, and remembers.',
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
    description:
      'Ingest document sets, track readiness, and feed grounded Knowledge for Brain retrieval.',
    helper: 'Upload here, then move into Chat or Knowledge with the right sources in focus.',
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
    description:
      'Future Studio workspace for structured datasets, operational metrics, and event intelligence.',
    helper: 'Reserved until shared Studio patterns mature for tabular and event data.',
    audience: 'Operators, analysts, and teams working with structured data',
    supportsAssetDetail: false,
  },
  {
    id: 'marketing-studio',
    label: 'Marketing Studio',
    shortLabel: 'Marketing',
    homeRoute: '/studio/marketing',
    assetRoute: (assetId: string) => `/studio/marketing/${assetId}`,
    status: 'placeholder',
    description:
      'Program catalog → Growth workspace. Pick a Program (Amplify, Resonance, …), then Campaigns and Assets — Growth is one Program capability.',
    helper:
      'Institution → Program → Growth | Admissions | Learning. Studio starts from Program; Brain answers cross-program questions.',
    audience: 'Growth, admissions, and institutional program teams',
    supportsAssetDetail: true,
  },
];

export function getUseCaseById(id: string): UseCaseDefinition | undefined {
  return USE_CASES.find((useCase) => useCase.id === id);
}

export const PRIMARY_USE_CASE = USE_CASES[0];
