import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { WorkflowNodeType } from '../components/workflow/workflowNodeCatalog';
import { workflowApi } from '../services/workflowApi';
import type { Workflow as ApiWorkflow, WorkflowExecution } from '../services/workflowApi';
import type { WorkflowDraftDefinition } from '../components/workflow/workflowTemplates';
import { showError } from '../utils/toast';

const createId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: { x: number; y: number };
  data: any;
  connections: string[];
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // required for conditional branching (truePath / falsePath)
  label?: string;
};

export type Workflow = {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  created: Date;
  modified: Date;
  isPublic?: boolean;
  isTemplate?: boolean;
};

function fromApi(w: ApiWorkflow): Workflow {
  return {
    id: w.id,
    name: w.name,
    description: w.description || '',
    nodes: (w.nodes as unknown as WorkflowNode[]) || [],
    edges: (w.edges as unknown as WorkflowEdge[]) || [],
    created: new Date(w.createdAt),
    modified: new Date(w.updatedAt),
    isPublic: w.isPublic,
    isTemplate: w.isTemplate,
  };
}

function isUpgradeRequiredError(error: any): boolean {
  const message = String(error?.message || error?.error || '');
  return (
    error?.status === 403 ||
    message.includes('Upgrade to Pro') ||
    message.includes('requires JoaLLM Pro') ||
    message.includes('not available')
  );
}

function handleWorkflowUpgradeError(error: any, action: 'create' | 'update' | 'delete') {
  if (!isUpgradeRequiredError(error)) {
    throw error;
  }

  const message =
    action === 'create'
      ? 'Upgrade to Pro to create Media AI workflows.'
      : action === 'update'
        ? 'Upgrade to Pro to manage workflows.'
        : 'Upgrade to Pro to manage workflows.';

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('openUpgrade'));
  }

  throw {
    ...error,
    message,
  };
}

interface WorkflowContextType {
  workflows: Workflow[];
  activeWorkflow: Workflow | null;
  isLoading: boolean;
  setActiveWorkflow: (workflow: Workflow | null) => void;
  loadWorkflows: () => Promise<void>;
  createWorkflow: (name: string, description: string) => Promise<void>;
  createWorkflowFromDefinition: (definition: WorkflowDraftDefinition) => Promise<Workflow>;
  updateWorkflow: (workflow: Workflow) => Promise<void>;
  deleteWorkflow: (id: string) => Promise<void>;
  addNode: (node: Omit<WorkflowNode, 'id'>) => void;
  updateNode: (id: string, data: Partial<WorkflowNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Omit<WorkflowEdge, 'id'>) => void;
  deleteEdge: (id: string) => void;
  executeWorkflow: (workflowId: string, input?: Record<string, any>) => Promise<WorkflowExecution>;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflowState] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Debounce timer for auto-saving node/edge mutations
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkflows = async (silent = false) => {
    setIsLoading(true);
    try {
      const list = await workflowApi.listWorkflows();
      const mapped = list.map(fromApi);
      setWorkflows(mapped);
    } catch (error: any) {
      console.error('Failed to load workflows:', error);
      if (!silent) {
        const msg = error?.message || 'Could not load workflows';
        // Suppress noise for unauthenticated/network state — only show for unexpected errors
        if (error?.status !== 401 && error?.status !== 403) {
          showError(msg);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows(true); // silent on initial mount — user hasn't navigated to workflows yet
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    };
  }, []);

  // Schedules a debounced API save for the active workflow (used by node/edge mutations)
  const scheduleSave = (workflow: Workflow) => {
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(async () => {
      try {
        const updated = await workflowApi.updateWorkflow(workflow.id, {
          nodes: workflow.nodes as any,
          edges: workflow.edges as any,
        });
        const mapped = fromApi(updated);
        setWorkflows(prev => prev.map(w => w.id === mapped.id ? mapped : w));
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
      pendingSaveRef.current = null;
    }, 800);
  };

  const setActiveWorkflow = (workflow: Workflow | null) => {
    setActiveWorkflowState(workflow);
  };

  const createWorkflow = async (name: string, description: string) => {
    try {
      const created = await workflowApi.createWorkflow({ name, description, nodes: [], edges: [] });
      const mapped = fromApi(created);
      setWorkflows(prev => [...prev, mapped]);
      setActiveWorkflowState(mapped);
    } catch (error) {
      handleWorkflowUpgradeError(error, 'create');
    }
  };

  const createWorkflowFromDefinition = async (definition: WorkflowDraftDefinition) => {
    try {
      const created = await workflowApi.createWorkflow({
        name: definition.name,
        description: definition.description,
        nodes: definition.nodes as any,
        edges: definition.edges as any,
        isTemplate: definition.isTemplate,
      });
      const mapped = fromApi(created);
      setWorkflows(prev => [...prev, mapped]);
      setActiveWorkflowState(mapped);
      return mapped;
    } catch (error) {
      handleWorkflowUpgradeError(error, 'create');
      throw error;
    }
  };

  const updateWorkflow = async (workflow: Workflow) => {
    try {
      const updated = await workflowApi.updateWorkflow(workflow.id, {
        name: workflow.name,
        description: workflow.description,
        nodes: workflow.nodes as any,
        edges: workflow.edges as any,
        isPublic: workflow.isPublic,
        isTemplate: workflow.isTemplate,
      });
      const mapped = fromApi(updated);
      setWorkflows(prev => prev.map(w => w.id === mapped.id ? mapped : w));
      if (activeWorkflow?.id === mapped.id) setActiveWorkflowState(mapped);
    } catch (error) {
      handleWorkflowUpgradeError(error, 'update');
    }
  };

  const deleteWorkflow = async (id: string) => {
    try {
      await workflowApi.deleteWorkflow(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
      if (activeWorkflow?.id === id) setActiveWorkflowState(null);
    } catch (error) {
      handleWorkflowUpgradeError(error, 'delete');
    }
  };

  // ── Node / edge helpers ──────────────────────────────────────────────────────
  // These update local state immediately (optimistic) and schedule a debounced
  // API save so rapid operations like drag-to-position don't hammer the backend.

  const applyWorkflowMutation = (mutate: (w: Workflow) => Workflow) => {
    if (!activeWorkflow) return;
    const next = mutate({ ...activeWorkflow, modified: new Date() });
    setActiveWorkflowState(next);
    setWorkflows(prev => prev.map(w => w.id === next.id ? next : w));
    scheduleSave(next);
  };

  const addNode = (node: Omit<WorkflowNode, 'id'>) => {
    applyWorkflowMutation(w => ({
      ...w,
      nodes: [...w.nodes, { ...node, id: createId('node') }],
    }));
  };

  const updateNode = (id: string, data: Partial<WorkflowNode>) => {
    applyWorkflowMutation(w => ({
      ...w,
      nodes: w.nodes.map(n => n.id === id ? { ...n, ...data } : n),
    }));
  };

  const deleteNode = (id: string) => {
    applyWorkflowMutation(w => ({
      ...w,
      nodes: w.nodes.filter(n => n.id !== id),
      edges: w.edges.filter(e => e.source !== id && e.target !== id),
    }));
  };

  const addEdge = (edge: Omit<WorkflowEdge, 'id'>) => {
    applyWorkflowMutation(w => {
      const exists = w.edges.some(e => e.source === edge.source && e.target === edge.target);
      if (exists || edge.source === edge.target) return w;
      return { ...w, edges: [...w.edges, { ...edge, id: createId('edge') }] };
    });
  };

  const deleteEdge = (id: string) => {
    applyWorkflowMutation(w => ({
      ...w,
      edges: w.edges.filter(e => e.id !== id),
    }));
  };

  const executeWorkflow = (workflowId: string, input?: Record<string, any>) =>
    workflowApi.executeWorkflow(workflowId, input);

  return (
    <WorkflowContext.Provider value={{
      workflows,
      activeWorkflow,
      isLoading,
      setActiveWorkflow,
      loadWorkflows,
      createWorkflow,
      createWorkflowFromDefinition,
      updateWorkflow,
      deleteWorkflow,
      addNode,
      updateNode,
      deleteNode,
      addEdge,
      deleteEdge,
      executeWorkflow,
    }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}
