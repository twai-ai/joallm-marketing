# JoaLLM / ATRISI Platform Constitution

Status: **constitutional**  
Last updated: 2026-07-20

## The rule

> **Studio creates. Products operate. Platform remembers.**

This applies to the entire JoaLLM platform and every ATRISI product — not only ATRISI Marketing.

```text
Creator
        │
        ▼
Studio
(Create / Edit / Review / Publish)
        │
        ▼
Product
(Execute business capability)
        │
        ▼
Platform
(Acquire → Timeline → Knowledge → Memory → Intelligence)
```

---

## Separation of concerns

| Layer | Role | Buys / uses |
|---|---|---|
| **Studio** | Workspace for humans + AI to create, edit, review, approve, publish | Not sold as “the CRM/LMS” |
| **Product** | Domain operating surface (what institutions buy) | ATRISI Marketing, Education, … |
| **Platform** | Shared constitutional services | Identity, Timeline, Knowledge, Memory, Intelligence, Automation |

### Studio must not become another product

Do not turn Studio into a second CRM, LMS, EMR, or marketing suite. Studio is the **workspace**. Products are what institutions buy. Platform is what all products share.

---

## Product ↔ Studio pairing

| Studio (create) | Product (operate) |
|---|---|
| Marketing Studio | ATRISI Marketing |
| Learning Studio | ATRISI Education |
| Research Studio | ATRISI Research |
| Assessment Studio | ATRISI Assessment |
| Healthcare Studio | ATRISI Healthcare |

Same pattern for every future vertical.

---

## Shared platform services

Every product consumes — never forks — these:

```text
Identity
Knowledge Acquisition
Timeline Service
KnowledgeArtifact (Interpretation)
Institutional Memory
Evidence
Intelligence
Automation
```

---

## Anti-patterns (forbidden)

| Anti-pattern | Why |
|---|---|
| Product builds its own email/LP/social/CMS suite | Becomes HubSpot; mediocre at everything |
| Studio becomes the sold “system of record” | Confuses workspace with product |
| Product forks Identity / Timeline / Memory | Breaks institutional graph |
| Publish without emitting platform events | Content never joins timelines / outcomes |
| Lead score before Evidence | Scoring without provenance |

---

## Correct flow (example: marketing)

```text
Marketing Studio
  create Marketing Asset → approve → publish via connector
        │
        ▼
ATRISI Marketing (product)
  operate acquisition, advisors, funnels, outcomes UI
        │
        ▼
Platform
  ingest publish/engage events → Timeline → Knowledge → Intelligence
```

Ask: *Which LinkedIn assets produced mentors?* — answered by Platform graph, not Studio vanity metrics.

---

## Roadmap coherence

### Platform (build order)

```text
Identity → Knowledge Acquisition → Timeline Service → KnowledgeArtifact
→ Institutional Memory → Evidence → Intelligence
```

### Product (current)

```text
ATRISI Marketing  — consumes platform services
```

### Workspace (later)

```text
Marketing Studio — create campaigns, assets, approvals, publishing
```

Preserve this boundary as the platform grows. See also: [Knowledge Acquisition Direction](./KNOWLEDGE_ACQUISITION_DIRECTION.md).
