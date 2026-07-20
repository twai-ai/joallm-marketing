import { apiClient } from '../utils/api-client';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isPublic: boolean;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  userId: string;
  status: 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled';
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  executionLog?: Array<{
    timestamp: string;
    nodeId: string;
    status: 'running' | 'suspended' | 'completed' | 'failed';
    message?: string;
    attempt?: number;
    output?: any;
  }>;
  startedAt: string;
  completedAt?: string;
}

function unwrapWorkflowPayload(response: { workflow?: Workflow } | Workflow): Workflow {
  if (response && typeof response === 'object' && 'workflow' in response && response.workflow) {
    return response.workflow;
  }
  return response as Workflow;
}

// Disable auto-toasts on all workflow calls.
// Callers (WorkflowContext, WorkflowBuilder) own error display so they can
// decide whether to show a toast, log silently, or do nothing for background polls.
const silent = { showErrorToast: false } as const;

export const workflowApi = {
  async listWorkflows(): Promise<Workflow[]> {
    const response = await apiClient.get<{ workflows: Workflow[] }>('/api/workflows', silent);
    return response.workflows;
  },

  async getWorkflow(workflowId: string): Promise<Workflow> {
    const response = await apiClient.get<{ workflow?: Workflow } | Workflow>(`/api/workflows/${workflowId}`, silent);
    return unwrapWorkflowPayload(response);
  },

  async createWorkflow(data: {
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    isPublic?: boolean;
    isTemplate?: boolean;
  }): Promise<Workflow> {
    const response = await apiClient.post<{ workflow?: Workflow } | Workflow>('/api/workflows', data, silent);
    return unwrapWorkflowPayload(response);
  },

  async updateWorkflow(workflowId: string, data: Partial<Workflow>): Promise<Workflow> {
    const response = await apiClient.put<{ workflow?: Workflow } | Workflow>(`/api/workflows/${workflowId}`, data, silent);
    return unwrapWorkflowPayload(response);
  },

  async deleteWorkflow(workflowId: string): Promise<void> {
    await apiClient.delete(`/api/workflows/${workflowId}`, silent);
  },

  async executeWorkflow(workflowId: string, input?: Record<string, any>): Promise<WorkflowExecution> {
    const response = await apiClient.post<{ execution: WorkflowExecution }>(
      `/api/workflows/${workflowId}/execute`,
      { input },
      silent,
    );
    return response.execution;
  },

  async getExecutions(workflowId: string): Promise<WorkflowExecution[]> {
    const response = await apiClient.get<{ executions: WorkflowExecution[] }>(
      `/api/workflows/${workflowId}/executions`,
      silent,
    );
    return response.executions;
  },

  async getExecutionStatus(executionId: string): Promise<WorkflowExecution> {
    return await apiClient.get<WorkflowExecution>(`/api/workflows/executions/${executionId}`, {
      ...silent,
      retries: 0,
    });
  },

  async cancelExecution(executionId: string): Promise<void> {
    await apiClient.post(`/api/workflows/executions/${executionId}/cancel`, {}, silent);
  },
};
