// API Configuration
import { env } from './env';

export const API_BASE_URL = env.VITE_API_URL;

export const API_ENDPOINTS = {
  me: {
    access: `${API_BASE_URL}/api/me/access`,
  },
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
    logout: `${API_BASE_URL}/api/auth/logout`,
    refresh: `${API_BASE_URL}/api/auth/refresh`,
    profile: `${API_BASE_URL}/api/auth/profile`,
  },
  security: {
    verify2FA: `${API_BASE_URL}/api/security/2fa/verify`,
  },
  chat: {
    // Session management
    sessions: `${API_BASE_URL}/api/chat/sessions`,
    createSession: `${API_BASE_URL}/api/chat/sessions`,
    session: (sessionId: string) => `${API_BASE_URL}/api/chat/session/${sessionId}`, // Supports both UUID and shortId
    updateTitle: (sessionId: string) => `${API_BASE_URL}/api/chat/session/${sessionId}/title`,
    generateTitle: (sessionId: string) => `${API_BASE_URL}/api/chat/session/${sessionId}/generate-title`,
    deleteSession: (sessionId: string) => `${API_BASE_URL}/api/chat/sessions/${sessionId}`,
    messageSignal: (messageId: string) => `${API_BASE_URL}/api/chat/messages/${messageId}/signal`,
    saveMessageToKnowledge: (messageId: string) => `${API_BASE_URL}/api/chat/messages/${messageId}/save-to-knowledge`,
    sessionComplete: (sessionId: string) => `${API_BASE_URL}/api/chat/sessions/${sessionId}/complete`,
    
    // Chat operations
    send: `${API_BASE_URL}/api/chat/send`,
    stream: `${API_BASE_URL}/api/chat/stream`,
    history: (sessionId: string) => `${API_BASE_URL}/api/chat/history/${sessionId}`,
    
    // Legacy endpoints (kept for backward compatibility)
    delete: (sessionId: string) => `${API_BASE_URL}/api/chat/sessions/${sessionId}`,
  },
  files: {
    upload: `${API_BASE_URL}/api/files/upload`,
    list: `${API_BASE_URL}/api/files`,
    file: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}`,
    delete: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}`,
    status: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/status`,
    download: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/download`,
    /** Inline image preview — always proxied (no R2 redirect) for gallery thumbnails */
    preview: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/preview`,
    reprocess: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/reprocess`,
    migrateStorage: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/migrate-storage`,
    transcript: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/transcript`,
    insights: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/insights`,
    mediaResults: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/media-results`,
    analyzeMedia: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/analyze-media`,
    createClip: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/clips`,
    listClips: (fileId: string) => `${API_BASE_URL}/api/files/${fileId}/clips`,
    downloadClip: (fileId: string, renderOutputId: string) =>
      `${API_BASE_URL}/api/files/${fileId}/clips/${renderOutputId}/download`,
  },
  rag: {
    search: `${API_BASE_URL}/api/rag/search`,
    chat: `${API_BASE_URL}/api/rag/chat`,
    hybridSearch: `${API_BASE_URL}/api/rag/search/hybrid`,
    queryEnhance: `${API_BASE_URL}/api/rag/query/enhance`,
    contextOptimize: `${API_BASE_URL}/api/rag/context/optimize`,
    analytics: `${API_BASE_URL}/api/rag/analytics/dashboard`,
    reindex: (fileId: string) => `${API_BASE_URL}/api/rag/reindex/${fileId}`,
    chunks: (fileId: string) => `${API_BASE_URL}/api/rag/chunks/${fileId}`,
    stats: `${API_BASE_URL}/api/rag/stats`,
    
    // RAG Sessions
    sessions: `${API_BASE_URL}/api/rag/sessions`,
    session: (sessionId: string) => `${API_BASE_URL}/api/rag/sessions/${sessionId}`,
    sessionMessages: (sessionId: string) => `${API_BASE_URL}/api/rag/sessions/${sessionId}/messages`,
    sessionQueries: (sessionId: string) => `${API_BASE_URL}/api/rag/sessions/${sessionId}/queries`,
  },
  models: {
    list: `${API_BASE_URL}/api/models`,
  },
  workflows: {
    list: `${API_BASE_URL}/api/workflows`,
    workflow: (workflowId: string) => `${API_BASE_URL}/api/workflows/${workflowId}`,
    execute: (workflowId: string) => `${API_BASE_URL}/api/workflows/${workflowId}/execute`,
  },
  notebooks: {
    list: `${API_BASE_URL}/api/notebooks`,
    notebook: (notebookId: string) => `${API_BASE_URL}/api/notebooks/${notebookId}`,
    executeCell: (notebookId: string) => `${API_BASE_URL}/api/notebooks/${notebookId}/execute-cell`,
  },
  users: {
    profile: `${API_BASE_URL}/api/users/profile`,
    settings: `${API_BASE_URL}/api/users/settings`,
  },
  feedback: {
    message: (messageId: string) => `${API_BASE_URL}/api/feedback/messages/${messageId}`,
    trainingConsent: `${API_BASE_URL}/api/feedback/training-consent`,
  },
  story: {
    list: `${API_BASE_URL}/api/story`,
    create: `${API_BASE_URL}/api/story`,
    story: (storyId: string) => `${API_BASE_URL}/api/story/${storyId}`,
    addFiles: (storyId: string) => `${API_BASE_URL}/api/story/${storyId}/beats/files`,
    propose: (storyId: string) => `${API_BASE_URL}/api/story/${storyId}/propose`,
    generateBeat: (storyId: string) => `${API_BASE_URL}/api/story/${storyId}/beats/generate`,
    brandBeat: (storyId: string, beatId: string) =>
      `${API_BASE_URL}/api/story/${storyId}/beats/${beatId}/brand`,
    similarBeat: (storyId: string, beatId: string) =>
      `${API_BASE_URL}/api/story/${storyId}/beats/${beatId}/similar`,
    brandKit: (storyId: string) => `${API_BASE_URL}/api/story/${storyId}/brand-kit`,
    exportPptx: (storyId: string) => `${API_BASE_URL}/api/story/${storyId}/export/pptx`,
  },
};
