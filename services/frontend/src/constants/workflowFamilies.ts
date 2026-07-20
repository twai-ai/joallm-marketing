import { USE_CASES } from './useCases';

export type WorkflowFamilyStatus = 'active' | 'placeholder' | 'advanced';

export interface WorkflowFamilyDefinition {
  id: 'media' | 'documents' | 'data' | 'custom';
  label: string;
  route: string;
  status: WorkflowFamilyStatus;
  description: string;
  helper: string;
  audience: string;
}

export const WORKFLOW_FAMILIES: WorkflowFamilyDefinition[] = [
  ...USE_CASES.map((useCase) => ({
    id:
      useCase.id === 'docs-ai'
        ? 'documents'
        : useCase.id === 'data-intelligence'
          ? 'data'
            : 'media',
    label: useCase.label,
    route: useCase.homeRoute,
    status: useCase.status,
    description: useCase.description,
    helper: useCase.helper,
    audience: useCase.audience,
  })),
  {
    id: 'custom',
    label: 'Studio',
    route: '/studio/custom',
    status: 'advanced',
    description: 'The advanced canvas for composing bespoke pipelines, routing, and automation.',
    helper: 'Use this when the guided family workspaces are not enough.',
    audience: 'Power users and custom implementations',
  },
];

export function getWorkflowFamilyById(id: string): WorkflowFamilyDefinition | undefined {
  const familyIdAliases = {
    'docs-ai': 'documents',
    'document-ai': 'documents',
    'data-intelligence': 'data',
    media: 'media',
    documents: 'documents',
    data: 'data',
    custom: 'custom',
  } as const;

  const normalizedId = familyIdAliases[id as keyof typeof familyIdAliases];

  return WORKFLOW_FAMILIES.find((family) => family.id === normalizedId);
}
