import { apiClient } from '../utils/api-client';

export type CellType = 'markdown' | 'code' | 'ai' | 'chart' | 'knowledge' | 'agent' | 'debug';

export interface Notebook {
  id: string;
  userId: string;
  title: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotebookCell {
  id: string;
  notebookId: string;
  cellType: CellType;
  content: string;
  output?: string;
  executionCount: number;
  position: number;
  metadata: Record<string, any>;
  attachedDocuments: string[];
  ragConfig?: {
    chunkSize: number;
    overlap: number;
    embeddingModel: string;
    searchTopK: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface NotebookWithCells {
  notebook: Notebook;
  cells: NotebookCell[];
}

export const notebookApi = {
  // List notebooks
  async listNotebooks(): Promise<Notebook[]> {
    const response = await apiClient.get('/api/notebooks');
    return response.notebooks;
  },

  // Get notebook with cells
  async getNotebook(notebookId: string): Promise<NotebookWithCells> {
    return await apiClient.get(`/api/notebooks/${notebookId}`);
  },

  // Create notebook
  async createNotebook(data: {
    title: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<Notebook> {
    const response = await apiClient.post('/api/notebooks', data);
    return response.notebook;
  },

  // Update notebook
  async updateNotebook(notebookId: string, data: Partial<Notebook>): Promise<Notebook> {
    const response = await apiClient.put(`/api/notebooks/${notebookId}`, data);
    return response.notebook;
  },

  // Delete notebook
  async deleteNotebook(notebookId: string): Promise<void> {
    await apiClient.delete(`/api/notebooks/${notebookId}`);
  },

  // Add cell
  async addCell(notebookId: string, data: {
    cellType: CellType;
    content: string;
    position: number;
    output?: string;
    metadata?: Record<string, any>;
    attachedDocuments?: string[];
    ragConfig?: any;
  }): Promise<NotebookCell> {
    const response = await apiClient.post(`/api/notebooks/${notebookId}/cells`, data);
    return response.cell;
  },

  // Update cell
  async updateCell(notebookId: string, cellId: string, data: Partial<NotebookCell>): Promise<NotebookCell> {
    const response = await apiClient.put(`/api/notebooks/${notebookId}/cells/${cellId}`, data);
    return response.cell;
  },

  // Delete cell
  async deleteCell(notebookId: string, cellId: string): Promise<void> {
    await apiClient.delete(`/api/notebooks/${notebookId}/cells/${cellId}`);
  },

  // Execute cell
  async executeCell(notebookId: string, cellId: string): Promise<NotebookCell> {
    const response = await apiClient.post(`/api/notebooks/${notebookId}/cells/${cellId}/execute`, {});
    return response.cell;
  },

  // Reorder cells
  async reorderCells(notebookId: string, cellOrder: Array<{ cellId: string; position: number }>): Promise<void> {
    await apiClient.post(`/api/notebooks/${notebookId}/cells/reorder`, { cellOrder });
  },
};

