# Institutional Knowledge Operating System — Architectural Direction

Status: **constitutional platform direction**  
Last updated: 2026-07-20  
Studio surface today: **Acquisition Intelligence** (do not rename until deliberate)

## Principle

**Do not pivot.** The current Acquisition Intelligence implementation is the Layer 1 foundation.

Long-term destination is not Marketing Automation or even “Relationship Intelligence” alone — it is an **Institutional Knowledge Operating System** that every vertical reuses (Education, Research, Healthcare, Manufacturing, Media).

```text
Knowledge Acquisition
        ↓
Knowledge Interpretation
        ↓
Relationship Timeline
        ↓
Institutional Memory
        ↓
Institutional Intelligence
        ↓
Journey Intelligence
        ↓
Automation
```

Roles in that stack:

| Actor | Role |
|---|---|
| Meta / WhatsApp / Website / … | Contribute knowledge (execute externally) |
| Media AI / interpreters | Interpret knowledge |
| Relationship Timeline | Organize knowledge |
| Institutional Memory | Preserve knowledge |
| AI | Reason over knowledge |
| Automation | Execute decisions through external systems |

Studio surface remains **Acquisition Intelligence** until product rename is deliberate. Internal module rename `acquisition/` → `knowledge-acquisition/` is gradual and non-breaking.

---

## Four constitutional layers

```text
Knowledge Acquisition
        │
        ▼
Knowledge Interpretation
        │
        ▼
Institutional Memory
        │
        ▼
Institutional Intelligence
```

### Layer 1 — Knowledge Acquisition (current work)

Acquire **everything**: Meta, website, WhatsApp, email, meetings, media, Builder Challenge, education platform, documents, research, operational events.

Output (immutable pipeline):

```text
Raw Acquisition → Canonical Event → Identity → Timeline spine
```

Connectors normalize only. No business-specific logic inside connectors. Raw records stay immutable.

### Layer 2 — Knowledge Interpretation

**KnowledgeArtifact belongs here** — it is an *interpreted representation*, not a storage blob.

```text
Zoom Recording
  → Transcript → Speakers → Topics → Questions → Commitments
  → Sentiment → Capability Signals
  → KnowledgeArtifact
```

```text
Email
  → Thread → Intent → Action Items
  → KnowledgeArtifact
```

Media AI is one interpretation modality of Layer 2, not a separate product island.

Raw content may still live in files / RAG / pgvector. The artifact is the structured interpretation that Institutional Memory can cite.

### Layer 3 — Institutional Memory

Where the graph forms:

```text
Person → Interactions → KnowledgeArtifacts → Evidence → Timeline → Initiative
```

Postgres holds operational truth (identity, chronology, attribution, consent, decisions).  
pgvector / RAG holds semantic content referenced by artifacts.

### Layer 4 — Institutional Intelligence

Only here should AI produce **intelligence products** (recommendations), not stored facts:

```text
Ready for Interview · Needs Faculty Follow-up · High Builder Potential
Scholarship Candidate · Likely Mentor · Research Interest
```

These are derived from Evidence over Institutional Memory — never CRM lead temperatures.

---

## Mindset shift (non-negotiable)

Marketo asks: *How do I convert a lead?*  
JoaLLM asks: *How does a person evolve over time?*

Most marketing platforms optimize for acquisition:

```text
Ads → Lead → Email → Sale
```

ATRISI / JoaLLM optimize for human development and institutional outcomes:

```text
Ads → Person → Engagement → Learning → Capability → Outcome → Institutional Memory
```

**Do not replace** what Meta is good at (ads, CPC, CTR, conversion optimization). **Ingest, interpret, and remember** what Meta cannot see after the click.

---

## Relationship Maturity (evolves the capability funnel)

Prefer maturity stages over lead → apply → enroll funnels:

```text
Unknown → Observed → Identified → Engaged → Participating
→ Contributing → Leading → Mentoring → Partnering
```

Strategic query example:

```text
Source = Meta AND Relationship Stage = Mentoring
```

That is institutional intelligence — not a conversion report.

Activity funnels (WhatsApp → webinar → challenge → cohort → intern → founder) remain useful **metrics** on top of maturity; maturity is the constitutional person state.

---

## Relationship Timeline (first-class platform service)

After KnowledgeArtifact, introduce **Relationship Timeline** as its own service — not merely “person events.”

```text
Person
  └── Timeline
        ├── Events
        ├── Knowledge Artifacts
        ├── Decisions
        ├── Learning
        ├── Communications
        ├── Evidence
        └── Outcomes
```

The timeline is the **canonical view of a person**. Studio, AI, admissions, marketing, and partnerships all query that timeline.

Today’s Studio person timeline is a Phase 1 projection of this service (interactions only). Do not fork per-vertical timelines.

---

## North-star scenario: Amplify with AI — July 2026

| Day | Layer | What happens |
|---|---|---|
| 1 | Acquisition | Meta lead → Raw → `form.submitted` → Person + Campaign + UTM/device |
| 2 | Acquisition | Website `page.viewed` / `program.viewed` / `cta.clicked` |
| 3 | Acquisition | WhatsApp join → `message.received` |
| 4 | Interpretation | Webinar → Media AI → KnowledgeArtifact (topics, pricing Q, Python, Bangalore, startup) |
| 5 | Memory | Builder Challenge started/completed + score on timeline |
| 6 | Memory | Application; identity already resolved — graph connects |

Advisor view (maturity + timeline, not “Warm”):

```text
Aman Sharma · First seen: Meta · July 14
Maturity: Participating → ready for Contributing
✔ Meta form · ✔ AI Builder page · ✔ WhatsApp · ✔ Webinar
✔ Asked pricing · ✔ Builder Challenge 81%
Intelligence: Ready for Interview
```

Capability / outcome roll-up for ₹100,000 → “300 Meta leads” eventually expands through maturity and outcomes (WhatsApp → webinar → challenge → apply → cohort → intern → founder). Chat over memory (Layer 4) only after Evidence is trustworthy.

| Narrative | Object / layer |
|---|---|
| Amplify with AI | `Initiative` (Memory) |
| July Meta creative | `Campaign` under Initiative |
| Aman Sharma | `Person` + `PersonIdentity` |
| Day activity | Raw → Event → Interaction (Acquisition) |
| Webinar insights | Knowledge Interpretation → `KnowledgeArtifact` |
| Mentoring years later | Relationship Maturity + Timeline Outcomes |
| Ready for Interview | Institutional Intelligence product |

---

## What exists today (keep)

| Layer | Status |
|---|---|
| L1 Meta WhatsApp → BullMQ ingest | Live |
| L1 Person / identity / raw / event / interaction | Live |
| L1 Studio timeline projection | Live (interactions only) |
| Initiative / Campaign schema | Present; APIs/UI next |
| L2 KnowledgeArtifact | Contracts only — implement next |
| L3 Evidence / Maturity | Deferred |
| L4 Intelligence products | Deferred |
| `ownerUserId` tenancy | Phase 1 acceptable |

See also: [Acquisition Intelligence Phase 1](../02-features/ACQUISITION_INTELLIGENCE_PHASE1.md)

---

## Milestone order

**Not** more connectors first.

1. **Shared contracts** — done / ongoing (`shared/types/knowledge-acquisition.ts`)
2. **Knowledge Interpretation: KnowledgeArtifact** — interpreted outputs from Media AI + messages + docs
3. **Relationship Timeline service** — first-class Person timeline API (events, artifacts, decisions, learning, evidence, outcomes)
4. **Initiative Intelligence** — attribution roll-up to Initiative
5. **Relationship Maturity** — constitutional stage on Person (Evidence-backed transitions)
6. **Institutional Memory: Evidence** — precedes scoring
7. **Institutional Intelligence** — recommendations as derived products
8. **Identity constitutionalization** + org tenancy (`organizationId + provider + externalId`)
9. **Module rename** — `acquisition/` → `knowledge-acquisition/`
10. **Journey Intelligence → Automation** — last layers only

### Explicitly deferred

Lead Score as a primary object. Evidence precedes scoring. Automation is last.

---

## Shared contracts (target)

```text
Person · PersonIdentity · SourceConnection · RawAcquisitionRecord
AcquisitionEvent · Interaction · KnowledgeArtifact · Initiative · Campaign
Attribution · RelationshipMaturity · RelationshipTimeline (view/service)
Journey · Evidence · Signal
```

Legacy aliases `AcquisitionPerson*` remain for compatibility.

---

## Tenancy

Phase 1: `ownerUserId` (+ optional `organizationId`).  
Target: `Organization → Workspace → Owner → Users` with identity uniqueness `organizationId + provider + externalId`, backward compatible.

---

## Immutable L1 pipeline

```text
Webhook → Raw Acquisition → Canonical Event → Identity Resolution → Timeline spine
```

Interpretation, maturity, intelligence, and automation attach **above** this spine. They must not rewrite raw history.
