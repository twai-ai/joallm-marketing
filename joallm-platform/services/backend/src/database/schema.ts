import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, index, primaryKey, real, varchar, unique } from 'drizzle-orm/pg-core';
import { vector } from 'pgvector/drizzle-orm';
import { relations } from 'drizzle-orm';

// Enable pgvector extension
export const pgVectorExtension = pgTable('vector_extension', {
  id: text('id').primaryKey(),
});

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  role: text('role', { enum: ['casual', 'admin', 'premium', 'superuser'] }).default('casual'),
  subscriptionTier: text('subscription_tier', { enum: ['free', 'pro', 'enterprise'] }).default('free'),
  usageStats: jsonb('usage_stats').$type<{
    totalTokens: number;
    totalRequests: number;
    totalFiles: number;
    lastReset: string;
  }>(),
  apiKeys: jsonb('api_keys').$type<{
    openai?: string;
    anthropic?: string;
    groq?: string;
    cohere?: string;
    ollama?: string;
    /** Creative AI — Google Imagen (also accepts legacy `google`) */
    google_imagen?: string;
    google?: string;
    flux?: string;
    ideogram?: string;
    stability?: string;
    adobe_firefly?: string;
    adobe?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
}));

// Enterprise scaffolding
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  domain: text('domain'),
  plan: text('plan', { enum: ['starter', 'team', 'enterprise'] }).default('starter'),
  settings: jsonb('settings').$type<Record<string, any>>().default({}),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  createdByIdx: index('organizations_created_by_idx').on(table.createdBy),
}));

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  isDefault: boolean('is_default').default(false),
  settings: jsonb('settings').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('workspaces_organization_id_idx').on(table.organizationId),
  organizationSlugUnique: unique('workspaces_organization_slug_unique').on(table.organizationId, table.slug),
}));

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).default('member').notNull(),
  status: text('status', { enum: ['active', 'invited', 'suspended'] }).default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('memberships_organization_id_idx').on(table.organizationId),
  workspaceIdIdx: index('memberships_workspace_id_idx').on(table.workspaceId),
  userIdIdx: index('memberships_user_id_idx').on(table.userId),
  organizationUserWorkspaceUnique: unique('memberships_org_user_workspace_unique').on(table.organizationId, table.userId, table.workspaceId),
}));

// Chat sessions table
export const chatSessions = pgTable('chat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  shortId: text('short_id').notNull().unique(),
  slug: text('slug'),
  title: text('title'),
  model: text('model').notNull(),
  parameters: jsonb('parameters').$type<{
    temperature: number;
    maxTokens: number;
    topP: number;
    frequencyPenalty: number;
    presencePenalty: number;
  }>(),
  autoTitle: boolean('auto_title').default(false).notNull(),
  isActive: boolean('is_active').default(true),
  // Training signals
  completionStatus: text('completion_status', { enum: ['completed', 'abandoned', 'error'] }),
  turnCount: integer('turn_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('chat_sessions_user_id_idx').on(table.userId),
  createdAtIdx: index('chat_sessions_created_at_idx').on(table.createdAt),
  shortIdIdx: index('chat_sessions_short_id_idx').on(table.shortId),
}));

// Messages table
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'),
  ragMode: text('rag_mode', { enum: ['standard', 'research', 'compliance', 'decision'] }),
  attachments: jsonb('attachments').$type<Array<{
    type: 'image' | 'file';
    name: string;
    url: string;
  }>>(),
  usage: jsonb('usage').$type<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  }>(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  // Implicit training signals
  wasRegenerated: boolean('was_regenerated').default(false),
  wasCopied: boolean('was_copied').default(false),
  qualityScore: real('quality_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index('messages_session_id_idx').on(table.sessionId),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  ragModeIdx: index('messages_rag_mode_idx').on(table.ragMode),
}));

// Files table
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimetype: text('mimetype').notNull(),
  size: integer('size').notNull(),
  storageProvider: text('storage_provider', { enum: ['volume', 'cloudflare-r2', 'aws-s3'] }).default('volume'),
  storageUrl: text('storage_url'),
  storageKey: text('storage_key'),
  status: text('status', { enum: ['uploaded', 'processing', 'processed', 'failed'] }).default('uploaded'),
  processingError: text('processing_error'),
  metadata: jsonb('metadata').$type<{
    // Document fields
    pages?: number;
    language?: string;
    extractedText?: string;
    wordCount?: number;
    characterCount?: number;
    originalFormat?: string;
    embeddingModel?: string;
    chunks?: number;
    indexedAt?: string;
    processingStage?: string;
    indexingStatus?: string;
    indexingFailed?: boolean;
    indexingError?: string;
    indexingAttemptedAt?: string;
    keywordSearchAvailable?: boolean;
    vectorSearchAvailable?: boolean;
    storeOriginal?: boolean;
    // Media fields (audio/video)
    mediaType?: 'video' | 'audio';
    duration?: number;        // seconds
    width?: number;
    height?: number;
    fps?: number;
    videoCodec?: string;
    audioCodec?: string;
    audioChannels?: number;
    bitrate?: number;         // kbps
    metadataExtractedAt?: string;
    audioStorageKey?: string; // extracted audio track key in storage
    mediaKnowledgeSyncedAt?: string;
    /** When set, Media AI insights are bridged onto this Person Timeline */
    acquisitionPersonId?: string;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('files_user_id_idx').on(table.userId),
  statusIdx: index('files_status_idx').on(table.status),
  createdAtIdx: index('files_created_at_idx').on(table.createdAt),
}));

// Transcript segments — output of media transcription pipeline
export const transcriptSegments = pgTable('transcript_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  speaker: text('speaker'),
  startTime: real('start_time').notNull(),
  endTime: real('end_time').notNull(),
  text: text('text').notNull(),
  confidence: real('confidence'),
  sequenceIndex: integer('sequence_index').notNull(),
  language: text('language'),
  metadata: jsonb('metadata').$type<{
    words?: Array<{ word: string; start: number; end: number; confidence?: number }>;
    noSpeechProb?: number;
    avgLogprob?: number;
    lowConfidence?: boolean;
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fileIdIdx: index('transcript_segments_file_id_idx').on(table.fileId),
  startTimeIdx: index('transcript_segments_start_time_idx').on(table.fileId, table.startTime),
}));

// Media insights — highlights, summaries, key moments generated from transcripts
export const mediaInsights = pgTable('media_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  insightType: text('insight_type', {
    enum: ['highlight', 'summary', 'key_moment', 'topic', 'action_item'],
  }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startTime: real('start_time'),
  endTime: real('end_time'),
  score: real('score'),
  tags: text('tags').array().notNull().default([]),
  metadata: jsonb('metadata').$type<{
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    sourceSegmentIds?: string[];
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fileIdIdx: index('media_insights_file_id_idx').on(table.fileId),
  typeIdx: index('media_insights_type_idx').on(table.fileId, table.insightType),
}));

// Document chunks table (for RAG)
export const documentChunks = pgTable('document_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  metadata: jsonb('metadata').$type<{
    pageNumber?: number;
    startChar: number;
    endChar: number;
    section?: string;
    heading?: string;
    mediaStartTime?: number;
    mediaEndTime?: number;
    sourceType?: 'document' | 'media_transcript' | 'media_summary';
    tags?: string[];
  }>(),
  embedding: vector('embedding', { dimensions: 1024 }), // Vector embeddings using pgvector (Cohere embed-english-v3.0)
  embeddingModel: text('embedding_model'), // Model used to generate the embedding (e.g. 'embed-english-v3.0', 'text-embedding-ada-002')
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fileIdIdx: index('document_chunks_file_id_idx').on(table.fileId),
  chunkIndexIdx: index('document_chunks_chunk_index_idx').on(table.chunkIndex),
  // Note: Vector index is created via raw SQL migration (0002_fix_embeddings.sql)
  // Cannot use Drizzle index() here as it creates btree by default
  // embeddingIdx: index('document_chunks_embedding_idx').on(table.embedding),
}));

// Workflows table (for workflow builder)
export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  description: text('description'),
  nodes: jsonb('nodes').$type<Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, any>;
  }>>().notNull(),
  edges: jsonb('edges').$type<Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>>().notNull(),
  isPublic: boolean('is_public').default(false),
  isTemplate: boolean('is_template').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('workflows_user_id_idx').on(table.userId),
  workspaceIdIdx: index('workflows_workspace_id_idx').on(table.workspaceId),
  isPublicIdx: index('workflows_is_public_idx').on(table.isPublic),
  isTemplateIdx: index('workflows_is_template_idx').on(table.isTemplate),
}));

// Workflow executions table
export const workflowExecutions = pgTable('workflow_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['running', 'completed', 'failed', 'cancelled', 'suspended'] }).default('running'),
  input: jsonb('input').$type<Record<string, any>>(),
  output: jsonb('output').$type<Record<string, any>>(),
  error: text('error'),
  executionLog: jsonb('execution_log').$type<Array<{
    timestamp: string;
    nodeId: string;
    status: 'running' | 'suspended' | 'completed' | 'failed';
    message?: string;
    attempt?: number;
    output?: any;
  }>>(),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  // Durable execution: checkpoint stores structural DAG state (refs, not blobs)
  checkpoint: jsonb('checkpoint').$type<{
    contextRefs: Record<string, any>;
    completedNodeIds: string[];
    pendingIncoming: Record<string, number>;
    enabledNodeIds: string[];
  }>(),
  // Describes which external event should resume this execution
  resumeTrigger: jsonb('resume_trigger').$type<{
    nodeId: string;
    jobType: string;
    externalJobId: string;
    fileId: string;
  }>(),
}, (table) => ({
  workflowIdIdx: index('workflow_executions_workflow_id_idx').on(table.workflowId),
  userIdIdx: index('workflow_executions_user_id_idx').on(table.userId),
  statusIdx: index('workflow_executions_status_idx').on(table.status),
  startedAtIdx: index('workflow_executions_started_at_idx').on(table.startedAt),
}));

// Edit plans — versioned media processing plans (Media Lab)
export const editPlans = pgTable('edit_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  version: integer('version').notNull().default(1),
  status: text('status', { enum: ['draft', 'ready', 'rendering', 'done', 'failed'] }).notNull().default('draft'),
  steps: jsonb('steps').$type<Array<{
    id: string;
    stepType: 'clip' | 'transcribe' | 'caption' | 'insight' | 'export';
    config: Record<string, any>;
    order: number;
  }>>().notNull().default([]),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('edit_plans_user_id_idx').on(table.userId),
  fileIdIdx: index('edit_plans_file_id_idx').on(table.fileId),
}));

// Render outputs — clips and exports produced by edit plans (Media Lab)
export const renderOutputs = pgTable('render_outputs', {
  id: uuid('id').primaryKey().defaultRandom(),
  editPlanId: uuid('edit_plan_id').notNull().references(() => editPlans.id, { onDelete: 'cascade' }),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),
  storageProvider: text('storage_provider', { enum: ['volume', 'cloudflare-r2', 'aws-s3'] }).notNull().default('volume'),
  format: text('format').notNull(),   // mp4, mp3, srt, txt
  duration: real('duration'),
  sizeBytes: integer('size_bytes'),
  status: text('status', { enum: ['pending', 'rendering', 'done', 'failed'] }).notNull().default('pending'),
  error: text('error'),
  metadata: jsonb('metadata').$type<{
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
    bitrate?: number;
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  editPlanIdIdx: index('render_outputs_edit_plan_id_idx').on(table.editPlanId),
  fileIdIdx: index('render_outputs_file_id_idx').on(table.fileId),
}));

// API usage tracking
export const apiUsage = pgTable('api_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  model: text('model'),
  tokensUsed: integer('tokens_used'),
  cost: integer('cost'), // in cents
  responseTime: integer('response_time'), // in milliseconds
  statusCode: integer('status_code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('api_usage_user_id_idx').on(table.userId),
  createdAtIdx: index('api_usage_created_at_idx').on(table.createdAt),
  endpointIdx: index('api_usage_endpoint_idx').on(table.endpoint),
}));

export const inferenceRuns = pgTable('inference_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  status: text('status', { enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'] }).default('queued').notNull(),
  input: jsonb('input').$type<Record<string, any>>(),
  output: jsonb('output').$type<Record<string, any>>(),
  errorMessage: text('error_message'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  cost: integer('cost'),
  latencyMs: integer('latency_ms'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  organizationIdIdx: index('inference_runs_organization_id_idx').on(table.organizationId),
  workspaceIdIdx: index('inference_runs_workspace_id_idx').on(table.workspaceId),
  userIdIdx: index('inference_runs_user_id_idx').on(table.userId),
  statusIdx: index('inference_runs_status_idx').on(table.status),
  createdAtIdx: index('inference_runs_created_at_idx').on(table.createdAt),
}));

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  chatSessions: many(chatSessions),
  files: many(files),
  workflows: many(workflows),
  workflowExecutions: many(workflowExecutions),
  apiUsage: many(apiUsage),
  searchHistory: many(searchHistory),
  bookmarks: many(bookmarks),
  preferences: many(userPreferences),
  security: many(userSecurity),
  notebooks: many(notebooks),
  createdOrganizations: many(organizations),
  memberships: many(memberships, { relationName: 'membershipUser' }),
  invitedMemberships: many(memberships, { relationName: 'membershipInviter' }),
  inferenceRuns: many(inferenceRuns),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [organizations.createdBy],
    references: [users.id],
  }),
  workspaces: many(workspaces),
  memberships: many(memberships),
  inferenceRuns: many(inferenceRuns),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  memberships: many(memberships),
  inferenceRuns: many(inferenceRuns),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [memberships.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    relationName: 'membershipUser',
    fields: [memberships.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    relationName: 'membershipInviter',
    fields: [memberships.invitedBy],
    references: [users.id],
  }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [messages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id],
  }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  file: one(files, {
    fields: [documentChunks.fileId],
    references: [files.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
  executions: many(workflowExecutions),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowExecutions.workflowId],
    references: [workflows.id],
  }),
  user: one(users, {
    fields: [workflowExecutions.userId],
    references: [users.id],
  }),
}));

export const apiUsageRelations = relations(apiUsage, ({ one }) => ({
  user: one(users, {
    fields: [apiUsage.userId],
    references: [users.id],
  }),
}));

export const inferenceRunsRelations = relations(inferenceRuns, ({ one }) => ({
  organization: one(organizations, {
    fields: [inferenceRuns.organizationId],
    references: [organizations.id],
  }),
  workspace: one(workspaces, {
    fields: [inferenceRuns.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [inferenceRuns.userId],
    references: [users.id],
  }),
}));

// Search history table (for tracking RAG searches)
export const searchHistory = pgTable('search_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  query: text('query').notNull(),
  resultsCount: integer('results_count').default(0),
  searchTime: integer('search_time').default(0), // Duration in milliseconds
  averageScore: real('average_score'),
  fileIds: jsonb('file_ids').$type<string[]>(),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('search_history_user_id_idx').on(table.userId),
  createdAtIdx: index('search_history_created_at_idx').on(table.createdAt),
  queryIdx: index('search_history_query_idx').on(table.query),
}));

export const searchHistoryRelations = relations(searchHistory, ({ one }) => ({
  user: one(users, {
    fields: [searchHistory.userId],
    references: [users.id],
  }),
}));

// RAG search sessions table (for tracking search sessions)
export const ragSearchSessions = pgTable('rag_search_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  shortId: text('short_id').notNull().unique(),
  title: text('title'),
  searchType: text('search_type', { enum: ['vector', 'keyword', 'hybrid'] }).default('hybrid'),
  parameters: jsonb('parameters').$type<{
    limit: number;
    threshold: number;
    vectorWeight: number;
    keywordWeight: number;
    includeMetadata: boolean;
  }>(),
  documentIds: jsonb('document_ids').$type<string[]>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('rag_search_sessions_user_id_idx').on(table.userId),
  createdAtIdx: index('rag_search_sessions_created_at_idx').on(table.createdAt),
  shortIdIdx: index('rag_search_sessions_short_id_idx').on(table.shortId),
}));

// RAG search queries table (for tracking individual searches within sessions)
export const ragSearchQueries = pgTable('rag_search_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => ragSearchSessions.id, { onDelete: 'cascade' }),
  query: text('query').notNull(),
  enhancedQuery: text('enhanced_query'),
  resultsCount: integer('results_count').default(0),
  searchTime: integer('search_time').default(0), // Duration in milliseconds
  averageScore: real('average_score'),
  searchType: text('search_type', { enum: ['vector', 'keyword', 'hybrid'] }),
  parameters: jsonb('parameters').$type<{
    limit: number;
    threshold: number;
    vectorWeight: number;
    keywordWeight: number;
    includeMetadata: boolean;
  }>(),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sessionIdIdx: index('rag_search_queries_session_id_idx').on(table.sessionId),
  createdAtIdx: index('rag_search_queries_created_at_idx').on(table.createdAt),
  queryIdx: index('rag_search_queries_query_idx').on(table.query),
}));

export const ragSearchSessionsRelations = relations(ragSearchSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [ragSearchSessions.userId],
    references: [users.id],
  }),
  queries: many(ragSearchQueries),
}));

export const ragSearchQueriesRelations = relations(ragSearchQueries, ({ one }) => ({
  session: one(ragSearchSessions, {
    fields: [ragSearchQueries.sessionId],
    references: [ragSearchSessions.id],
  }),
}));

// Survey responses table (for build-measure-learn feedback)
export const surveyResponses = pgTable('survey_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userType: text('user_type', { enum: ['developer', 'business', 'analyst', 'casual'] }).notNull(),
  companySize: text('company_size', { enum: ['1-10', '11-50', '51-200', '201-1000', '1000+'] }),
  industry: text('industry'),
  currentTools: jsonb('current_tools').$type<string[]>().notNull(),
  primaryUseCase: text('primary_use_case').notNull(),
  painPoints: jsonb('pain_points').$type<string[]>().notNull(),
  featureRequests: jsonb('feature_requests').$type<string[]>().notNull(),
  budget: text('budget', { enum: ['free', 'under-100', '100-500', '500-2000', '2000+'] }),
  contactEmail: text('contact_email'),
  additionalComments: text('additional_comments'),
  source: text('source', { enum: ['landing-page', 'demo', 'referral', 'social-media', 'other'] }).default('landing-page'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
}, (table) => ({
  userTypeIdx: index('survey_responses_user_type_idx').on(table.userType),
  completedAtIdx: index('survey_responses_completed_at_idx').on(table.completedAt),
  sourceIdx: index('survey_responses_source_idx').on(table.source),
}));

// Survey analytics table (aggregated data for insights)
export const surveyAnalytics = pgTable('survey_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: text('date').notNull(), // YYYY-MM-DD format
  userType: text('user_type', { enum: ['developer', 'business', 'analyst', 'casual'] }).notNull(),
  totalResponses: integer('total_responses').notNull(),
  topPainPoints: jsonb('top_pain_points').$type<Array<{
    point: string;
    count: number;
    percentage: number;
  }>>(),
  topFeatures: jsonb('top_features').$type<Array<{
    feature: string;
    count: number;
    percentage: number;
  }>>(),
  averageBudget: text('average_budget', { enum: ['free', 'under-100', '100-500', '500-2000', '2000+'] }),
  industryDistribution: jsonb('industry_distribution').$type<Array<{
    industry: string;
    count: number;
    percentage: number;
  }>>(),
  useCaseDistribution: jsonb('use_case_distribution').$type<Array<{
    useCase: string;
    count: number;
    percentage: number;
  }>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  dateIdx: index('survey_analytics_date_idx').on(table.date),
  userTypeIdx: index('survey_analytics_user_type_idx').on(table.userType),
}));

// Models table (for dynamic model management)
export const models = pgTable('models', {
  id: uuid('id').primaryKey().defaultRandom(),
  modelId: text('model_id').notNull().unique(), // The actual model identifier (e.g., 'llama-3.3-70b-versatile')
  name: text('name').notNull(), // Display name (e.g., 'Llama 3.3 70B Versatile (Groq)')
  provider: text('provider').notNull(), // Provider name (e.g., 'Groq', 'OpenAI', 'Anthropic', 'Ollama')
  description: text('description').notNull(), // Model description
  capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]), // Array of capabilities (e.g., ['Text', 'Code', 'Analysis'])
  maxTokens: integer('max_tokens').notNull(), // Maximum tokens supported
  cost: text('cost').notNull(), // Cost information (e.g., '$0.59/1M in + $0.79/1M out')
  speed: text('speed', { enum: ['fast', 'medium', 'slow'] }).notNull(), // Speed rating
  quality: text('quality', { enum: ['high', 'medium', 'low'] }).notNull(), // Quality rating
  isAvailable: boolean('is_available').default(true), // Whether the model is currently available
  isFeatured: boolean('is_featured').default(false), // Whether to feature this model prominently
  sortOrder: integer('sort_order').default(0), // Custom sort order
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}), // Additional metadata (context window, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  providerIdx: index('models_provider_idx').on(table.provider),
  availableIdx: index('models_available_idx').on(table.isAvailable),
  featuredIdx: index('models_featured_idx').on(table.isFeatured),
  sortOrderIdx: index('models_sort_order_idx').on(table.sortOrder),
  capabilitiesIdx: index('models_capabilities_idx').using('gin', table.capabilities),
}));

// Bookmarks table
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  itemType: text('item_type', { enum: ['message', 'chat_session', 'file', 'workflow', 'search_result'] }).notNull(),
  itemId: uuid('item_id').notNull(),
  title: text('title'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('bookmarks_user_id_idx').on(table.userId),
  itemTypeIdx: index('bookmarks_item_type_idx').on(table.itemType),
  createdAtIdx: index('bookmarks_created_at_idx').on(table.createdAt),
  uniqueBookmark: unique('bookmarks_user_item_unique').on(table.userId, table.itemType, table.itemId),
}));

// User preferences table
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme', { enum: ['light', 'dark', 'auto'] }).default('light'),
  fontSize: text('font_size', { enum: ['small', 'medium', 'large'] }).default('medium'),
  compactMode: boolean('compact_mode').default(false),
  emailNotifications: boolean('email_notifications').default(true),
  pushNotifications: boolean('push_notifications').default(false),
  notificationFrequency: text('notification_frequency', { enum: ['immediate', 'hourly', 'daily', 'weekly'] }).default('immediate'),
  analyticsEnabled: boolean('analytics_enabled').default(true),
  errorReporting: boolean('error_reporting').default(true),
  autoSave: boolean('auto_save').default(true),
  streamingEnabled: boolean('streaming_enabled').default(true),
  keyboardShortcutsEnabled: boolean('keyboard_shortcuts_enabled').default(true),
  customShortcuts: jsonb('custom_shortcuts').$type<Record<string, any>>().default({}),
  multimodalSettings: jsonb('multimodal_settings').$type<Record<string, unknown>>().default({}),
  defaultModel: text('default_model'),
  defaultTemperature: real('default_temperature').default(0.7),
  defaultMaxTokens: integer('default_max_tokens').default(2048),
  workspaceMode: text('workspace_mode', { enum: ['personal', 'team', 'enterprise'] }).default('personal'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_preferences_user_id_idx').on(table.userId),
}));

// User security table
export const userSecurity = pgTable('user_security', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  twoFactorSecret: text('two_factor_secret'),
  twoFactorBackupCodes: jsonb('two_factor_backup_codes').$type<string[]>().default([]),
  twoFactorVerifiedAt: timestamp('two_factor_verified_at'),
  passwordChangedAt: timestamp('password_changed_at'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpires: timestamp('password_reset_expires'),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  activeSessions: jsonb('active_sessions').$type<Array<{
    token: string;
    device: string;
    ip: string;
    lastActive: string;
  }>>().default([]),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('user_security_user_id_idx').on(table.userId),
}));

// Notebooks table
export const notebooks = pgTable('notebooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('notebooks_user_id_idx').on(table.userId),
  createdAtIdx: index('notebooks_created_at_idx').on(table.createdAt),
  isPublicIdx: index('notebooks_is_public_idx').on(table.isPublic),
}));

// Notebook cells table
export const notebookCells = pgTable('notebook_cells', {
  id: uuid('id').primaryKey().defaultRandom(),
  notebookId: uuid('notebook_id').notNull().references(() => notebooks.id, { onDelete: 'cascade' }),
  cellType: text('cell_type', { enum: ['markdown', 'code', 'ai', 'chart', 'knowledge', 'agent', 'debug'] }).notNull(),
  content: text('content').notNull(),
  output: text('output'),
  executionCount: integer('execution_count').default(0),
  position: integer('position').notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  attachedDocuments: jsonb('attached_documents').$type<string[]>().default([]),
  ragConfig: jsonb('rag_config').$type<{
    chunkSize: number;
    overlap: number;
    embeddingModel: string;
    searchTopK: number;
  }>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  notebookIdIdx: index('notebook_cells_notebook_id_idx').on(table.notebookId),
  positionIdx: index('notebook_cells_position_idx').on(table.position),
  cellTypeIdx: index('notebook_cells_cell_type_idx').on(table.cellType),
}));

// Define survey relations
export const surveyResponsesRelations = relations(surveyResponses, ({ one }) => ({
  // No foreign keys for anonymous surveys
}));

// Define models relations (no foreign keys needed)
export const modelsRelations = relations(models, ({ one }) => ({
  // Models don't have foreign key relationships
}));

// Bookmarks relations
export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, {
    fields: [bookmarks.userId],
    references: [users.id],
  }),
}));

// User preferences relations
export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

// User security relations
export const userSecurityRelations = relations(userSecurity, ({ one }) => ({
  user: one(users, {
    fields: [userSecurity.userId],
    references: [users.id],
  }),
}));

// Notebooks relations
export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
  cells: many(notebookCells),
}));

// Notebook cells relations
export const notebookCellsRelations = relations(notebookCells, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [notebookCells.notebookId],
    references: [notebooks.id],
  }),
}));

// ─── Training data layer ──────────────────────────────────────────────────────

// Per-message human feedback (thumbs up/down, corrections, flags)
export const messageFeedback = pgTable('message_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => chatSessions.id, { onDelete: 'set null' }),
  rating: text('rating', { enum: ['thumbs_up', 'thumbs_down'] }).notNull(),
  feedbackType: text('feedback_type', { enum: ['rating', 'correction', 'flag'] }).default('rating'),
  correctedText: text('corrected_text'),
  flagReason: text('flag_reason', { enum: ['wrong', 'harmful', 'off_topic', 'incomplete'] }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  messageIdIdx: index('message_feedback_message_id_idx').on(table.messageId),
  userIdIdx: index('message_feedback_user_id_idx').on(table.userId),
  ratingIdx: index('message_feedback_rating_idx').on(table.rating),
  createdAtIdx: index('message_feedback_created_at_idx').on(table.createdAt),
  uniqueUserMessage: unique('message_feedback_user_message_unique').on(table.messageId, table.userId),
}));

// RAG source tracking — which chunks grounded which assistant message
export const messageRagSources = pgTable('message_rag_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  chunkId: uuid('chunk_id').notNull().references(() => documentChunks.id, { onDelete: 'cascade' }),
  rankPosition: integer('rank_position').notNull(),
  similarityScore: real('similarity_score').notNull(),
  wasUsed: boolean('was_used').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  messageIdIdx: index('message_rag_sources_message_id_idx').on(table.messageId),
  chunkIdIdx: index('message_rag_sources_chunk_id_idx').on(table.chunkId),
  uniqueMessageChunk: unique('message_rag_sources_message_chunk_unique').on(table.messageId, table.chunkId),
}));

// Training data consent (versioned per user)
export const trainingConsent = pgTable('training_consent', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  consentGiven: boolean('consent_given').notNull().default(false),
  consentVersion: text('consent_version').notNull().default('v1.0'),
  givenAt: timestamp('given_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('training_consent_user_id_idx').on(table.userId),
  consentGivenIdx: index('training_consent_consent_given_idx').on(table.consentGiven),
}));

// Training dataset registry
export const trainingDatasets = pgTable('training_datasets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  datasetType: text('dataset_type', { enum: ['sft', 'rlhf', 'dpo', 'rag'] }).notNull(),
  status: text('status', { enum: ['collecting', 'ready', 'exported', 'training'] }).notNull().default('collecting'),
  filterCriteria: jsonb('filter_criteria').$type<{
    fromDate?: string;
    toDate?: string;
    minRating?: string;
    models?: string[];
    consentedOnly?: boolean;
  }>().default({}),
  rowCount: integer('row_count').default(0),
  exportPath: text('export_path'),
  exportedAt: timestamp('exported_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('training_datasets_status_idx').on(table.status),
  datasetTypeIdx: index('training_datasets_dataset_type_idx').on(table.datasetType),
}));

// ─── Video frame vision analysis ─────────────────────────────────────────────

export const frameAnalyses = pgTable('frame_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileId: uuid('file_id').notNull().references(() => files.id, { onDelete: 'cascade' }),
  timestampSec: real('timestamp_sec').notNull(),
  description: text('description').notNull(),
  objects: text('objects').array().notNull().default([]),
  detectedText: text('detected_text'),
  confidence: real('confidence'),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  fileIdIdx: index('frame_analyses_file_id_idx').on(table.fileId),
  fileTimestampIdx: index('frame_analyses_file_timestamp_idx').on(table.fileId, table.timestampSec),
}));

// ─── Third-party OAuth integrations (Google Workspace, etc.) ─────────────────

export const userIntegrations = pgTable('user_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google_workspace'
  scopes: text('scopes').array().notNull().default([]),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userProviderUnique: unique('user_integrations_user_provider_unique').on(table.userId, table.provider),
  userIdIdx: index('user_integrations_user_id_idx').on(table.userId),
}));

// ─── Token blacklist (DB fallback when Redis is unavailable) ──────────────────

export const revokedTokens = pgTable('revoked_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  expiresAtIdx: index('revoked_tokens_expires_at_idx').on(table.expiresAt),
}));

// ─── Training data relations ──────────────────────────────────────────────────

export const messageFeedbackRelations = relations(messageFeedback, ({ one }) => ({
  message: one(messages, { fields: [messageFeedback.messageId], references: [messages.id] }),
  user: one(users, { fields: [messageFeedback.userId], references: [users.id] }),
  session: one(chatSessions, { fields: [messageFeedback.sessionId], references: [chatSessions.id] }),
}));

export const messageRagSourcesRelations = relations(messageRagSources, ({ one }) => ({
  message: one(messages, { fields: [messageRagSources.messageId], references: [messages.id] }),
  chunk: one(documentChunks, { fields: [messageRagSources.chunkId], references: [documentChunks.id] }),
}));

export const trainingConsentRelations = relations(trainingConsent, ({ one }) => ({
  user: one(users, { fields: [trainingConsent.userId], references: [users.id] }),
}));

// ─── Acquisition Intelligence ─────────────────────────────────────────────────

export const acquisitionPersons = pgTable('acquisition_persons', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  displayName: text('display_name'),
  primaryEmail: text('primary_email'),
  primaryPhone: text('primary_phone'),
  status: text('status', {
    enum: ['anonymous', 'identified', 'verified', 'merged', 'archived'],
  }).default('identified').notNull(),
  relationshipMaturity: text('relationship_maturity', {
    enum: [
      'unknown',
      'observed',
      'identified',
      'engaged',
      'participating',
      'contributing',
      'leading',
      'mentoring',
      'partnering',
    ],
  }).default('unknown').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('acquisition_persons_owner_user_id_idx').on(table.ownerUserId),
  organizationIdIdx: index('acquisition_persons_organization_id_idx').on(table.organizationId),
  primaryPhoneIdx: index('acquisition_persons_primary_phone_idx').on(table.ownerUserId, table.primaryPhone),
  primaryEmailIdx: index('acquisition_persons_primary_email_idx').on(table.ownerUserId, table.primaryEmail),
  relationshipMaturityIdx: index('acquisition_persons_relationship_maturity_idx').on(
    table.ownerUserId,
    table.relationshipMaturity,
  ),
}));

export const acquisitionPersonIdentities = pgTable('acquisition_person_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  personId: uuid('person_id').notNull().references(() => acquisitionPersons.id, { onDelete: 'cascade' }),
  provider: text('provider', {
    enum: [
      'email',
      'phone',
      'linkedin',
      'meta',
      'google',
      'whatsapp',
      'education_platform',
      'builder_challenge',
      'anonymous_cookie',
      'custom',
    ],
  }).notNull(),
  externalId: text('external_id').notNull(),
  confidence: real('confidence').default(1).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  personIdIdx: index('acquisition_person_identities_person_id_idx').on(table.personId),
  ownerProviderExternalUnique: unique('acquisition_person_identities_owner_provider_external_unique').on(
    table.ownerUserId,
    table.provider,
    table.externalId,
  ),
}));

export const acquisitionInitiatives = pgTable('acquisition_initiatives', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  /** Targeting id aligned with atrisi.org programs catalog (Acquisition Platform) */
  programId: text('program_id'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['draft', 'active', 'paused', 'completed', 'archived'],
  }).default('active').notNull(),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('acquisition_initiatives_owner_user_id_idx').on(table.ownerUserId),
  programIdIdx: index('acquisition_initiatives_program_id_idx').on(table.ownerUserId, table.programId),
}));

export const acquisitionCampaigns = pgTable('acquisition_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  initiativeId: uuid('initiative_id').notNull().references(() => acquisitionInitiatives.id, { onDelete: 'cascade' }),
  /** Targeting id aligned with atrisi.org programs catalog */
  programId: text('program_id'),
  name: text('name').notNull(),
  channel: text('channel'),
  status: text('status', {
    enum: ['draft', 'active', 'paused', 'completed', 'archived'],
  }).default('active').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  initiativeIdIdx: index('acquisition_campaigns_initiative_id_idx').on(table.initiativeId),
  ownerUserIdIdx: index('acquisition_campaigns_owner_user_id_idx').on(table.ownerUserId),
  programIdIdx: index('acquisition_campaigns_program_id_idx').on(table.ownerUserId, table.programId),
}));

export const acquisitionSourceConnections = pgTable('acquisition_source_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(), // meta_whatsapp, brevo, ...
  name: text('name').notNull(),
  status: text('status', {
    enum: ['active', 'paused', 'error', 'disconnected'],
  }).default('active').notNull(),
  externalAccountId: text('external_account_id'), // e.g. WhatsApp phone_number_id
  /** Integration Platform connector (technical) */
  connectorId: uuid('connector_id'),
  /** Marketing Studio channel (business) */
  channelId: uuid('channel_id'),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  lastSuccessAt: timestamp('last_success_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastErrorMessage: text('last_error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('acquisition_source_connections_owner_user_id_idx').on(table.ownerUserId),
  providerIdx: index('acquisition_source_connections_provider_idx').on(table.provider),
  externalAccountIdx: index('acquisition_source_connections_external_account_idx').on(
    table.provider,
    table.externalAccountId,
  ),
}));

export const acquisitionRawRecords = pgTable('acquisition_raw_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  sourceConnectionId: uuid('source_connection_id').notNull().references(() => acquisitionSourceConnections.id, { onDelete: 'cascade' }),
  externalEventId: text('external_event_id'),
  eventName: text('event_name'),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  occurredAt: timestamp('occurred_at'),
  headers: jsonb('headers').$type<Record<string, unknown>>(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  payloadHash: text('payload_hash').notNull(),
  processingStatus: text('processing_status', {
    enum: ['received', 'queued', 'processed', 'failed', 'ignored'],
  }).default('received').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sourceConnectionIdIdx: index('acquisition_raw_records_source_connection_id_idx').on(table.sourceConnectionId),
  ownerUserIdIdx: index('acquisition_raw_records_owner_user_id_idx').on(table.ownerUserId),
  payloadHashIdx: index('acquisition_raw_records_payload_hash_idx').on(table.ownerUserId, table.payloadHash),
  processingStatusIdx: index('acquisition_raw_records_processing_status_idx').on(table.processingStatus),
}));

export const acquisitionEvents = pgTable('acquisition_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  sourceConnectionId: uuid('source_connection_id').notNull().references(() => acquisitionSourceConnections.id, { onDelete: 'cascade' }),
  rawRecordId: uuid('raw_record_id').notNull().references(() => acquisitionRawRecords.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  externalEventId: text('external_event_id'),
  eventType: text('event_type').notNull(),
  occurredAt: timestamp('occurred_at').notNull(),
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  personId: uuid('person_id').references(() => acquisitionPersons.id, { onDelete: 'set null' }),
  initiativeId: uuid('initiative_id').references(() => acquisitionInitiatives.id, { onDelete: 'set null' }),
  campaignId: uuid('campaign_id').references(() => acquisitionCampaigns.id, { onDelete: 'set null' }),
  channel: text('channel'),
  objectType: text('object_type'),
  objectId: text('object_id'),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().default({}),
  schemaVersion: integer('schema_version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('acquisition_events_owner_user_id_idx').on(table.ownerUserId),
  personIdIdx: index('acquisition_events_person_id_idx').on(table.personId),
  eventTypeIdx: index('acquisition_events_event_type_idx').on(table.eventType),
  occurredAtIdx: index('acquisition_events_occurred_at_idx').on(table.ownerUserId, table.occurredAt),
  rawRecordIdIdx: index('acquisition_events_raw_record_id_idx').on(table.rawRecordId),
}));

export const acquisitionInteractions = pgTable('acquisition_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  personId: uuid('person_id').notNull().references(() => acquisitionPersons.id, { onDelete: 'cascade' }),
  initiativeId: uuid('initiative_id').references(() => acquisitionInitiatives.id, { onDelete: 'set null' }),
  campaignId: uuid('campaign_id').references(() => acquisitionCampaigns.id, { onDelete: 'set null' }),
  sourceEventId: uuid('source_event_id').notNull().references(() => acquisitionEvents.id, { onDelete: 'cascade' }),
  kind: text('kind', {
    enum: [
      'visit',
      'submission',
      'message',
      'call',
      'meeting',
      'webinar',
      'learning_activity',
      'application',
      'enrollment',
      'decision',
      'other',
    ],
  }).notNull(),
  direction: text('direction', { enum: ['inbound', 'outbound', 'internal'] }),
  summary: text('summary'),
  occurredAt: timestamp('occurred_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  personIdIdx: index('acquisition_interactions_person_id_idx').on(table.personId),
  ownerUserIdIdx: index('acquisition_interactions_owner_user_id_idx').on(table.ownerUserId),
  occurredAtIdx: index('acquisition_interactions_occurred_at_idx').on(table.personId, table.occurredAt),
  sourceEventIdIdx: index('acquisition_interactions_source_event_id_idx').on(table.sourceEventId),
}));

/** Layer 2 — Knowledge Interpretation output linked onto Timeline subjects */
export const knowledgeArtifacts = pgTable('knowledge_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  personId: uuid('person_id').references(() => acquisitionPersons.id, { onDelete: 'set null' }),
  initiativeId: uuid('initiative_id').references(() => acquisitionInitiatives.id, { onDelete: 'set null' }),
  acquisitionEventId: uuid('acquisition_event_id').references(() => acquisitionEvents.id, { onDelete: 'set null' }),
  interactionId: uuid('interaction_id').references(() => acquisitionInteractions.id, { onDelete: 'set null' }),
  artifactType: text('artifact_type', {
    enum: [
      'email',
      'message',
      'audio',
      'video',
      'transcript',
      'document',
      'form_response',
      'note',
      'application_essay',
      'voice_note',
    ],
  }).notNull(),
  title: text('title'),
  interpretation: jsonb('interpretation').$type<Record<string, unknown>>().default({}),
  signals: jsonb('signals').$type<Record<string, unknown>>().default({}),
  sourceFileId: uuid('source_file_id').references(() => files.id, { onDelete: 'set null' }),
  knowledgeDocumentId: uuid('knowledge_document_id'),
  mediaAssetId: uuid('media_asset_id'),
  occurredAt: timestamp('occurred_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('knowledge_artifacts_owner_user_id_idx').on(table.ownerUserId),
  personIdIdx: index('knowledge_artifacts_person_id_idx').on(table.personId),
  sourceFileIdIdx: index('knowledge_artifacts_source_file_id_idx').on(table.sourceFileId),
}));

// ─── Integration Platform + Marketing Studio publishing ───────────────────────

export const platformConnectors = pgTable('platform_connectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  name: text('name').notNull(),
  apiVersion: text('api_version'),
  status: text('status', {
    enum: ['disconnected', 'connecting', 'connected', 'error', 'revoked'],
  }).default('disconnected').notNull(),
  capabilities: jsonb('capabilities').$type<string[]>().default([]).notNull(),
  config: jsonb('config').$type<Record<string, unknown>>().default({}),
  externalAccountId: text('external_account_id'),
  lastValidatedAt: timestamp('last_validated_at'),
  lastErrorAt: timestamp('last_error_at'),
  lastErrorMessage: text('last_error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('platform_connectors_owner_user_id_idx').on(table.ownerUserId),
  providerIdx: index('platform_connectors_provider_idx').on(table.provider),
}));

export const studioChannels = pgTable('studio_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  status: text('status', {
    enum: ['active', 'paused', 'archived'],
  }).default('active').notNull(),
  connectorId: uuid('connector_id').references(() => platformConnectors.id, { onDelete: 'set null' }),
  connectorProvider: text('connector_provider'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('studio_channels_owner_user_id_idx').on(table.ownerUserId),
  kindIdx: index('studio_channels_kind_idx').on(table.kind),
}));

export const publishingProfiles = pgTable('publishing_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  status: text('status', {
    enum: ['active', 'paused', 'archived'],
  }).default('active').notNull(),
  channelId: uuid('channel_id').notNull().references(() => studioChannels.id, { onDelete: 'cascade' }),
  brandKitId: uuid('brand_kit_id'),
  defaultHashtags: text('default_hashtags').array().default([]),
  defaultUtm: jsonb('default_utm').$type<Record<string, string>>().default({}),
  timezone: text('timezone'),
  defaults: jsonb('defaults').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('publishing_profiles_owner_user_id_idx').on(table.ownerUserId),
  channelIdIdx: index('publishing_profiles_channel_id_idx').on(table.channelId),
}));

export const publishingJobs = pgTable('publishing_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  initiativeId: uuid('initiative_id'),
  campaignId: uuid('campaign_id'),
  marketingAssetId: uuid('marketing_asset_id').notNull(),
  publishingProfileId: uuid('publishing_profile_id').references(() => publishingProfiles.id, { onDelete: 'set null' }),
  channelId: uuid('channel_id').notNull().references(() => studioChannels.id, { onDelete: 'cascade' }),
  connectorId: uuid('connector_id').references(() => platformConnectors.id, { onDelete: 'set null' }),
  status: text('status', {
    enum: ['draft', 'queued', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'],
  }).default('draft').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  publishedAt: timestamp('published_at'),
  externalPostId: text('external_post_id'),
  errorMessage: text('error_message'),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  ownerUserIdIdx: index('publishing_jobs_owner_user_id_idx').on(table.ownerUserId),
  channelIdIdx: index('publishing_jobs_channel_id_idx').on(table.channelId),
  statusIdx: index('publishing_jobs_status_idx').on(table.status),
}));
