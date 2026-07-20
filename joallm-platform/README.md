# JoaLLM Platform

An enterprise-grade LLM platform providing multi-model AI chat, retrieval-augmented generation (RAG), visual workflow automation, and interactive notebooks — deployed as a multi-service monorepo on Railway.

---

## Architecture Overview

```
joallm-platform/
├── services/
│   ├── backend/          # Fastify API (Node.js / TypeScript)
│   ├── frontend/         # React application (Vite + TypeScript)
│   └── landing-page/     # Marketing site (Vite + TypeScript)
├── shared/               # Cross-service types, utilities, SDK, event bus
├── infrastructure/       # Railway configs, deployment scripts
├── docs/                 # Platform documentation
└── .github/workflows/    # CI/CD pipeline
```

Three independently deployed services share a common type system and event bus via the `shared/` workspace. All services are containerised with multi-stage Docker builds and deployed to Railway. PostgreSQL with pgvector handles both relational data and vector embeddings in a single database, with BullMQ + Redis managing asynchronous document processing.

---

## Services

### Backend (`services/backend`)

**Stack:** Fastify · TypeScript · Drizzle ORM · PostgreSQL + pgvector · BullMQ + Redis · Winston/Pino

#### API Surface

| Group | Prefix | Responsibility |
|---|---|---|
| Auth | `/api/auth` | Registration, login, JWT refresh, 2FA (TOTP), password reset, Google OAuth |
| Access | `/api/me/access` | Bootstrap endpoint — role, tier, permissions, limits in one call |
| Chat | `/api/chat` | Sessions, messages, streaming responses, session lifecycle signals |
| Files | `/api/files` | Upload, status polling, reprocess, delete |
| RAG | `/api/rag` | Vector / keyword / hybrid search, search sessions, document grounding |
| Workflows | `/api/workflows` | Create, execute, and manage visual node-based workflows |
| Notebooks | `/api/notebooks` | Cells (markdown, code, AI, chart, knowledge, agent, debug) |
| Bookmarks | `/api/bookmarks` | Save messages, sessions, files, and search results |
| Models | `/api/models` | Available LLM models with capabilities and pricing |
| Feedback | `/api/feedback` | Per-message thumbs ratings, training consent |
| Preferences | `/api/preferences` | Theme, font, workspace mode, default model/parameters |
| Security | `/api/security` | 2FA management, sessions, password changes |
| Admin | `/api/admin` | User management (superuser only) |
| Metrics | `/api/metrics` | Prometheus metrics |
| Health | `/api/health` | Liveness check (used by Railway) |

#### Authentication

- **JWT** — 24-hour access tokens, 7-day refresh tokens. Tokens carry `id`, `email`, and `role`.
- **Pre-auth tokens** — Short-lived `pending_2fa` role token issued before 2FA is verified.
- **Google OAuth** — Full OAuth flow; profile loaded from backend after callback (not decoded from JWT client-side).
- **Security** — bcrypt (12-round salts), account lockout after 5 failed attempts (15-minute cooldown), Redis token blacklisting on logout, legacy role aliases normalised in middleware (`user → casual`, `moderator → premium`).
- **Encrypted API keys** — User-supplied LLM provider keys stored encrypted in the database.

#### Role-Based Access Control

Four roles in ascending privilege order:

| Role | Capabilities |
|---|---|
| `casual` | Chat, knowledge, notebooks, workflows (read + execute), settings |
| `premium` | All casual permissions + workflow management |
| `admin` | All premium permissions + admin panel access |
| `superuser` | Full system access including user management |

#### Subscription Tiers

| Tier | Files | Storage | Chat Sessions | Workflows | Notebooks | API Requests/Day | Custom Keys | Data Export |
|---|---|---|---|---|---|---|---|---|
| `free` | 10 | 100 MB | 20 | 3 | 3 | 50 | No | No |
| `pro` | 200 | 5 GB | 500 | 50 | 50 | 2 000 | Yes | Yes |
| `enterprise` | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited | Yes | Yes |

#### Database Schema

Key tables (Drizzle ORM, PostgreSQL 15):

| Table | Purpose |
|---|---|
| `users` | Auth credentials, role, tier, usage stats, encrypted API keys |
| `chatSessions` | Conversations with model selection, training signals (completionStatus, turnCount) |
| `messages` | Turns with role, token usage, implicit signals (wasRegenerated, wasCopied) |
| `files` | Uploaded documents, processing status, metadata (pages, language, word count) |
| `documentChunks` | Adaptive text chunks with 1024-dimensional pgvector embeddings |
| `workflows` | Visual workflows (nodes + edges as JSONB) |
| `workflowExecutions` | Execution history with input/output logs |
| `notebooks` | Interactive notebooks with typed cells |
| `notebookCells` | Individual cells with RAG configuration |
| `ragSearchSessions` | Search sessions (vector / keyword / hybrid) |
| `ragSearchQueries` | Individual queries with performance metrics |
| `messageFeedback` | Explicit per-message ratings (thumbs up/down, corrections, flags) |
| `messageRagSources` | Links responses to the document chunks that grounded them |
| `userPreferences` | Theme, workspace mode, default model parameters |
| `userSecurity` | 2FA secrets, backup codes, password reset tokens, active sessions |
| `bookmarks` | Saved messages, sessions, files, workflows, search results |
| `apiUsage` | Token usage, cost (cents), response times per endpoint |
| `surveyResponses` | User feedback (pain points, feature requests, use case) |

#### RAG Pipeline

```
Upload → BullMQ queue → Text extraction → Adaptive chunking
→ BullMQ queue → Cohere / OpenAI embedding → pgvector storage
→ Search (vector / keyword / hybrid) → Grounding tracked in messageRagSources
```

- **Text extraction** — PDF (pdf-parse), Word (mammoth), Excel (xlsx), Markdown, plain text, code.
- **Adaptive chunking** — Content-aware chunk sizing preserving page numbers and code structure.
- **Embeddings** — Cohere `embed-english-v3.0` (1024-dim primary), OpenAI `text-embedding-ada-002` (1536-dim fallback). Dimension mismatches guarded at query time.
- **Search** — Cosine similarity (`<=>`) for vector, full-text ranking for keyword, weighted combination for hybrid. Configurable threshold, limit, and file filter.

#### LLM Providers

| Provider | Notes |
|---|---|
| OpenAI | GPT-4 Turbo, GPT-4, GPT-3.5-turbo. Streaming via SSE. |
| Anthropic | Claude 3 Opus/Sonnet/Haiku. System message separation. |
| Groq | Llama, Mixtral. Ultra-low latency inference. |
| Cohere | Text generation and embeddings. |
| Ollama | Local inference via user-supplied API keys. |

Users can supply their own provider keys to bypass platform quotas.

#### Training Data Layer

**Implicit signals** (tracked automatically):
- `wasRegenerated` / `wasCopied` on every message
- `completionStatus` (`completed` / `abandoned`) and `turnCount` per session — reported via `PATCH /api/chat/sessions/:id/complete` with `fetch` keepalive / `navigator.sendBeacon` on tab close

**Explicit signals** (user-initiated):
- Thumbs up / down per assistant message (toggle to remove, upsert on change)
- Copy and regenerate actions fire `PATCH /api/chat/messages/:id/signal`

**RAG grounding** — `messageRagSources` records which chunks backed each response, enabling RAG-quality training signals.

**Training consent** — Users control whether their data is used for training via `PATCH /api/feedback/training-consent`.

#### Queue System (BullMQ)

| Queue | Jobs | Retry |
|---|---|---|
| `document-processing` | Text extraction, chunking, optional original storage | 3 attempts, exponential backoff (2s) |
| `document-indexing` | Embedding generation, pgvector upsert | 3 attempts, exponential backoff |

Redis is optional — if unavailable, processing falls back to synchronous mode and the API continues functioning.

---

### Frontend (`services/frontend`)

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS · Zustand · React Query · ReactFlow · Recharts

#### Feature Areas

**Chat** — Multi-turn streaming conversations, model/parameter selection (temperature, maxTokens, topP, penalties), message actions (copy, regenerate, bookmark, delete), file attachments, session history with auto-title generation, export (JSON, Markdown, PDF).

**RAG Search** — Document upload (drag-drop or browse), real-time indexing status with 5-second polling, filter chips (all / ready / indexing / failed / selected), per-document retry and delete, grounded chat scoped to selected documents. Workspace role, tier, file capacity and storage limits surfaced inline.

**Workflow Builder** — ReactFlow-based visual editor. Node types: LLM, Input, Output, Conditional, Data Transform. Execution logs, template gallery.

**Notebooks** — Jupyter-style interface. Cell types: Markdown, Code, AI, Chart, Knowledge, Agent, Debug. RAG config per cell.

**JoaLLM Farm** — Browse, filter, and compare all available LLM models by provider, capability, speed, quality, and pricing.

**Knowledge Manager** — File browser with metadata, upload, status tracking.

**Bookmarks** — Quick-access panel for saved messages, sessions, files, workflows, and search results.

**Settings Panel** — Profile, preferences (theme, font, workspace mode), notifications, 2FA setup, session management, custom API keys, subscription, usage stats, training consent toggle (Data tab).

#### State Architecture

| Layer | Tool | Scope |
|---|---|---|
| Server state | React Query | API data, cache, invalidation |
| Global client state | Zustand | Chat store (active session, messages) |
| Auth, theme, LLM, workflow | React Context | App-wide singletons |
| User role / workspace | `EnhancedUserRoleContext` | Role, tier, permissions, limits, workspace config |

#### Session Lifecycle

When a user switches sessions or creates a new one, the previous session is marked `completed` before switching. On tab close, `beforeunload` fires a keepalive `fetch` (falling back to `sendBeacon`) to mark the session `abandoned`. A `sessionStatusRef` map prevents duplicate signals.

#### Workspace Modes

`workspaceMode` (stored in user preferences, not an access gate) drives UI/UX behaviour:

| Mode | Context |
|---|---|
| `personal` | Individual user, single-owner defaults |
| `team` | Collaborative, shared workspace UI |
| `enterprise` | Advanced settings, full audit trail visibility |

---

### Landing Page (`services/landing-page`)

**Stack:** React · TypeScript · Vite · Tailwind CSS

Marketing site covering the six core platform capabilities (Chat, Knowledge Base, Workflow Builder, Notebooks, Model Farm, Documentation). Includes hero CTA, feature cards, example prompts, and links to the main application.

---

## Shared Workspace (`shared/`)

| Path | Contents |
|---|---|
| `shared/types/` | User, ApiResponse, ChatMessage, Document, LLM model, access control types |
| `shared/utils/` | Input validation, circuit breaker, file validation, error formatting |
| `shared/events/` | Redis event bus, domain events (user.created, document.processed, …) |
| `shared/services/` | Backup, recovery, data-consistency manager |
| `shared/sdk/` | TypeScript client SDK and type definitions |

---

## Development

### Prerequisites

- Node.js >= 18
- npm >= 8
- PostgreSQL 15 with pgvector extension
- Redis 7

### Install

```bash
npm install
```

### Environment Variables

Copy and populate the example files:

```bash
cp services/backend/.env.example services/backend/.env
cp services/frontend/.env.example services/frontend/.env
cp services/landing-page/.env.example services/landing-page/.env
```

Key backend variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `ENCRYPTION_KEY` | 64-char hex key for API key encryption |
| `OPENAI_API_KEY` | OpenAI platform key (optional if users supply their own) |
| `ANTHROPIC_API_KEY` | Anthropic platform key (optional) |
| `COHERE_API_KEY` | Required for primary embedding service |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `FRONTEND_URL` | Frontend origin (for CORS and OAuth redirects) |

### Database

```bash
cd services/backend
npm run db:migrate    # Apply migrations
npm run db:studio     # Drizzle Studio (browser-based DB inspector)
```

### Run (all services)

```bash
npm run dev
```

Individual services:

```bash
npm run dev:backend    # http://localhost:3001
npm run dev:frontend   # http://localhost:5173
npm run dev:landing    # http://localhost:5174
```

### Run with Docker

```bash
npm run docker:up      # Start PostgreSQL + Redis via docker-compose
npm run docker:down    # Stop containers
```

---

## Testing

```bash
# All workspaces
npm run test

# Backend only (with coverage)
cd services/backend && npm run test -- --coverage
```

The backend test suite spins up an isolated PostgreSQL and Redis instance. Coverage reports are uploaded to Codecov.

---

## Deployment

### Railway

Each service has its own Railway service definition in `railway.json`. Railway watches the repository and triggers a redeploy on push to `main`.

**Service health checks:**
- Backend: `GET /api/health`
- Frontend / Landing: nginx serves static build artifacts

**File storage:** Railway volumes mounted at `/app/data/uploads`. AWS S3 and Cloudflare R2 are supported via the storage provider abstraction (`STORAGE_PROVIDER=s3|r2|volume`).

### CI/CD (GitHub Actions)

The pipeline at `.github/workflows/ci.yml` runs on every push and pull request to `main` or `develop`:

1. Lint — backend, frontend, landing page
2. Test — backend with PostgreSQL 15 + Redis 7 service containers
3. Security audit — `npm audit --audit-level=high` (non-blocking)
4. Build — all three services

Railway deploys automatically after a successful push to `main`.

### Production Build

```bash
npm run build             # All services
npm run build:backend     # Backend only
npm run build:frontend    # Frontend only
npm run build:landing     # Landing page only
```

---

## Documentation

Extended documentation lives in [`docs/`](./docs/):

| Section | Path |
|---|---|
| Getting Started | `docs/01-getting-started/` |
| Features | `docs/02-features/` |
| Deployment | `docs/03-deployment/` |
| Architecture | `docs/04-architecture/` |
| Troubleshooting | `docs/05-troubleshooting/` |

The backend also serves a live Swagger UI at `/api/docs` in development.

---

## License

Proprietary. All rights reserved. Unauthorised copying, modification, distribution, or use of this software is strictly prohibited.
