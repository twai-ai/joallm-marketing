# ATRISI Meta Service (optional local edge)

Local/dev helper that mirrors Meta webhook verify + optional auto-reply.

**Production on Railway does not use this service.**  
Point Meta’s callback at the JoaLLM backend:

```text
https://<backend>.up.railway.app/api/meta/webhook
```

Architecture:

```text
Railway frontend + backend + Postgres + Redis
```

## Install / run (local only)

```bash
npm install
npm start
```

## Optional forward to local JoaLLM backend

```bash
JOALLM_API_URL=http://localhost:3001
JOALLM_API_KEY=<same as backend API_KEY>
JOALLM_OWNER_USER_ID=<optional user uuid>
META_VERIFY_TOKEN=atrisi_meta_webhook_verify
META_ACCESS_TOKEN=
META_PHONE_NUMBER_ID=
ENABLE_AUTO_REPLY=true
```

If `JOALLM_API_KEY` is set, payloads are forwarded to  
`POST /api/acquisition/webhooks/meta`.
