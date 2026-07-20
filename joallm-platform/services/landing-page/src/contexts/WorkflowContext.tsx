import React, { createContext, useContext, useState, ReactNode } from 'react';

export type WorkflowNode = {
  id: string;
  type: 'input' | 'llm' | 'tool' | 'output' | 'condition' | 'knowledge' | 'agent' | 'debug';
  name: string;
  position: { x: number; y: number };
  data: any;
  connections: string[];
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
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
};

interface WorkflowContextType {
  workflows: Workflow[];
  activeWorkflow: Workflow | null;
  setActiveWorkflow: (workflow: Workflow | null) => void;
  createWorkflow: (name: string, description: string) => void;
  updateWorkflow: (workflow: Workflow) => void;
  deleteWorkflow: (id: string) => void;
  addNode: (node: Omit<WorkflowNode, 'id'>) => void;
  updateNode: (id: string, data: Partial<WorkflowNode>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: Omit<WorkflowEdge, 'id'>) => void;
  deleteEdge: (id: string) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);

  const createWorkflow = (name: string, description: string) => {
    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name,
      description,
      nodes: [],
      edges: [],
      created: new Date(),
      modified: new Date(),
    };
    setWorkflows(prev => [...prev, newWorkflow]);
    setActiveWorkflow(newWorkflow);
  };

  const updateWorkflow = (workflow: Workflow) => {
    const updatedWorkflow = { ...workflow, modified: new Date() };
    setWorkflows(prev => prev.map(w => w.id === workflow.id ? updatedWorkflow : w));
    if (activeWorkflow?.id === workflow.id) {
      setActiveWorkflow(updatedWorkflow);
    }
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    if (activeWorkflow?.id === id) {
      setActiveWorkflow(null);
    }
  };

  const addNode = (node: Omit<WorkflowNode, 'id'>) => {
    if (!activeWorkflow) return;
    
    const newNode: WorkflowNode = {
      ...node,
      id: `node-${Date.now()}`,
    };
    
    const updatedWorkflow = {
      ...activeWorkflow,
      nodes: [...activeWorkflow.nodes, newNode],
    };
    
    updateWorkflow(updatedWorkflow);
  };

  const updateNode = (id: string, data: Partial<WorkflowNode>) => {
    if (!activeWorkflow) return;
    
    const updatedWorkflow = {
      ...activeWorkflow,
      nodes: activeWorkflow.nodes.map(node => 
        node.id === id ? { ...node, ...data } : node
      ),
    };
    
    updateWorkflow(updatedWorkflow);
  };

  const deleteNode = (id: string) => {
    if (!activeWorkflow) return;
    
    const updatedWorkflow = {
      ...activeWorkflow,
      nodes: activeWorkflow.nodes.filter(node => node.id !== id),
      edges: activeWorkflow.edges.filter(edge => 
        edge.source !== id && edge.target !== id
      ),
    };
    
    updateWorkflow(updatedWorkflow);
  };

  const addEdge = (edge: Omit<WorkflowEdge, 'id'>) => {
    if (!activeWorkflow) return;
    
    const newEdge: WorkflowEdge = {
      ...edge,
      id: `edge-${Date.now()}`,
    };
    
    const updatedWorkflow = {
      ...activeWorkflow,
      edges: [...activeWorkflow.edges, newEdge],
    };
    
    updateWorkflow(updatedWorkflow);
  };

  const deleteEdge = (id: string) => {
    if (!activeWorkflow) return;
    
    const updatedWorkflow = {
      ...activeWorkflow,
      edges: activeWorkflow.edges.filter(edge => edge.id !== id),
    };
    
    updateWorkflow(updatedWorkflow);
  };

  return (
    <WorkflowContext.Provider value={{
      workflows,
      activeWorkflow,
      setActiveWorkflow,
      createWorkflow,
      updateWorkflow,
      deleteWorkflow,
      addNode,
      updateNode,
      deleteNode,
      addEdge,
      deleteEdge,
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