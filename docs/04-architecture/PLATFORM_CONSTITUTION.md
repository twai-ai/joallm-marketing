# JoaLLM / ATRISI Platform Constitution

Status: **constitutional**  
Last updated: 2026-07-21

## The rules

> **Studio creates. Products operate. Platform remembers.**

> **Studio owns publishing intent. Platform owns execution capability.**

> **Studio owns creative intent. Platform owns generative capability.**

> **Program is the primary growth object. Campaigns live under Programs.**

These apply to the entire JoaLLM platform and every ATRISI product — not only ATRISI Marketing (Program Growth).

```text
Creator
        │
        ▼
Studio
(Program-scoped Create / Edit / Review / Publish
 · Campaigns · Channels · Profiles · Generation Profiles)
        │
        ▼
Product (Brain)
(Program Growth · Strategy · Timelines · Intelligence)
        │
        ▼
Platform
(Identity · Timeline · Knowledge · Memory · Intelligence
 · Integration Platform: Connectors · OAuth · Secrets · Webhooks
 · Creative AI: Image / Video / Audio / Voice / OCR / Upscale / …)
        │
        ▼
External systems
(Meta · LinkedIn · Mailchimp · OpenAI · Imagen · FLUX · Ideogram · …)
```

Canonical Marketing framing: [PROGRAM_GROWTH_DIRECTION.md](./PROGRAM_GROWTH_DIRECTION.md).

---

## Separation of concerns

| Layer | Role | Buys / uses |
|---|---|---|
| **Studio** | Workspace for humans + AI to create, edit, review, approve, express **publish intent** and **creative intent** — for ATRISI Marketing, always **Program-scoped** | Not sold as “the CRM/LMS” |
| **Product (Brain)** | Domain operating surface — for Marketing: **Program Growth** (strategy, campaigns under Programs, intelligence, Timelines) | ATRISI Marketing, Education, … |
| **Platform** | Shared constitutional services + Integration + **Creative AI** | Identity, Timeline, Knowledge, Connectors, Generative media |
| **External** | Delivery, vendor AI models, optimization | Ads, email, LMS, image/video APIs |

### ATRISI Marketing = Program Growth

The primary object is **Program** (course, bootcamp, workshop, event, initiative) — not Campaign.

```text
Program → Campaign → Creative → Assets → Channel → Application → Enrollment → Learning
```

See [PROGRAM_GROWTH_DIRECTION.md](./PROGRAM_GROWTH_DIRECTION.md). Do not become a generic marketing suite.

### Studio must not become another product

Do not turn Studio into a second CRM, LMS, EMR, or marketing suite. Studio is the **workspace**. Products are what institutions buy. Platform is what all products share.

### Studio must not own connectors

Connectors are **technical** (API clients, OAuth, secrets, webhooks). They live in the **Integration Platform**. Studios consume them through **Channels**.

### Studio must not own generative providers

Image / video / audio model vendors are **technical**. They live in the **Creative AI Platform**. Studios consume them through **Generation Profiles** (style + quality + Auto provider). Marketing never hard-codes OpenAI; Learning never hard-codes Imagen; Research never forks a private Stable Diffusion client.

---

## Channel vs Connector

```text
PublishingJob  →  Channel  →  Connector  →  External API
     (intent)     (business)   (technical)     (vendor)
```

| Concept | Owner | Example |
|---|---|---|
| **Channel** | Studio (domain) | LinkedIn Organic, LinkedIn Ads, Meta Ads, WhatsApp, Email |
| **Connector** | Platform Integration | LinkedIn UGC API, Meta Marketing API v23 |
| **Publishing Profile** | Studio | “ATRISI Corporate → LinkedIn Organic” with defaults |
| **Publishing Job** | Studio | Durable execution request |

Studio UI thinks in Channels. It never cares about Graph vs REST vs SDK versions.

---

## Generation Profile vs Image Provider

```text
Generate request  →  Generation Profile  →  Image Provider  →  Vendor API
     (intent)            (business)            (technical)        (vendor)
```

| Concept | Owner | Example |
|---|---|---|
| **Generation Profile** | Studio (domain) | Marketing Poster · Premium · Auto |
| **Image Generation Provider** | Platform Creative AI | OpenAI GPT Image, Google Imagen, FLUX, Ideogram, Firefly, Stability |
| **Creative Job** | Studio / Platform | Durable generation request + outputs + cost |

Studio UI exposes **Style** and **Quality** first. Provider defaults to **Auto**. Advanced users may override.

When OpenAI ships a new image model, the **Generation Profile** stays; only the **Provider** binding / router changes.

---

## Product ↔ Studio pairing

| Studio (create / publish / creative intent) | Product / Brain (operate) |
|---|---|
| Marketing Studio | ATRISI Marketing |
| Learning Studio | ATRISI Education |
| Research Studio | ATRISI Research |
| Assessment Studio | ATRISI Assessment |
| Healthcare Studio | ATRISI Healthcare |

Same Integration Platform and Creative AI Platform underneath every Studio.

---

## Shared platform services

Every product and Studio consumes — never forks — these:

```text
Identity
Knowledge Acquisition
Timeline Service
KnowledgeArtifact (Interpretation)
Institutional Memory
Evidence
Intelligence
Automation
Integration Platform
  ├── Connector Registry
  ├── OAuth
  ├── Secrets
  ├── API Clients
  └── Webhooks / event normalization
Creative AI Platform
  ├── Image Generation
  ├── Video Generation
  ├── Audio Generation
  ├── Voice
  ├── OCR
  ├── Background Removal
  ├── Upscaling
  └── Style Transfer
```

---

## Ownership model (Marketing example)

### Platform owns

* Connector, OAuth, Secrets, API clients, Webhooks
* Event normalization into AcquisitionEvents
* Timeline, Identity, Knowledge, Memory, Evidence services
* **Creative AI providers** (OpenAI, Imagen, FLUX, Ideogram, Firefly, Stability, …)
* Provider routing / Auto selection / capability negotiation

### Marketing Studio owns

* Channel, Publishing Profile, Publishing Job
* Marketing Asset, Creative, Template, Campaign Brief
* Approval, Brand Kit, Audience Segment
* **Generation Profiles** (Marketing Poster, Social Media, Hero Banner, …)

### Marketing Brain (ATRISI Marketing) owns

* Initiative, Campaign, Audience definitions, Goals
* Attribution, Intelligence, Recommendations
* Timeline / Evidence **views** (consumes Platform services)

---

## Anti-patterns (forbidden)

| Anti-pattern | Why |
|---|---|
| Product builds its own email/LP/social/CMS suite | Becomes HubSpot; mediocre at everything |
| Studio becomes the sold “system of record” | Confuses workspace with product |
| Studio or Product owns Meta/LinkedIn API clients | Breaks Integration Platform reuse |
| Studio hard-codes OpenAI / Ideogram SDK calls | Breaks Creative AI reuse across Studios |
| Studio talks to vendor APIs without Channel / Profile | Couples UI to API versions |
| Product forks Identity / Timeline / Memory | Breaks institutional graph |
| Publish without emitting platform events | Content never joins timelines / outcomes |
| Lead score before Evidence | Scoring without provenance |

---

## Correct flow (marketing)

```text
Strategy → Campaign → Studio Asset
  → (optional) Creative AI via Generation Profile → Asset variants
  → Publishing Job → Publishing Profile → Channel → Platform Connector
  → Meta / LinkedIn / Mailchimp
  → Webhook → Platform Timeline → Marketing Brain → Knowledge Graph
```

Ask: *Which LinkedIn assets produced mentors?* — answered by Platform graph, not Studio vanity metrics.

---

## Roadmap coherence

### Platform (build order)

```text
Identity → Knowledge Acquisition → Timeline Service → KnowledgeArtifact
→ Institutional Memory → Evidence → Intelligence
→ Integration Platform (Connector registry)
→ Creative AI Platform (Image providers + Generation Profiles)
```

### Product (current)

```text
ATRISI Marketing (Brain) — consumes platform services
```

### Workspace

```text
Marketing Studio — Channels, Publishing Profiles, Publishing Jobs,
                   Generation Profiles (creative intent), assets, approvals
```

Preserve this boundary as the platform grows.

See also:

* [Knowledge Acquisition Direction](./KNOWLEDGE_ACQUISITION_DIRECTION.md)
* [Marketing Studio Direction](./MARKETING_STUDIO_DIRECTION.md)
* [Creative AI Direction](./CREATIVE_AI_DIRECTION.md)
