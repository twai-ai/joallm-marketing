import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Lock,
  Cpu,
  Package,
  Rocket,
  FileText,
  Lightbulb,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserRole } from '../../contexts/EnhancedUserRoleContext';

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

function useIsInternal(): boolean {
  const { user } = useAuth();
  const { backendRole } = useUserRole();
  if (!user) return false;
  return backendRole === 'admin' || backendRole === 'superuser';
}

// ---------------------------------------------------------------------------
// Document content
// ---------------------------------------------------------------------------

type Section = {
  id: string;
  title: string;
  restricted: boolean;
  pages: Page[];
};

type Page = {
  id: string;
  title: string;
  render: () => React.ReactElement;
};

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="mb-4 text-3xl font-bold text-gray-900">{children}</h1>;
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 mt-8 text-xl font-semibold text-gray-800">{children}</h2>;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-6 text-base font-semibold text-gray-800">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-7 text-gray-600">{children}</p>;
}
function UL({ children }: { children: React.ReactNode }) {
  return <ul className="mb-4 space-y-1.5 pl-5">{children}</ul>;
}
function LI({ children }: { children: React.ReactNode }) {
  return <li className="list-disc leading-7 text-gray-600">{children}</li>;
}
function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm text-gray-800">{children}</code>;
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mb-4 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-800 leading-6">
      {children}
    </pre>
  );
}
function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gray-600">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Callout({ type, children }: { type: 'info' | 'warn' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    tip: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  };
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-6 ${styles[type]}`}>
      {children}
    </div>
  );
}
function Divider() {
  return <hr className="my-8 border-gray-200" />;
}

// ---------------------------------------------------------------------------
// Page content definitions
// ---------------------------------------------------------------------------

const sections: Section[] = [
  // ─────────────────────────────────────────────────────────────── PUBLIC ──
  {
    id: 'platform',
    title: 'Platform',
    restricted: false,
    pages: [
      {
        id: 'introduction',
        title: 'Introduction',
        render: () => (
          <div>
            <H1>ATRISI Marketing</H1>
            <P>
              JoaLLM is an enterprise-grade AI platform that brings together multi-model chat,
              retrieval-augmented generation (RAG), visual workflow automation, and interactive
              notebooks in a single product. It is designed to be deployed by teams that want
              the power of large language models without handing their data to a third-party
              consumer service.
            </P>
            <H2>What you can do</H2>
            <UL>
              <LI>Have multi-turn conversations with GPT-4, Claude, Llama, and other models</LI>
              <LI>Upload documents and ask questions grounded in your own knowledge base</LI>
              <LI>Build visual workflows that chain LLM calls, conditionals, and data transforms</LI>
              <LI>Run interactive notebooks with AI, code, chart, and knowledge cells</LI>
              <LI>Compare models by speed, quality, and cost in the Model Library</LI>
              <LI>Bring your own API keys to bypass platform quotas</LI>
            </UL>
            <H2>Three services, one monorepo</H2>
            <Table
              headers={['Service', 'Purpose', 'Default port']}
              rows={[
                ['backend', 'Fastify API — auth, chat, RAG, files, feedback', '3001'],
                ['frontend', 'React application — all user-facing features', '5173'],
                ['landing-page', 'Marketing site — product showcase and sign-up', '5174'],
              ]}
            />
            <Callout type="tip">
              All three services are deployed independently on Railway. The backend is the only
              service that talks to PostgreSQL and Redis.
            </Callout>
          </div>
        ),
      },
      {
        id: 'getting-started',
        title: 'Getting Started',
        render: () => (
          <div>
            <H1>Getting Started</H1>
            <H2>Prerequisites</H2>
            <UL>
              <LI>Node.js 18 or later</LI>
              <LI>npm 8 or later</LI>
              <LI>PostgreSQL 15 with the pgvector extension</LI>
              <LI>Redis 7</LI>
            </UL>
            <H2>Install</H2>
            <Pre>npm install</Pre>
            <H2>Configure environment</H2>
            <P>Copy and fill in the example env files for each service:</P>
            <Pre>{`cp services/backend/.env.example services/backend/.env
cp services/frontend/.env.example services/frontend/.env`}</Pre>
            <P>Minimum required backend variables:</P>
            <Table
              headers={['Variable', 'Description']}
              rows={[
                ['DATABASE_URL', 'PostgreSQL connection string'],
                ['REDIS_URL', 'Redis connection string'],
                ['JWT_SECRET', 'Secret for signing access tokens'],
                ['ENCRYPTION_KEY', '64-char hex key for API key encryption'],
                ['GOOGLE_CLIENT_ID', 'Google OAuth client ID'],
                ['GOOGLE_CLIENT_SECRET', 'Google OAuth client secret'],
                ['COHERE_API_KEY', 'Required for RAG embeddings (primary embedding service)'],
              ]}
            />
            <H2>Database</H2>
            <Pre>{`cd services/backend
npm run db:migrate    # apply migrations
npm run db:studio     # open Drizzle Studio in browser`}</Pre>
            <H2>Run locally</H2>
            <Pre>{`npm run dev              # all three services
npm run dev:backend     # backend only  → http://localhost:3001
npm run dev:frontend    # frontend only → http://localhost:5173`}</Pre>
          </div>
        ),
      },
      {
        id: 'features',
        title: 'Features',
        render: () => (
          <div>
            <H1>Features</H1>
            <H2>Chat</H2>
            <P>
              Multi-turn conversations with any supported model. Stream responses token by token,
              adjust temperature and other parameters per session, attach files, and export
              conversations.
            </P>
            <H2>Knowledge Base & RAG</H2>
            <P>
              Upload documents (PDF, DOCX, Markdown, code, CSV, JSON, YAML, images). Documents
              are chunked adaptively and embedded via Cohere or OpenAI. Chat answers are grounded
              in your documents using vector similarity search on pgvector.
            </P>
            <H2>Workflow Builder</H2>
            <P>
              A visual node-based editor (ReactFlow) for building multi-step LLM pipelines.
              Node types include LLM, Input, Output, Conditional, and Data Transform. Execution
              history is stored with full input/output logs.
            </P>
            <H2>Notebooks</H2>
            <P>
              Jupyter-style notebooks with typed cells: Markdown, Code, AI, Chart, Knowledge,
              Agent, and Debug. RAG configuration is available per cell.
            </P>
            <H2>Model Library</H2>
            <P>
              Browse, filter, and compare all available models by provider, speed, quality, cost,
              and capabilities. Free-tier users see Groq and gpt-3.5 models. GPT-4 and Claude
              models are unlocked on Pro.
            </P>
            <H2>Bring Your Own Key (BYOK)</H2>
            <P>
              Pro users can supply their own OpenAI, Anthropic, Groq, or Cohere API keys.
              Keys are encrypted before storage. When a custom key is present, it replaces the
              platform key for that provider — your own quotas and billing apply.
            </P>
          </div>
        ),
      },
      {
        id: 'faq',
        title: 'FAQ',
        render: () => (
          <div>
            <H1>FAQ</H1>
            <H2>What models are available on the free plan?</H2>
            <P>
              All Groq-hosted models (Llama 3.3, Mixtral, Gemma 2, Qwen, and others) plus
              gpt-3.5-turbo. GPT-4 class models and all Claude models require a Pro subscription.
            </P>
            <H2>Are my files stored permanently?</H2>
            <P>
              On the free plan, original files are processed for search but not stored permanently.
              Embeddings and extracted text remain in the database for the session. Upgrade to Pro
              to enable persistent cloud storage via Cloudflare R2.
            </P>
            <H2>Can I use my own API keys?</H2>
            <P>
              Yes, on the Pro plan. Go to Settings → Models → Provider Keys. Your keys are
              encrypted before storage and bypass platform quotas.
            </P>
            <H2>What happens to my data?</H2>
            <P>
              Chat sessions, messages, and documents are stored in your PostgreSQL instance.
              You control the database. Feedback and training signals are stored separately and
              only used if you have granted training consent in Settings → Data.
            </P>
            <H2>Is there an API?</H2>
            <P>
              Yes. The backend exposes a full REST API documented at{' '}
              <Code>/api/docs</Code> (Swagger UI, available in development). See the API Reference
              section for an overview.
            </P>
          </div>
        ),
      },
    ],
  },
  {
    id: 'api',
    title: 'API Reference',
    restricted: false,
    pages: [
      {
        id: 'api-auth',
        title: 'Authentication',
        render: () => (
          <div>
            <H1>Authentication</H1>
            <P>
              All API requests (except <Code>/api/auth/*</Code> and <Code>/api/health</Code>)
              require a Bearer token in the <Code>Authorization</Code> header.
            </P>
            <Pre>{`Authorization: Bearer <access_token>`}</Pre>
            <H2>Obtain a token</H2>
            <Pre>{`POST /api/auth/login
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "yourpassword"
}`}</Pre>
            <P>Response includes <Code>token</Code> (24h) and <Code>refreshToken</Code> (7d).</P>
            <H2>Refresh</H2>
            <Pre>{`POST /api/auth/refresh
Content-Type: application/json

{ "refreshToken": "<refresh_token>" }`}</Pre>
            <H2>Google OAuth</H2>
            <P>
              Redirect the user to <Code>GET /api/auth/google</Code>. After consent, the callback
              redirects to the frontend with <Code>?token=...&refresh=...</Code> query params.
            </P>
            <H2>Access snapshot</H2>
            <P>Call this after login to get the user's full role, tier, permissions, and limits:</P>
            <Pre>{`GET /api/me/access
→ { role, subscriptionTier, workspaceMode, permissions[], limits{} }`}</Pre>
          </div>
        ),
      },
      {
        id: 'api-chat',
        title: 'Chat API',
        render: () => (
          <div>
            <H1>Chat API</H1>
            <H2>Send a message</H2>
            <Pre>{`POST /api/chat/send
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "model": "llama-3.3-70b-versatile",
  "parameters": { "temperature": 0.7, "maxTokens": 2048 },
  "sessionId": "<optional>"
}`}</Pre>
            <Callout type="warn">
              Free-tier users are restricted to Groq and gpt-3.5 models. Sending a GPT-4 or
              Claude model ID returns HTTP 403.
            </Callout>
            <H2>Streaming</H2>
            <Pre>{`POST /api/chat/stream
→ text/event-stream — data: { content: "..." } chunks
→ final: data: { done: true, usage: {...} }`}</Pre>
            <H2>Sessions</H2>
            <Table
              headers={['Method', 'Path', 'Description']}
              rows={[
                ['POST', '/api/chat/sessions', 'Create a new session'],
                ['GET', '/api/chat/sessions', 'List sessions'],
                ['DELETE', '/api/chat/sessions/:id', 'Delete a session'],
                ['PATCH', '/api/chat/sessions/:id/complete', 'Mark session completed or abandoned'],
                ['POST', '/api/chat/session/:id/generate-title', 'Auto-generate session title'],
              ]}
            />
            <H2>Training signals</H2>
            <Pre>{`PATCH /api/chat/messages/:id/signal
{ "signal": "copied" | "regenerated" }`}</Pre>
          </div>
        ),
      },
      {
        id: 'api-rag',
        title: 'Files & RAG',
        render: () => (
          <div>
            <H1>Files & RAG API</H1>
            <H2>Upload a file</H2>
            <Pre>{`POST /api/files  (multipart/form-data)
  file: <binary>
  storeOriginal: "true" | "false"   // default false on free tier`}</Pre>
            <H2>File status</H2>
            <Pre>{`GET /api/files/:id/status
→ { id, status: "uploaded"|"processing"|"processed"|"failed", chunks }`}</Pre>
            <H2>Download</H2>
            <Pre>{`GET /api/files/:id/download
→ 302 redirect to presigned R2 URL (when R2 is active)
→ binary stream (when using volume storage)`}</Pre>
            <H2>Reprocess</H2>
            <Pre>{`POST /api/files/:id/reprocess   — re-extract and re-embed`}</Pre>
            <H2>RAG search</H2>
            <Pre>{`POST /api/rag/search
{
  "query": "what is the refund policy?",
  "fileIds": ["id1", "id2"],     // omit to search all files
  "searchType": "hybrid",        // vector | keyword | hybrid
  "limit": 5,
  "threshold": 0.1
}`}</Pre>
          </div>
        ),
      },
      {
        id: 'api-feedback',
        title: 'Feedback API',
        render: () => (
          <div>
            <H1>Feedback API</H1>
            <H2>Per-message rating</H2>
            <Pre>{`POST   /api/feedback/messages/:id   { "rating": "thumbs_up" | "thumbs_down" }
GET    /api/feedback/messages/:id   → current rating or null
DELETE /api/feedback/messages/:id   → remove rating`}</Pre>
            <H2>Training consent</H2>
            <Pre>{`GET   /api/feedback/training-consent
PATCH /api/feedback/training-consent  { "consentGiven": true | false }`}</Pre>
            <Callout type="info">
              Training consent controls whether a user's feedback and session signals are
              included in model improvement exports. Default is false.
            </Callout>
          </div>
        ),
      },
    ],
  },

  // ─────────────────────────────────────────────────────────── RESTRICTED ──
  {
    id: 'architecture',
    title: 'Architecture',
    restricted: true,
    pages: [
      {
        id: 'arch-overview',
        title: 'System Overview',
        render: () => (
          <div>
            <H1>System Overview</H1>
            <P>
              JoaLLM is a multi-service monorepo deployed on Railway. Three services share a
              PostgreSQL database (with pgvector for embeddings) and a Redis instance for job
              queuing. All inter-service communication goes through the backend API — the two
              frontend services are purely client-side React apps.
            </P>
            <H2>Service responsibilities</H2>
            <Table
              headers={['Service', 'Stack', 'Responsibility']}
              rows={[
                ['backend', 'Fastify · TypeScript · Drizzle · BullMQ', 'API, auth, LLM routing, RAG, file processing, feedback'],
                ['frontend', 'React 18 · Vite · Tailwind · Zustand', 'User-facing application'],
                ['landing-page', 'React · Vite · Tailwind', 'Marketing and sign-up'],
              ]}
            />
            <H2>Data stores</H2>
            <Table
              headers={['Store', 'Purpose']}
              rows={[
                ['PostgreSQL 15 + pgvector', 'All relational data + 1024-dim vector embeddings'],
                ['Redis 7', 'BullMQ job queues for async document processing'],
                ['Cloudflare R2 (optional)', 'Persistent object storage for original files and training exports'],
                ['Railway volume (default)', 'Local filesystem fallback when R2 is not configured'],
              ]}
            />
            <H2>Key architectural decisions</H2>
            <UL>
              <LI>pgvector over a dedicated vector DB — one less service, SQL joins work natively</LI>
              <LI>BullMQ with graceful Redis degradation — API stays up if Redis goes down</LI>
              <LI>Drizzle ORM — type-safe, SQL-first, zero-overhead query builder</LI>
              <LI>JWT with role normalization middleware — legacy tokens with old role names are remapped on the fly</LI>
              <LI>Two-bucket R2 layout — user content separate from training data for independent lifecycle policies</LI>
            </UL>
          </div>
        ),
      },
      {
        id: 'arch-storage',
        title: 'Storage Strategy',
        render: () => (
          <div>
            <H1>Storage Strategy</H1>
            <H2>Current state — volume storage</H2>
            <P>
              The platform defaults to <Code>STORAGE_PROVIDER=volume</Code>, writing files to
              the Railway-mounted filesystem at <Code>/app/data/uploads</Code>. This is suitable
              for demo and low-traffic stages. No setup required beyond the Railway volume.
            </P>
            <Callout type="warn">
              Files are only written to disk when <Code>storeOriginal=true</Code> is passed on
              upload. The frontend currently defaults this to <Code>false</Code>, meaning only
              embeddings and extracted text are retained — not the original file bytes.
            </Callout>
            <H2>Production path — Cloudflare R2</H2>
            <P>
              R2 is fully implemented in <Code>file-storage.ts</Code>. Switching requires only
              environment variable changes — no code changes needed.
            </P>
            <Table
              headers={['Variable', 'Value']}
              rows={[
                ['STORAGE_PROVIDER', 'cloudflare-r2'],
                ['R2_ACCOUNT_ID', 'Cloudflare account ID'],
                ['R2_ACCESS_KEY_ID', 'R2 API token access key'],
                ['R2_SECRET_ACCESS_KEY', 'R2 API token secret'],
                ['R2_BUCKET_NAME', 'joallm-uploads'],
                ['R2_TRAINING_BUCKET_NAME', 'joallm-training'],
              ]}
            />
            <H2>Two-bucket layout</H2>
            <P>
              <strong>joallm-uploads</strong> — user content. Presigned URLs only (no public
              access). CORS enabled for the frontend origin.
            </P>
            <Pre>{`documents/{userId}/{fileId}/original.{ext}
extracted/{userId}/{fileId}/text.txt
avatars/{userId}.{ext}
exports/{userId}/{sessionId}-{timestamp}.{format}`}</Pre>
            <P>
              <strong>joallm-training</strong> — training signals and feedback. Backend-only,
              no CORS, no presigned URLs.
            </P>
            <Pre>{`signals/{userId}/{date}.jsonl
feedback/{userId}/{messageId}.json
rag-sources/{userId}/{messageId}.json`}</Pre>
            <H2>Why R2 over S3</H2>
            <UL>
              <LI>Egress is free — no charges for downloads, presigned URL redirects cost nothing</LI>
              <LI>Same credentials work across both buckets</LI>
              <LI>S3-compatible API — the same SDK works for both (just a different endpoint)</LI>
            </UL>
          </div>
        ),
      },
      {
        id: 'arch-rag',
        title: 'RAG Pipeline',
        render: () => (
          <div>
            <H1>RAG Pipeline</H1>
            <H2>Processing flow</H2>
            <Pre>{`Upload → BullMQ (document-processing queue)
  → Text extraction (pdf-parse / mammoth / xlsx / plain text)
  → Adaptive chunking (content-aware size + overlap)
  → DB insert (documentChunks table, status: awaiting_indexing)

→ BullMQ (document-indexing queue)
  → Cohere embed-english-v3.0 (1024-dim) [primary]
  → OpenAI text-embedding-ada-002 (1536-dim) [fallback]
  → pgvector upsert (documentChunks.embedding column)
  → status: processed`}</Pre>
            <H2>Search types</H2>
            <Table
              headers={['Type', 'Mechanism', 'When to use']}
              rows={[
                ['vector', 'Cosine similarity via pgvector <=> operator', 'Semantic meaning, conceptual queries'],
                ['keyword', 'PostgreSQL full-text search with ranking', 'Exact terms, names, codes'],
                ['hybrid', 'Weighted combination of both', 'General purpose — default choice'],
              ]}
            />
            <H2>Dimension guard</H2>
            <P>
              Chunks are indexed with a specific embedding model. At query time, only chunks
              indexed with the same model are searched — prevents dimension mismatch errors when
              models change.
            </P>
            <H2>Grounding tracking</H2>
            <P>
              <Code>messageRagSources</Code> links each assistant message to the specific
              document chunks that grounded it. This is the foundation of RAG quality signals
              for the training data layer.
            </P>
          </div>
        ),
      },
      {
        id: 'arch-training',
        title: 'Training Data Layer',
        render: () => (
          <div>
            <H1>Training Data Layer</H1>
            <P>
              The platform passively collects quality signals that can be used for RLHF and
              fine-tuning. No data leaves the platform unless explicitly exported.
            </P>
            <H2>Implicit signals (automatic)</H2>
            <Table
              headers={['Signal', 'Where stored', 'How collected']}
              rows={[
                ['wasCopied', 'messages.wasCopied', 'PATCH /api/chat/messages/:id/signal { signal: "copied" }'],
                ['wasRegenerated', 'messages.wasRegenerated', 'PATCH /api/chat/messages/:id/signal { signal: "regenerated" }'],
                ['completionStatus', 'chatSessions.completionStatus', 'PATCH /api/chat/sessions/:id/complete on session switch or tab close'],
                ['turnCount', 'chatSessions.turnCount', 'Incremented per message'],
              ]}
            />
            <H2>Tab-close reliability</H2>
            <P>
              Session abandonment is reported via <Code>fetch</Code> with{' '}
              <Code>keepalive: true</Code> in the <Code>beforeunload</Code> handler. Falls back
              to <Code>navigator.sendBeacon</Code> if the token is unavailable. A{' '}
              <Code>sessionStatusRef</Code> map prevents duplicate signals per session.
            </P>
            <H2>Explicit signals (user-initiated)</H2>
            <Table
              headers={['Signal', 'Table', 'Description']}
              rows={[
                ['thumbs_up / thumbs_down', 'messageFeedback', 'Per-message rating, toggle to remove'],
                ['RAG grounding', 'messageRagSources', 'Which chunks backed which response'],
              ]}
            />
            <H2>Training consent</H2>
            <P>
              Users opt in via Settings → Data. Default is <Code>false</Code>. The{' '}
              <Code>userTrainingConsent</Code> flag gates whether signals are included in
              training exports.
            </P>
            <H2>Export destination</H2>
            <P>
              The <Code>joallm-training</Code> R2 bucket is the intended export destination
              when R2 is active. JSONL format for compatibility with fine-tuning pipelines.
            </P>
          </div>
        ),
      },
      {
        id: 'arch-auth',
        title: 'Auth & RBAC',
        render: () => (
          <div>
            <H1>Auth & RBAC</H1>
            <H2>Token lifecycle</H2>
            <Table
              headers={['Token', 'TTL', 'Purpose']}
              rows={[
                ['Access token', '24h', 'API authentication, carries id + email + role'],
                ['Refresh token', '7d', 'Silent token renewal'],
                ['Pre-auth token', 'Short', 'Issued when 2FA is required (role: pending_2fa)'],
              ]}
            />
            <H2>Role hierarchy</H2>
            <Table
              headers={['Role', 'Permissions']}
              rows={[
                ['casual', 'chat, knowledge (read), notebooks (read), workflow (read + execute), settings'],
                ['premium', 'All casual + knowledge.write, notebook.write, workflow.manage'],
                ['admin', 'All premium + admin.access'],
                ['superuser', 'All admin + admin.manage'],
              ]}
            />
            <H2>Legacy role normalization</H2>
            <P>
              The auth middleware remaps old JWT role values before any route handler runs:
            </P>
            <Pre>{`user       → casual
moderator  → premium`}</Pre>
            <H2>Subscription tiers</H2>
            <Table
              headers={['Tier', 'Files', 'Storage', 'Req/day', 'Custom keys', 'Export']}
              rows={[
                ['free', '10', '100 MB', '50', 'No', 'No'],
                ['pro', '200', '5 GB', '2 000', 'Yes', 'Yes'],
                ['enterprise', '∞', '∞', '∞', 'Yes', 'Yes'],
              ]}
            />
            <H2>Middleware stack</H2>
            <UL>
              <LI><Code>authenticateToken</Code> — validates JWT, attaches user to request</LI>
              <LI><Code>requirePermission(perm)</Code> — checks role-based permissions</LI>
              <LI><Code>requireTier(tier)</Code> — enforces minimum subscription tier</LI>
              <LI><Code>requireTierFeature(flag)</Code> — checks boolean feature flags (canExportData, canUseCustomApiKeys)</LI>
              <LI><Code>requireModelForTier()</Code> — blocks GPT-4+ and Claude on free tier</LI>
            </UL>
          </div>
        ),
      },
      {
        id: 'arch-decisions',
        title: 'Decision Log',
        render: () => (
          <div>
            <H1>Decision Log</H1>
            <P>
              Key architectural and product decisions made during the build, captured for
              future reference.
            </P>
            <Divider />
            <H2>pgvector over a dedicated vector database</H2>
            <P>
              <strong>Decision:</strong> Embeddings stored in PostgreSQL using the pgvector
              extension, not a separate service like Pinecone or Weaviate.
            </P>
            <P>
              <strong>Rationale:</strong> Eliminates an entire service from the infrastructure.
              SQL joins between documents, chunks, and users work natively. pgvector with cosine
              similarity is production-grade for the expected data volumes. Can migrate to a
              dedicated vector DB later if search latency becomes a bottleneck at scale.
            </P>
            <Divider />
            <H2>Two-bucket R2 layout</H2>
            <P>
              <strong>Decision:</strong> User uploads (joallm-uploads) and training signals
              (joallm-training) are stored in separate R2 buckets.
            </P>
            <P>
              <strong>Rationale:</strong> Different access patterns, lifecycle policies, and
              CORS requirements. Training data should never be accessible via presigned URLs.
              User content needs CORS for direct browser access. Separating them makes
              lifecycle rules, IAM, and auditing cleaner.
            </P>
            <Divider />
            <H2>Volume storage for demo, R2 for production</H2>
            <P>
              <strong>Decision:</strong> Default to local filesystem storage on Railway volumes
              during the demo phase. Switch to R2 via env var when subscription revenue starts.
            </P>
            <P>
              <strong>Rationale:</strong> Avoids R2 setup overhead before validating the product.
              The switch is a single <Code>STORAGE_PROVIDER=cloudflare-r2</Code> env var — all
              code is already in place.
            </P>
            <Divider />
            <H2>Free tier model restriction</H2>
            <P>
              <strong>Decision:</strong> Free tier locked to Groq and gpt-3.5-turbo. GPT-4+
              and Claude require Pro.
            </P>
            <P>
              <strong>Rationale:</strong> Groq inference is extremely cheap (~$0.04/user/month
              at 50 req/day cap). GPT-4o costs 20-60× more per token. Allowing GPT-4 on free
              would make the unit economics unsustainable. Groq models (Llama 3.3, Mixtral) are
              high quality — not a degraded experience, just a different provider.
            </P>
            <P>
              Enforcement is dual-layer: backend middleware rejects disallowed model IDs
              (prevents API bypass), frontend disables and badges locked models in the selector.
            </P>
            <Divider />
            <H2>Session lifecycle signals</H2>
            <P>
              <strong>Decision:</strong> Track session completion status (completed/abandoned)
              via PATCH with <Code>keepalive: true</Code> on tab close.
            </P>
            <P>
              <strong>Rationale:</strong> Abandoned sessions are a quality signal — short sessions
              that end abruptly likely indicate a poor response. This data is cheap to collect and
              valuable for RLHF. The <Code>sessionStatusRef</Code> deduplication map prevents
              double-reporting when users switch sessions frequently.
            </P>
          </div>
        ),
      },
    ],
  },
  {
    id: 'product',
    title: 'Product & Roadmap',
    restricted: true,
    pages: [
      {
        id: 'product-pricing',
        title: 'Pricing Strategy',
        render: () => (
          <div>
            <H1>Pricing Strategy</H1>
            <H2>Tiers</H2>
            <Table
              headers={['Tier', 'Price', 'Positioning']}
              rows={[
                ['Free', '$0/month', 'Demo, try it out, no commitment'],
                ['Pro', '$5/month', 'Individual users who need persistent files and premium models'],
                ['Enterprise', 'Custom', 'Teams, SLA, private hosted inference, dedicated support'],
              ]}
            />
            <H2>Why $5 and not $29</H2>
            <P>
              $5/month removes the decision entirely. Users convert without thinking about it.
              At $29, a cold user needs to evaluate the product carefully before committing.
              At $5, it is cheaper than a coffee — they try it and stay if it is useful.
            </P>
            <P>
              The unit economics work because Pro users are expected to bring their own API keys
              (reducing LLM cost to near zero) and the infrastructure cost per user is low.
            </P>
            <H2>Break-even</H2>
            <Table
              headers={['Paying users', 'Revenue', 'Infra + LLM cost', 'Margin']}
              rows={[
                ['10', '$50', '~$40', '$10'],
                ['20', '$100', '~$50', '$50'],
                ['50', '$250', '~$70', '$180'],
                ['100', '$500', '~$120', '$380+'],
              ]}
            />
            <Callout type="tip">
              Break-even is 8–10 paying Pro users. Everything above that is margin, especially
              as Pro users bring their own keys and reduce platform LLM spend to zero.
            </Callout>
            <H2>Free tier cost</H2>
            <P>
              Free users are capped at 50 requests/day, Groq models only. Groq inference at
              50 req/day × ~500 tokens each costs approximately $0.04/user/month at current
              Groq pricing. 100 free users = ~$4/month in LLM costs. Manageable.
            </P>
          </div>
        ),
      },
      {
        id: 'product-tiers',
        title: 'Feature Tiers',
        render: () => (
          <div>
            <H1>Feature Tiers</H1>
            <Table
              headers={['Feature', 'Free', 'Pro', 'Enterprise']}
              rows={[
                ['Groq models (Llama, Mixtral, Gemma, Qwen)', '✓', '✓', '✓'],
                ['GPT-4 / Claude models', '✗ Locked', '✓', '✓'],
                ['Chat sessions', '20', '500', 'Unlimited'],
                ['File uploads', '10 files · 100 MB', '200 files · 5 GB', 'Unlimited'],
                ['File persistence (cloud storage)', '✗ Session only', '✓ R2', '✓ R2'],
                ['Chat export', '✗ Locked', '✓', '✓'],
                ['Bring your own API keys', '✗ Locked', '✓', '✓'],
                ['Workflows', '3 (read + execute only)', '50 (create + manage)', 'Unlimited'],
                ['Notebooks', '3', '50', 'Unlimited'],
                ['Private hosted inference (Ollama)', '✗', '✗', '✓ Planned'],
                ['SLA + dedicated support', '✗', '✗', '✓'],
                ['Data export for fine-tuning', '✗', '✗', '✓ Planned'],
              ]}
            />
            <H2>Enforcement layers</H2>
            <P>Every limit is enforced at two layers to prevent bypass:</P>
            <UL>
              <LI><strong>Backend middleware</strong> — returns HTTP 403 with upgrade message before the handler runs</LI>
              <LI><strong>Frontend gate</strong> — feature is hidden, disabled, or shows a lock badge with upgrade CTA</LI>
            </UL>
          </div>
        ),
      },
      {
        id: 'product-enterprise',
        title: 'Enterprise Offering',
        render: () => (
          <div>
            <H1>Enterprise Offering</H1>
            <H2>Core differentiators</H2>
            <UL>
              <LI>Private hosted inference — models run on the customer's infrastructure</LI>
              <LI>Zero data egress — no data sent to OpenAI, Anthropic, or any third party</LI>
              <LI>Air-gapped deployment — can run fully isolated from the public internet</LI>
              <LI>Dedicated support and SLA</LI>
              <LI>Custom model fine-tuning from collected training signals</LI>
              <LI>Audit trails across all sessions and document access</LI>
            </UL>
            <H2>Planned: Private Ollama inference</H2>
            <P>
              Ollama will be offered as an enterprise-only feature, not a BYOK option.
              The implementation plan:
            </P>
            <UL>
              <LI>Deploy Ollama as a private Railway service (not publicly exposed)</LI>
              <LI>Point the backend's <Code>OLLAMA_BASE_URL</Code> at the internal Railway service URL</LI>
              <LI>Gate Ollama models in the model selector to <Code>subscriptionTier === 'enterprise'</Code></LI>
              <LI>Market as "private hosted inference — your data never leaves the platform"</LI>
            </UL>
            <Callout type="info">
              Ollama was removed from the BYOK settings panel (commit fd14514). It is not
              available to free or pro users. The backend Ollama provider exists but is not
              exposed until the enterprise tier is fully built.
            </Callout>
            <H2>Sales motion</H2>
            <P>
              Enterprise prospects come from two paths: bottom-up (Pro users whose teams want
              to consolidate) and top-down (security-conscious companies who need air-gap
              guarantees). The private Ollama offering is primarily a top-down sell.
            </P>
          </div>
        ),
      },
      {
        id: 'product-roadmap',
        title: 'Roadmap',
        render: () => (
          <div>
            <H1>Roadmap</H1>
            <H2>Phase 1 — Foundation (done)</H2>
            <UL>
              <LI>Multi-provider LLM chat with streaming</LI>
              <LI>RAG pipeline with pgvector and adaptive chunking</LI>
              <LI>Document upload, indexing, status polling</LI>
              <LI>Visual workflow builder</LI>
              <LI>Interactive notebooks</LI>
              <LI>JWT auth + Google OAuth + 2FA</LI>
            </UL>
            <H2>Phase 2 — Security & Access Control (done)</H2>
            <UL>
              <LI>RBAC (casual / premium / admin / superuser)</LI>
              <LI>Subscription tier enforcement (free / pro / enterprise)</LI>
              <LI>Model restriction by tier</LI>
              <LI>Feature locks in UI</LI>
              <LI>Training data layer (implicit + explicit signals)</LI>
              <LI>BYOK with per-provider guidance</LI>
            </UL>
            <H2>Phase 3 — Monetisation</H2>
            <UL>
              <LI>Stripe Checkout integration for Pro at $5/month</LI>
              <LI>Webhook to update subscriptionTier in DB on payment</LI>
              <LI>R2 storage activated for Pro users (flip storeOriginal default)</LI>
              <LI>Usage billing dashboard</LI>
            </UL>
            <H2>Phase 4 — Enterprise</H2>
            <UL>
              <LI>Private Ollama Railway service + enterprise model gating</LI>
              <LI>Fine-tuning export pipeline from training bucket</LI>
              <LI>Multi-tenant workspace isolation</LI>
              <LI>Audit log API</LI>
              <LI>Custom SLA and dedicated support flow</LI>
            </UL>
          </div>
        ),
      },
    ],
  },
  {
    id: 'deployment',
    title: 'Deployment',
    restricted: true,
    pages: [
      {
        id: 'deploy-railway',
        title: 'Railway Setup',
        render: () => (
          <div>
            <H1>Railway Setup</H1>
            <P>
              Three services are defined in <Code>railway.json</Code> at the repo root.
              Railway watches the repo and redeploys each service when files in its
              <Code>watchPaths</Code> change.
            </P>
            <H2>Services</H2>
            <Table
              headers={['Service', 'Build', 'Health check']}
              rows={[
                ['backend', 'services/backend/Dockerfile', 'GET /api/health'],
                ['frontend', 'services/frontend/Dockerfile', 'nginx serves static build'],
                ['landing-page', 'services/landing-page/Dockerfile', 'nginx serves static build'],
              ]}
            />
            <H2>Key env vars (backend)</H2>
            <Pre>{`DATABASE_URL          postgresql://...
REDIS_URL             redis://...
JWT_SECRET            <strong random string>
ENCRYPTION_KEY        <64-char hex>
GOOGLE_CLIENT_ID      ...
GOOGLE_CLIENT_SECRET  ...
COHERE_API_KEY        ...
STORAGE_PROVIDER      volume  (or cloudflare-r2)
CORS_ORIGIN           \${{frontend.RAILWAY_PUBLIC_DOMAIN}},\${{landing-page.RAILWAY_PUBLIC_DOMAIN}}`}</Pre>
            <H2>Restart policy</H2>
            <P>All services use <Code>ON_FAILURE</Code> with max 10 retries.</P>
            <H2>CI/CD</H2>
            <P>
              GitHub Actions at <Code>.github/workflows/ci.yml</Code> runs on push to main
              or develop: lint → test (with Postgres + Redis service containers) → build all
              three services. Railway deploys automatically after a successful push.
            </P>
          </div>
        ),
      },
      {
        id: 'deploy-r2',
        title: 'R2 Activation',
        render: () => (
          <div>
            <H1>Activating Cloudflare R2</H1>
            <Callout type="info">
              The platform currently runs on volume storage. R2 is fully implemented — switching
              requires only env vars. Activate when Pro subscription revenue starts.
            </Callout>
            <H2>Cloudflare console steps</H2>
            <UL>
              <LI>Dashboard → copy <strong>Account ID</strong> (top right)</LI>
              <LI>R2 → Create bucket: <Code>joallm-uploads</Code></LI>
              <LI>R2 → Create bucket: <Code>joallm-training</Code></LI>
              <LI>R2 → Manage R2 API tokens → Create token (Object Read &amp; Write, both buckets)</LI>
              <LI>Copy: Access Key ID, Secret Access Key</LI>
              <LI>joallm-uploads → Settings → CORS: allow GET from frontend domain</LI>
            </UL>
            <H2>Railway env vars to add</H2>
            <Pre>{`STORAGE_PROVIDER=cloudflare-r2
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<access key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=joallm-uploads
R2_TRAINING_BUCKET_NAME=joallm-training`}</Pre>
            <H2>After activating R2</H2>
            <P>
              Also flip <Code>storeOriginal</Code> to <Code>true</Code> by default in the
              frontend upload call (<Code>useDocuments.ts</Code>) so user files are actually
              persisted to the bucket.
            </P>
          </div>
        ),
      },
      {
        id: 'deploy-stripe',
        title: 'Stripe Integration (Planned)',
        render: () => (
          <div>
            <H1>Stripe Integration</H1>
            <Callout type="warn">Not yet implemented. This is the planned approach.</Callout>
            <H2>Flow</H2>
            <UL>
              <LI>User clicks "Activate Pro" → POST /api/subscriptions/checkout → Stripe Checkout session created</LI>
              <LI>Redirect to Stripe-hosted checkout page ($5/month)</LI>
              <LI>On success → Stripe webhook → POST /api/webhooks/stripe</LI>
              <LI>Webhook handler updates user.subscriptionTier = 'pro' in DB</LI>
              <LI>User's next /api/me/access call returns pro limits</LI>
            </UL>
            <H2>What needs to be built</H2>
            <UL>
              <LI>Stripe SDK installation in backend</LI>
              <LI><Code>STRIPE_SECRET_KEY</Code> and <Code>STRIPE_WEBHOOK_SECRET</Code> env vars</LI>
              <LI><Code>POST /api/subscriptions/checkout</Code> route</LI>
              <LI><Code>POST /api/webhooks/stripe</Code> route with signature verification</LI>
              <LI>Replace <Code>mailto:</Code> href in billing tab with checkout URL</LI>
            </UL>
          </div>
        ),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocsInterface() {
  const isInternal = useIsInternal();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['platform']));
  const [activePage, setActivePage] = useState<string>('introduction');

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sectionIcons: Record<string, React.ReactElement> = {
    platform: <Globe className="h-4 w-4" />,
    api: <FileText className="h-4 w-4" />,
    architecture: <Cpu className="h-4 w-4" />,
    product: <Lightbulb className="h-4 w-4" />,
    deployment: <Rocket className="h-4 w-4" />,
  };

  const activeSections = sections.filter((s) => !s.restricted || isInternal);
  const allPages = activeSections.flatMap((s) => s.pages);
  const currentPage = allPages.find((p) => p.id === activePage) ?? allPages[0];

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-joa-primary" />
            <span className="font-semibold text-gray-900">Documentation</span>
          </div>
          {isInternal && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-joa-primary">
              <Lock className="h-3 w-3" />
              Internal access
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {sections.map((section) => {
            const locked = section.restricted && !isInternal;
            return (
              <div key={section.id}>
                <button
                  onClick={() => !locked && toggleSection(section.id)}
                  disabled={locked}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                    locked
                      ? 'cursor-not-allowed text-gray-400'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className={locked ? 'text-gray-300' : 'text-gray-500'}>
                    {sectionIcons[section.id]}
                  </span>
                  <span className="flex-1 text-left">{section.title}</span>
                  {locked ? (
                    <Lock className="h-3.5 w-3.5 text-gray-300" />
                  ) : expandedSections.has(section.id) ? (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  )}
                </button>

                {!locked && expandedSections.has(section.id) && (
                  <div className="pb-1">
                    {section.pages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => setActivePage(page.id)}
                        className={`w-full px-8 py-1.5 text-left text-sm transition ${
                          activePage === page.id
                            ? 'bg-red-50 font-medium text-joa-primary'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        {page.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {!isInternal && (
          <div className="border-t border-gray-200 p-4 text-xs text-gray-400">
            <Lock className="mb-1 inline h-3 w-3" /> Some sections are restricted.
            <br />Contact support@joallm.ai for access.
          </div>
        )}
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          {currentPage ? currentPage.render() : (
            <div className="text-gray-500">Select a page from the sidebar.</div>
          )}
        </div>
      </main>
    </div>
  );
}
