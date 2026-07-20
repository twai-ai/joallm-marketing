import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics();

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type']
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

export const databaseConnections = new Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

export const redisConnections = new Gauge({
  name: 'redis_connections_active',
  help: 'Number of active Redis connections'
});

export const chatMessagesTotal = new Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages processed',
  labelNames: ['model', 'status']
});

export const ragDocumentsTotal = new Counter({
  name: 'rag_documents_total',
  help: 'Total number of RAG documents processed',
  labelNames: ['operation', 'status']
});

export const vectorSearchDuration = new Histogram({
  name: 'vector_search_duration_seconds',
  help: 'Duration of vector search operations in seconds',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

export const llmApiCalls = new Counter({
  name: 'llm_api_calls_total',
  help: 'Total number of LLM API calls',
  labelNames: ['provider', 'model', 'status']
});

export const llmApiDuration = new Histogram({
  name: 'llm_api_duration_seconds',
  help: 'Duration of LLM API calls in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60]
});

export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'Total number of LLM tokens processed',
  labelNames: ['provider', 'model', 'type']
});

// Health check metrics
export const serviceHealth = new Gauge({
  name: 'service_health',
  help: 'Service health status (1 = healthy, 0 = unhealthy)',
  labelNames: ['service', 'check']
});

// Business metrics
export const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations'
});

export const userLogins = new Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['method']
});

export const sessionCreations = new Counter({
  name: 'session_creations_total',
  help: 'Total number of chat sessions created',
  labelNames: ['user_id']
});

// Error tracking
export const errorTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['service', 'error_type', 'severity']
});

// Performance metrics
export const responseTimePercentiles = new Histogram({
  name: 'response_time_percentiles',
  help: 'Response time percentiles',
  labelNames: ['service', 'endpoint'],
  buckets: [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1]
});

// Memory and resource metrics
export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type']
});

export const cpuUsage = new Gauge({
  name: 'cpu_usage_percent',
  help: 'CPU usage percentage'
});

// Custom business logic metrics
export const documentProcessingTime = new Histogram({
  name: 'document_processing_duration_seconds',
  help: 'Time taken to process documents',
  labelNames: ['document_type', 'operation'],
  buckets: [1, 5, 10, 30, 60, 120, 300]
});

export const embeddingGenerationTime = new Histogram({
  name: 'embedding_generation_duration_seconds',
  help: 'Time taken to generate embeddings',
  labelNames: ['model', 'document_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// Queue metrics
export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Current queue size',
  labelNames: ['queue_name']
});

export const queueProcessingTime = new Histogram({
  name: 'queue_processing_duration_seconds',
  help: 'Time taken to process queue items',
  labelNames: ['queue_name', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
});

// Export the register for use in metrics endpoint
export { register };






