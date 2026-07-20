import { USE_CASES, type UseCaseId, type UseCaseStatus } from './useCases';

/**
 * Studio family directory for Welcome / overview tiles.
 * Prefer USE_CASES directly; this keeps a stable shape for legacy imports
 * without collapsing Acquisition / Marketing Studio into "media".
 */
export type StudioFamilyStatus = UseCaseStatus | 'advanced';

export type StudioFamilyId = UseCaseId | 'custom';

export interface StudioFamilyDefinition {
  id: StudioFamilyId;
  label: string;
  route: string;
  status: StudioFamilyStatus;
  description: string;
  helper: string;
  audience: string;
}

export const STUDIO_FAMILIES: StudioFamilyDefinition[] = [
  ...USE_CASES.map((useCase) => ({
    id: useCase.id,
    label: useCase.label,
    route: useCase.homeRoute,
    status: useCase.status as StudioFamilyStatus,
    description: useCase.description,
    helper: useCase.helper,
    audience: useCase.audience,
  })),
  {
    id: 'custom',
    label: 'Custom Studio canvas',
    route: '/studio/custom',
    status: 'advanced',
    description:
      'Advanced canvas for bespoke pipelines when guided Studio workspaces are not enough.',
    helper: 'Platform tooling — not the primary marketing create path.',
    audience: 'Power users and custom implementations',
  },
];

/** @deprecated Use STUDIO_FAMILIES — kept for import compatibility */
export type WorkflowFamilyStatus = StudioFamilyStatus;
/** @deprecated Use StudioFamilyDefinition */
export type WorkflowFamilyDefinition = StudioFamilyDefinition;
/** @deprecated Use STUDIO_FAMILIES */
export const WORKFLOW_FAMILIES = STUDIO_FAMILIES;

export function getStudioFamilyById(id: string): StudioFamilyDefinition | undefined {
  const aliases: Record<string, StudioFamilyId> = {
    media: 'media',
    acquisition: 'acquisition',
    'docs-ai': 'docs-ai',
    'document-ai': 'docs-ai',
    documents: 'docs-ai',
    'data-intelligence': 'data-intelligence',
    data: 'data-intelligence',
    'marketing-studio': 'marketing-studio',
    marketing: 'marketing-studio',
    custom: 'custom',
  };

  const normalizedId = aliases[id];
  if (!normalizedId) return undefined;
  return STUDIO_FAMILIES.find((family) => family.id === normalizedId);
}

/** @deprecated Use getStudioFamilyById */
export const getWorkflowFamilyById = getStudioFamilyById;
