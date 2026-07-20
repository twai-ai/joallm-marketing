# Acquisition Intelligence — Phase 1 (Railway architecture)

> **Architectural direction:** Acquisition Intelligence is the Studio surface for Layer 1 of the **Institutional Knowledge Operating System** (Acquisition → Interpretation → Memory → Intelligence). Do not pivot — evolve. See [Knowledge Acquisition Direction](../04-architecture/KNOWLEDGE_ACQUISITION_DIRECTION.md).

## Deploy topology (source of truth)

```text
Railway
├── frontend          → services/frontend
├── backend           → services/backend   ← Meta webhooks + Acquisition APIs + BullMQ workers
├── PostgreSQL        → persons, events, interactions, …
└── Redis             → BullMQ acquisition-ingest (+ existing queues)
```

No fifth container is required for WhatsApp/Meta in production.

`atrisi-meta-service` is optional local/dev tooling only. On Railway, Meta talks **directly** to the backend.

## Production Meta callback

```text
https://<your-backend>.up.railway.app/api/meta/webhook
```

- `GET` — Meta subscription verify (`META_VERIFY_TOKEN`)
- `POST` — inbound WhatsApp events → Redis `acquisition-ingest` queue (sync fallback if Redis down)

## Flow

```text
Meta WhatsApp
  → Railway backend /api/meta/webhook
  → BullMQ acquisition-ingest (Redis)
  → Raw record → Event → Person identity → Interaction
  → Studio UI (frontend) /studio/acquisition
```

## Backend env (Railway)

```bash
# Existing
DATABASE_URL=...
REDIS_URL=...
API_KEY=...

# Acquisition / Meta
META_VERIFY_TOKEN=atrisi_meta_webhook_verify
META_ACCESS_TOKEN=          # optional auto-reply
META_PHONE_NUMBER_ID=       # optional auto-reply + source binding
META_ENABLE_AUTO_REPLY=true
ACQUISITION_DEFAULT_OWNER_USER_ID=<joallm-user-uuid>
```

## Studio APIs (JWT)

| Method | Path |
|---|---|
| GET | `/api/acquisition/overview` |
| GET | `/api/acquisition/sources` |
| POST | `/api/acquisition/sources/meta` |
| GET | `/api/acquisition/people` |
| GET | `/api/acquisition/people/:id/timeline` |
| GET | `/api/acquisition/events` |

## Optional local forwarder

`atrisi-meta-service` may still forward to `POST /api/acquisition/webhooks/meta` with `x-api-key` during local development. Do not deploy it as a Railway service for this phase.
