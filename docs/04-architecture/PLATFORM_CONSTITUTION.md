# JoaLLM / ATRISI Platform Constitution

Status: **constitutional**  
Last updated: 2026-07-21

## The rules

> **Studio creates. Products operate. Platform remembers.**

> **Studio owns publishing intent. Platform owns execution capability.**

These apply to the entire JoaLLM platform and every ATRISI product — not only ATRISI Marketing.

```text
Creator
        │
        ▼
Studio
(Create / Edit / Review / Publish intent · Channels · Profiles)
        │
        ▼
Product (Brain)
(Strategy · Campaigns · Intelligence · Timeline UI)
        │
        ▼
Platform
(Identity · Timeline · Knowledge · Memory · Intelligence
 · Integration Platform: Connectors · OAuth · Secrets · Webhooks)
        │
        ▼
External systems
(Meta · LinkedIn · Mailchimp · LTI · Meritto · Razorpay · …)
```

---

## Separation of concerns

| Layer | Role | Buys / uses |
|---|---|---|
| **Studio** | Workspace for humans + AI to create, edit, review, approve, and express **publish intent** | Not sold as “the CRM/LMS” |
| **Product (Brain)** | Domain operating surface — strategy, campaigns, intelligence, outcomes | ATRISI Marketing, Education, … |
| **Platform** | Shared constitutional services + **Integration Platform** | Identity, Timeline, Knowledge, Memory, Intelligence, Connectors |
| **External** | Delivery and optimization | Ads, email, LMS, payments, ERPs |

### Studio must not become another product

Do not turn Studio into a second CRM, LMS, EMR, or marketing suite. Studio is the **workspace**. Products are what institutions buy. Platform is what all products share.

### Studio must not own connectors

Connectors are **technical** (API clients, OAuth, secrets, webhooks). They live in the **Integration Platform**. Studios and products consume them through **Channels** (business destinations). Marketing never talks directly to Meta; Learning never owns LTI; Admissions never owns Meritto; Finance never owns Razorpay.

---

## Channel vs Connector

```text
PublishingJob  →  Channel  →  Connector  →  External API
     (intent)     (business)   (technical)     (vendor)
```

| Concept | Owner | Example |
|---|---|---|
| **Channel** | Studio (domain) | LinkedIn Organic, LinkedIn Ads, Meta Ads, WhatsApp, Email |
| **Connector** | Platform Integration | LinkedIn UGC API, LinkedIn Marketing API, Meta Marketing API v23 |
| **Publishing Profile** | Studio | “ATRISI Corporate → LinkedIn Organic” with defaults (UTM, brand, timezone) |
| **Publishing Job** | Studio | Durable execution request: campaign + asset + profile/channel + schedule + status |

Studio UI thinks in Channels (`Publish to LinkedIn Organic`). It never cares whether Graph API, REST, or a future SDK performs the call.

When Meta ships API v24, the **Channel** stays; only the **Connector** binding changes.

---

## Product ↔ Studio pairing

| Studio (create / publish intent) | Product / Brain (operate) |
|---|---|
| Marketing Studio | ATRISI Marketing |
| Learning Studio | ATRISI Education |
| Research Studio | ATRISI Research |
| Assessment Studio | ATRISI Assessment |
| Healthcare Studio | ATRISI Healthcare |

Same Integration Platform underneath every Studio.

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
```

---

## Ownership model (Marketing example)

### Platform owns

* Connector, OAuth, Secrets, API clients, Webhooks
* Event normalization into AcquisitionEvents
* Timeline, Identity, Knowledge, Memory, Evidence services

### Marketing Studio owns

* Channel, Publishing Profile, Publishing Job
* Marketing Asset, Creative, Template, Campaign Brief
* Approval, Brand Kit, Audience Segment (studio-facing)

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
| Studio talks to vendor APIs without Channel | Couples UI to API versions |
| Product forks Identity / Timeline / Memory | Breaks institutional graph |
| Publish without emitting platform events | Content never joins timelines / outcomes |
| Lead score before Evidence | Scoring without provenance |

---

## Correct flow (marketing)

```text
Strategy → Campaign → Studio Asset → Publishing Job
  → Publishing Profile → Channel → Platform Connector
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
→ Integration Platform (Connector registry) alongside Acquisition connectors
```

### Product (current)

```text
ATRISI Marketing (Brain) — consumes platform services
```

### Workspace (next Studio slice)

```text
Marketing Studio — Channels, Publishing Profiles, Publishing Jobs, assets, approvals
```

Preserve this boundary as the platform grows.

See also:

* [Knowledge Acquisition Direction](./KNOWLEDGE_ACQUISITION_DIRECTION.md)
* [Marketing Studio Direction](./MARKETING_STUDIO_DIRECTION.md)
