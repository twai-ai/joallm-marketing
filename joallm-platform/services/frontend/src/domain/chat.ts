import { mapBackendSourceToKnowledgeSource } from './knowledge';

export interface BackendRAGChatSource {
  id: string;
  filename: string;
  content: string;
  score: number;
  chunkIndex: number;
}

export interface BackendRAGChatMessage {
  id: string;
  message: string;
  response: string;
  sources: BackendRAGChatSource[];
  timestamp: string;
  conversationId: string;
}

export const mapBackendChatSource = mapBackendSourceToKnowledgeSource;

export const mapBackendChatMessage = (message: BackendRAGChatMessage) => ({
  ...message,
  sources: message.sources.map(mapBackendChatSource),
});
