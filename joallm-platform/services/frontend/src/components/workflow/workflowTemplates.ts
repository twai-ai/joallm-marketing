import type { WorkflowEdge, WorkflowNode } from '../../contexts/WorkflowContext';
import { DEFAULT_MEDIA_INTELLIGENCE_MODE, type MediaIntelligenceMode } from '../../constants/mediaIntelligenceModes';

export interface WorkflowDraftDefinition {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isTemplate?: boolean;
}

export interface WorkflowStarterTemplate extends WorkflowDraftDefinition {
  id: string;
  category: 'knowledge' | 'review' | 'operations' | 'multimodal';
  blurb: string;
}

const WORKFLOW_NAME_LIMIT = 100;

function fitWorkflowName(name: string): string {
  if (name.length <= WORKFLOW_NAME_LIMIT) {
    return name;
  }

  return `${name.slice(0, WORKFLOW_NAME_LIMIT - 3).trimEnd()}...`;
}

const createNode = (
  id: string,
  type: WorkflowNode['type'],
  name: string,
  position: { x: number; y: number },
  data: Record<string, any> = {}
): WorkflowNode => ({
  id,
  type,
  name,
  position,
  data,
  connections: [],
});

const createEdge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  label?: string
): WorkflowEdge => ({
  id,
  source,
  target,
  sourceHandle,
  label,
});

export const workflowStarterTemplates: WorkflowStarterTemplate[] = [
  {
    id: 'executive-brief',
    name: 'Executive Brief',
    description: 'Retrieve knowledge, synthesize it, and generate an executive-ready brief.',
    category: 'knowledge',
    blurb: 'Good for board notes, client briefs, and stakeholder updates.',
    nodes: [
      createNode('intake', 'input', 'Input', { x: 80, y: 180 }),
      createNode('retrieve_context', 'rag', 'Retrieve context', { x: 300, y: 180 }, {
        query: 'Find the most important facts, risks, timelines, and business implications about {{intake}}.',
        fileIds: [],
        limit: 5,
        threshold: 0.1,
      }),
      createNode('draft_brief', 'llm', 'Draft brief', { x: 560, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1200,
        temperature: 0.4,
        prompt:
          'Create an executive brief using the workflow input {{intake}} and the retrieved context {{retrieve_context}}. Include summary, key decisions, risks, and recommended next steps.',
      }),
      createNode('final_output', 'output', 'Output', { x: 820, y: 180 }, {
        sourceNodeId: 'draft_brief',
      }),
    ],
    edges: [
      createEdge('edge-intake-rag', 'intake', 'retrieve_context'),
      createEdge('edge-rag-llm', 'retrieve_context', 'draft_brief'),
      createEdge('edge-llm-output', 'draft_brief', 'final_output'),
    ],
    isTemplate: true,
  },
  {
    id: 'policy-review',
    name: 'Policy Review',
    description: 'Search policy documents, evaluate control expectations, and surface action items.',
    category: 'review',
    blurb: 'Useful for compliance, security, and operational reviews.',
    nodes: [
      createNode('intake', 'input', 'Input', { x: 80, y: 180 }),
      createNode('retrieve_policy', 'rag', 'Retrieve policy', { x: 300, y: 180 }, {
        query: 'Retrieve the most relevant policy, control, and obligation context for {{intake}}.',
        fileIds: [],
        limit: 6,
        threshold: 0.1,
      }),
      createNode('review_findings', 'llm', 'Review findings', { x: 560, y: 180 }, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 1400,
        temperature: 0.2,
        prompt:
          'Using the request {{intake}} and policy context {{retrieve_policy}}, identify obligations, gaps, risks, and an action checklist. Keep the answer evidence-driven.',
      }),
      createNode('final_output', 'output', 'Output', { x: 820, y: 180 }, {
        sourceNodeId: 'review_findings',
      }),
    ],
    edges: [
      createEdge('edge-intake-policy', 'intake', 'retrieve_policy'),
      createEdge('edge-policy-llm', 'retrieve_policy', 'review_findings'),
      createEdge('edge-review-output', 'review_findings', 'final_output'),
    ],
    isTemplate: true,
  },
  {
    id: 'faq-builder',
    name: 'FAQ Builder',
    description: 'Retrieve source material and produce a clean FAQ or support-ready answer set.',
    category: 'operations',
    blurb: 'Helpful for support, enablement, onboarding, and internal knowledge teams.',
    nodes: [
      createNode('intake', 'input', 'Input', { x: 80, y: 180 }),
      createNode('retrieve_material', 'rag', 'Retrieve material', { x: 300, y: 180 }, {
        query: 'Find the source material needed to answer {{intake}} as a concise FAQ.',
        fileIds: [],
        limit: 5,
        threshold: 0.1,
      }),
      createNode('draft_faq', 'llm', 'Draft FAQ', { x: 560, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1200,
        temperature: 0.5,
        prompt:
          'Use {{retrieve_material}} to create a practical FAQ for {{intake}}. Include short answers, edge cases, and escalation notes.',
      }),
      createNode('final_output', 'output', 'Output', { x: 820, y: 180 }, {
        sourceNodeId: 'draft_faq',
      }),
    ],
    edges: [
      createEdge('edge-intake-material', 'intake', 'retrieve_material'),
      createEdge('edge-material-llm', 'retrieve_material', 'draft_faq'),
      createEdge('edge-faq-output', 'draft_faq', 'final_output'),
    ],
    isTemplate: true,
  },
  {
    id: 'screen-review-brief',
    name: 'Screen Review Brief',
    description: 'Combine screenshot observations with supporting knowledge and draft a concise review.',
    category: 'multimodal',
    blurb: 'Good for UI reviews, product feedback, and support triage with screenshots.',
    nodes: [
      createNode('intake', 'input', 'Input', { x: 80, y: 180 }),
      createNode('retrieve_guidance', 'rag', 'Retrieve guidance', { x: 300, y: 180 }, {
        query: 'Retrieve any design guidance, product notes, or support policy relevant to {{intake}} and the attached visual context.',
        fileIds: [],
        limit: 4,
        threshold: 0.1,
      }),
      createNode('draft_review', 'llm', 'Draft review', { x: 560, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1200,
        temperature: 0.3,
        prompt:
          'Use the workflow input {{intake}} as multimodal context that may include screenshots or visual notes. Combine it with {{retrieve_guidance}} to produce a structured review with observations, issues, and next steps.',
      }),
      createNode('final_output', 'output', 'Output', { x: 820, y: 180 }, {
        sourceNodeId: 'draft_review',
      }),
    ],
    edges: [
      createEdge('edge-intake-guidance', 'intake', 'retrieve_guidance'),
      createEdge('edge-guidance-review', 'retrieve_guidance', 'draft_review'),
      createEdge('edge-review-output', 'draft_review', 'final_output'),
    ],
    isTemplate: true,
  },
  {
    id: 'document-extraction-review',
    name: 'Document Extraction Review',
    description: 'Extract key structure from a document and turn it into an action-oriented summary.',
    category: 'multimodal',
    blurb: 'Useful for contracts, invoices, forms, and intake packets before deeper workflow routing.',
    nodes: [
      createNode('intake', 'input', 'Input', { x: 80, y: 180 }),
      createNode('retrieve_schema', 'rag', 'Retrieve schema', { x: 300, y: 180 }, {
        query: 'Retrieve any extraction rules, policy requirements, or field expectations relevant to {{intake}}.',
        fileIds: [],
        limit: 5,
        threshold: 0.1,
      }),
      createNode('extract_summary', 'llm', 'Extract & summarize', { x: 560, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1400,
        temperature: 0.2,
        prompt:
          'Assume {{intake}} may include document structure from PDFs or forms. Combine it with {{retrieve_schema}} to produce structured fields, anomalies, missing items, and recommended next steps.',
      }),
      createNode('final_output', 'output', 'Output', { x: 820, y: 180 }, {
        sourceNodeId: 'extract_summary',
      }),
    ],
    edges: [
      createEdge('edge-intake-schema', 'intake', 'retrieve_schema'),
      createEdge('edge-schema-summary', 'retrieve_schema', 'extract_summary'),
      createEdge('edge-summary-output', 'extract_summary', 'final_output'),
    ],
    isTemplate: true,
  },
];

// ── Media intelligence pipeline factory ───────────────────────────────────────

/**
 * Build a pre-wired media analysis pipeline for a given file.
 * media_ingest → transcribe → media_insights → artifact_out
 * The file context is stamped into every media node so the user can review
 * the AI flow and hit Run.
 */
export function buildMediaPipelineFromFile(
  fileId: string,
  filename: string,
  intelligenceMode: MediaIntelligenceMode = DEFAULT_MEDIA_INTELLIGENCE_MODE,
): WorkflowDraftDefinition {
  const mediaNodeData = { fileId, filename, intelligenceMode };
  const workflowName = fitWorkflowName(`Media Intelligence — ${filename}`);

  return {
    name: workflowName,
    description: 'Auto-generated media analysis workflow. Review the AI steps and run when ready.',
    nodes: [
      createNode('media_ingest_1', 'media_ingest', 'Media Ingest', { x: 80, y: 200 }, mediaNodeData),
      createNode('transcribe_1', 'transcribe', 'Transcribe', { x: 320, y: 200 }, mediaNodeData),
      createNode('media_insights_1', 'media_insights', 'Media Insights', { x: 560, y: 200 }, {
        ...mediaNodeData,
        model: 'llama-3.1-8b-instant',
      }),
      createNode('artifact_out_1', 'artifact_out', 'Analysis Output', { x: 800, y: 200 }, mediaNodeData),
    ],
    edges: [
      createEdge('e-ingest-transcribe', 'media_ingest_1', 'transcribe_1'),
      createEdge('e-transcribe-insights', 'transcribe_1', 'media_insights_1'),
      createEdge('e-insights-out', 'media_insights_1', 'artifact_out_1'),
    ],
  };
}

export function buildWorkflowFromChatMessage(
  content: string,
  role: 'user' | 'assistant',
  messageId: string,
): WorkflowDraftDefinition {
  const snippet = content.replace(/\s+/g, ' ').trim().slice(0, 64) || 'Chat handoff';
  const workflowName = fitWorkflowName(`Chat Handoff — ${snippet}`);

  return {
    name: workflowName,
    description: 'Auto-generated workflow seeded from a chat message for deeper automation.',
    nodes: [
      createNode('intake', 'input', 'Input', { x: 80, y: 180 }, {
        seedContent: content,
        source: 'chat_message',
        sourceRole: role,
        messageId,
      }),
      createNode('draft_response', 'llm', 'Draft response', { x: 360, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1200,
        temperature: 0.4,
        prompt: `Use the workflow input {{input}} as the starting point. This workflow was seeded from a ${role} chat message. Expand it into a structured response, next-step plan, or reusable automation output.`,
      }),
      createNode('final_output', 'output', 'Output', { x: 640, y: 180 }, {
        sourceNodeId: 'draft_response',
      }),
    ],
    edges: [
      createEdge('edge-input-draft', 'intake', 'draft_response'),
      createEdge('edge-draft-output', 'draft_response', 'final_output'),
    ],
  };
}

export interface NotebookWorkflowSourceCell {
  id: string;
  type: 'markdown' | 'code' | 'ai' | 'chart' | 'knowledge' | 'agent' | 'debug';
  content: string;
  output?: string;
  attachedDocumentIds?: string[];
  ragConfig?: {
    chunkSize: number;
    overlap: number;
    embeddingModel: string;
    searchTopK: number;
  };
}

export function buildWorkflowFromNotebook(
  notebookTitle: string,
  cells: NotebookWorkflowSourceCell[]
): WorkflowDraftDefinition {
  const supportedCells = cells.filter((cell) => cell.type === 'knowledge' || cell.type === 'ai');
  const narrative = cells
    .filter((cell) => cell.type === 'markdown')
    .map((cell) => cell.content.trim())
    .filter(Boolean)
    .join('\n\n');

  const nodes: WorkflowNode[] = [
    createNode('intake', 'input', 'Input', { x: 80, y: 180 }),
  ];
  const edges: WorkflowEdge[] = [];
  let previousNodeId = 'intake';
  let cursorX = 320;

  if (supportedCells.length === 0) {
    nodes.push(
      createNode('draft_response', 'llm', 'Draft response', { x: cursorX, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1200,
        temperature: 0.4,
        prompt: `Use the workflow input {{intake}} to continue the notebook "${notebookTitle}". ${narrative ? `Notebook context:\n${narrative}\n\n` : ''}Produce a practical, well-structured response.`,
      }),
      createNode('final_output', 'output', 'Output', { x: cursorX + 260, y: 180 }, {
        sourceNodeId: 'draft_response',
      })
    );
    edges.push(
      createEdge('edge-input-draft', 'intake', 'draft_response'),
      createEdge('edge-draft-output', 'draft_response', 'final_output')
    );

    return {
      name: `${notebookTitle} Workflow`,
      description: 'Draft workflow promoted from a notebook. Review and refine before operational use.',
      nodes,
      edges,
      isTemplate: false,
    };
  }

  supportedCells.forEach((cell, index) => {
    const suffix = `${index + 1}`;
    if (cell.type === 'knowledge') {
      const nodeId = `knowledge_${suffix}`;
      nodes.push(
        createNode(nodeId, 'rag', `Knowledge ${suffix}`, { x: cursorX, y: 180 }, {
          query: cell.content || `Retrieve the most relevant context for {{intake}} from notebook step ${suffix}.`,
          fileIds: cell.attachedDocumentIds || [],
          limit: cell.ragConfig?.searchTopK ?? 5,
          threshold: 0.1,
        })
      );
      edges.push(createEdge(`edge-${previousNodeId}-${nodeId}`, previousNodeId, nodeId));
      previousNodeId = nodeId;
      cursorX += 260;
      return;
    }

    const nodeId = `analysis_${suffix}`;
    const contextHint = previousNodeId !== 'intake'
      ? `Use upstream context from {{${previousNodeId}}}. `
      : '';
    nodes.push(
      createNode(nodeId, 'llm', `AI ${suffix}`, { x: cursorX, y: 180 }, {
        model: 'gpt-4o-mini',
        maxTokens: 1200,
        temperature: 0.5,
        prompt: `${contextHint}${cell.content || `Continue the analysis for {{intake}} based on the notebook context.`}`,
      })
    );
    edges.push(createEdge(`edge-${previousNodeId}-${nodeId}`, previousNodeId, nodeId));
    previousNodeId = nodeId;
    cursorX += 260;
  });

  nodes.push(
    createNode('final_output', 'output', 'Output', { x: cursorX, y: 180 }, {
      sourceNodeId: previousNodeId,
    })
  );
  edges.push(createEdge(`edge-${previousNodeId}-final_output`, previousNodeId, 'final_output'));

  return {
    name: `${notebookTitle} Workflow`,
    description: 'Draft workflow promoted from a notebook. Review node prompts, retrieval scope, and outputs before sharing.',
    nodes,
    edges,
    isTemplate: false,
  };
}
