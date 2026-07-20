import {
  Bot,
  Bug,
  Code,
  Database,
  GitBranch,
  MessageSquare,
  Zap,
  Film,
  Mic,
  Scissors,
  Sparkles,
  Download,
  type LucideIcon,
} from 'lucide-react';

export type SupportedWorkflowNodeType =
  | 'input'
  | 'llm'
  | 'rag'
  | 'conditional'
  | 'transform'
  | 'output';

export type MediaWorkflowNodeType =
  | 'media_ingest'
  | 'transcribe'
  | 'media_insights'
  | 'clip'
  | 'artifact_out';

export type LegacyWorkflowNodeType =
  | 'tool'
  | 'condition'
  | 'knowledge'
  | 'agent'
  | 'debug';

export type WorkflowNodeType = SupportedWorkflowNodeType | MediaWorkflowNodeType | LegacyWorkflowNodeType;

export interface WorkflowNodeTypeMeta {
  type: WorkflowNodeType;
  label: string;
  description: string;
  color: string;
  icon: LucideIcon;
  supported: boolean;
}

const nodeTypeCatalog: Record<WorkflowNodeType, WorkflowNodeTypeMeta> = {
  input: {
    type: 'input',
    label: 'Input',
    description: 'Workflow entry point for user or API input',
    color: 'bg-green-500',
    icon: MessageSquare,
    supported: true,
  },
  llm: {
    type: 'llm',
    label: 'LLM',
    description: 'Generate text with a model prompt',
    color: 'bg-blue-500',
    icon: Zap,
    supported: true,
  },
  rag: {
    type: 'rag',
    label: 'RAG',
    description: 'Retrieve knowledge base context',
    color: 'bg-indigo-500',
    icon: Database,
    supported: true,
  },
  conditional: {
    type: 'conditional',
    label: 'Condition',
    description: 'Route execution with comparison rules',
    color: 'bg-orange-500',
    icon: GitBranch,
    supported: true,
  },
  transform: {
    type: 'transform',
    label: 'Transform',
    description: 'Reshape or normalize data',
    color: 'bg-purple-500',
    icon: Code,
    supported: true,
  },
  output: {
    type: 'output',
    label: 'Output',
    description: 'Emit the final workflow result',
    color: 'bg-gray-500',
    icon: Database,
    supported: true,
  },
  // Media intelligence node types
  media_ingest: {
    type: 'media_ingest',
    label: 'Media Ingest',
    description: 'Load a media file and prepare it for AI analysis',
    color: 'bg-teal-500',
    icon: Film,
    supported: true,
  },
  transcribe: {
    type: 'transcribe',
    label: 'Transcribe',
    description: 'Convert audio/video speech to transcript segments',
    color: 'bg-cyan-500',
    icon: Mic,
    supported: true,
  },
  media_insights: {
    type: 'media_insights',
    label: 'Media Insights',
    description: 'Generate AI highlights, summaries, and key moments from the transcript',
    color: 'bg-violet-500',
    icon: Sparkles,
    supported: true,
  },
  clip: {
    type: 'clip',
    label: 'Clip Export',
    description: 'Create a lightweight clip artifact from a selected time range',
    color: 'bg-pink-500',
    icon: Scissors,
    supported: true,
  },
  artifact_out: {
    type: 'artifact_out',
    label: 'Analysis Output',
    description: 'Return analysis results and downstream-ready media artifacts',
    color: 'bg-slate-500',
    icon: Download,
    supported: true,
  },
  tool: {
    type: 'tool',
    label: 'Tool (legacy)',
    description: 'Older workflow node type kept for saved workflows',
    color: 'bg-purple-400',
    icon: Code,
    supported: false,
  },
  condition: {
    type: 'condition',
    label: 'Condition (legacy)',
    description: 'Older workflow node type kept for saved workflows',
    color: 'bg-orange-400',
    icon: GitBranch,
    supported: false,
  },
  knowledge: {
    type: 'knowledge',
    label: 'Knowledge (legacy)',
    description: 'Older workflow node type kept for saved workflows',
    color: 'bg-indigo-400',
    icon: Database,
    supported: false,
  },
  agent: {
    type: 'agent',
    label: 'Agent (legacy)',
    description: 'Older workflow node type kept for saved workflows',
    color: 'bg-pink-500',
    icon: Bot,
    supported: false,
  },
  debug: {
    type: 'debug',
    label: 'Debug (legacy)',
    description: 'Older workflow node type kept for saved workflows',
    color: 'bg-red-500',
    icon: Bug,
    supported: false,
  },
};

export const workflowNodePaletteTypes: WorkflowNodeTypeMeta[] = [
  nodeTypeCatalog.input,
  nodeTypeCatalog.llm,
  nodeTypeCatalog.rag,
  nodeTypeCatalog.conditional,
  nodeTypeCatalog.transform,
  nodeTypeCatalog.output,
];

// Media intelligence palette — shown when WorkflowBuilder is in media mode
export const mediaNodePaletteTypes: WorkflowNodeTypeMeta[] = [
  nodeTypeCatalog.media_ingest,
  nodeTypeCatalog.transcribe,
  nodeTypeCatalog.media_insights,
  nodeTypeCatalog.clip,
  nodeTypeCatalog.artifact_out,
];

export function getWorkflowNodeTypeMeta(type: string): WorkflowNodeTypeMeta {
  return nodeTypeCatalog[type as WorkflowNodeType] ?? {
    type: type as WorkflowNodeType,
    label: type,
    description: 'Unknown workflow node type',
    color: 'bg-gray-400',
    icon: Code,
    supported: false,
  };
}

export function isSupportedWorkflowNodeType(type: string): type is SupportedWorkflowNodeType {
  return ['input', 'llm', 'rag', 'conditional', 'transform', 'output'].includes(type);
}

export function isMediaWorkflowNodeType(type: string): type is MediaWorkflowNodeType {
  return ['media_ingest', 'transcribe', 'media_insights', 'clip', 'artifact_out'].includes(type);
}
