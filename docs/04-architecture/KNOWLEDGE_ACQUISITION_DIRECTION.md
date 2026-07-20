# Institutional Knowledge Operating System — Architectural Direction

Status: **constitutional platform direction**  
Last updated: 2026-07-20  
Studio surface today: **Acquisition Intelligence** → product brand **ATRISI Marketing**  
Platform constitution: [PLATFORM_CONSTITUTION.md](./PLATFORM_CONSTITUTION.md) — *Studio creates. Products operate. Platform remembers.*

## Principle

**Do not pivot.** Acquisition Intelligence remains the Layer 1 foundation.

**Constitutional rule (entire JoaLLM / ATRISI platform):**

> **Studio creates. Products operate. Platform remembers.**

Destination: an **Institutional Knowledge Operating System** — not marketing automation, and not a HubSpot clone.

```text
Knowledge Acquisition
        ↓
Timeline Service
        ↓
Knowledge Interpretation
        ↓
Institutional Memory
        ↓
Evidence
        ↓
Institutional Intelligence
        ↓
Journey Intelligence
        ↓
Automation
```

| Actor | Role |
|---|---|
| Meta / WhatsApp / Website / … | Contribute knowledge (execute externally) |
| **Timeline Service** | Organize knowledge (before and after interpretation) |
| Media AI / interpreters | Interpret knowledge into KnowledgeArtifacts |
| Institutional Memory | Preserve the graph |
| Evidence | Derive claims from timelines |
| AI | Reason over knowledge |
| Automation | Execute decisions through external systems |

**Why Timeline sits before Interpretation:** raw events already need a home. Interpretation enriches the same timeline; it does not create it.

---

## Brain vs Execution (anti-HubSpot rule)

Instance of the platform constitution: **Studio creates. Products operate. Platform remembers.**  
Publishing split: **Studio owns publishing intent. Platform owns execution capability.**  
Full rule: [PLATFORM_CONSTITUTION.md](./PLATFORM_CONSTITUTION.md).  
Studio detail: [MARKETING_STUDIO_DIRECTION.md](./MARKETING_STUDIO_DIRECTION.md).

Do **not** become everything (CRM + CMS + email builder + social scheduler + SEO + ads + forms + analytics). That path made HubSpot, Marketo, and Salesforce Marketing Cloud mediocre at many jobs.

Separate **Brain** from **Studio intent** from **Platform execution**:

```text
Marketing Brain                 Marketing Studio              Integration Platform
──────────────                  ────────────────              ────────────────────
Strategy / Campaigns            Assets / Channels             Connectors / OAuth
Intelligence / Timeline UI      Profiles / Publishing Jobs    Secrets / Webhooks
Attribution / Recommendations   Approvals / Brand Kit         API clients
```

Marketing never talks directly to Meta. Studio publishes to **Channels**; Channels bind to **Platform Connectors**.

| Question | Wrong answer | Right answer |
|---|---|---|
| Should ATRISI Marketing create content? | Build an email/LP/social suite inside Marketing | Content lives in **Studio** |
| Should we build a Facebook scheduler? | Yes, ship our own | No — **Channel → Platform Connector** to Meta / LinkedIn / … |
| Where does a LinkedIn post live? | As a channel-specific blob | As a **Marketing Asset** → Publishing Job → Channel |

### Studio = creative workspace

```text
Studio
├── Chat
├── Knowledge
├── Media Intelligence
├── Documents
├── Marketing Studio          ← create / review / publish
│     ├── Campaigns
│     ├── Content Library     (RAG-searchable)
│     ├── Creative Assistant
│     ├── Media Library
│     ├── Publishing          (Channels · Profiles · Jobs)
│     └── Analytics
└── Research
```

### ATRISI Marketing = operational brain

```text
Acquire → Remember → Understand → Measure → Optimize
```

Not: email builder, landing-page builder, workflow builder (out of Marketing v1 and not a Marketing product island).

### Marketing Asset (content as institutional asset)

```text
Campaign → Marketing Asset → Versions → Approvals
         → Publishing Job → Channel → Connector → Performance → Knowledge
```

One asset may fan out (via AI in Studio) to LinkedIn, X, Instagram, WhatsApp, blog, email, landing page — still one asset in memory.

### Publishing joins the graph

```text
Publish (Studio intent → Channel → Platform Connector)
  → Acquisition Event (source=linkedin, campaign=…, asset=…)
  → Person Timeline (asset.viewed / engaged)
  → later: “Which posts produced mentors?”
```

Content impact, not vanity engagement.

**Build Marketing Studio after Timeline Service (Phase A) and KnowledgeArtifact (Phase B).**  
Studio publishes through **Channels → Platform Connectors** so events feed ATRISI Marketing.  
See [MARKETING_STUDIO_DIRECTION.md](./MARKETING_STUDIO_DIRECTION.md). Do not let Marketing Studio become a second CRM or replace ATRISI Marketing.

---

## Timeline Service (not “Relationship Timeline”)

Name it **Timeline Service** — timelines are not Person-only.

```text
Person Timeline
Initiative Timeline
Campaign Timeline
Organization Timeline
Institution Timeline
Program Timeline
```

Canonical Person view (Phase A):

```text
Person
  └── Timeline
        ├── Events
        ├── Knowledge Artifacts
        ├── Communications
        ├── Decisions
        ├── Evidence
        ├── Learning
        └── Outcomes
```

Every future module consumes this service. Studio’s current interaction list is a Phase-1 projection only.

---

## Build priority (reordered checkpoint)

Do **not** rush Initiative Intelligence.

### Phase A — Finish the Person Timeline *(next)*

Core of ATRISI Marketing. The object every module will consume.

### Phase B — KnowledgeArtifact + Media AI linkage

```text
Call → Transcript → KnowledgeArtifact → Timeline
```

“Meeting attended” becomes meeting → transcript → questions → action items → commitments.

### Phase C — Initiative Intelligence

```text
Initiative → Campaign → Touchpoints → Timeline → Capability Funnel
```

Initiatives aggregate timelines; they are not built first.

### Phase D — Evidence

Derived from timelines (e.g. visited 4× + challenge complete + asked pricing → Builder Intent).

### Phase E — Institutional Intelligence

AI answers: who completes, who to call, which campaigns produce builders/mentors.

---

## Immutable acquisition spine

```text
Webhook → Raw → Canonical Event → Identity → Timeline Service
```

Connectors normalize only. No business logic in connectors. Raw records immutable.

---

## Knowledge Interpretation (Phase B)

KnowledgeArtifact = *interpreted representation*, not a storage blob.

Media AI is one interpretation modality feeding the Timeline Service.

---

## ATRISI Marketing v1 — what ships

```text
✓ Source Connectors
✓ Identity Resolution
✓ Unified Timeline          ← Phase A
✓ Knowledge Artifacts       ← Phase B
✓ Campaign Attribution      ← Phase C
✓ Initiative Dashboard      ← Phase C
✓ Capability Funnel         ← Phase C/D
✓ AI Search                 ← Phase E
```

**Explicitly out of Marketing v1 / never as Marketing-owned builders:**

```text
✗ Email builder
✗ Landing page builder
✗ Social scheduler (own)
✗ CMS / blog engine
✗ Workflow builder as marketing core
```

Those belong in **Studio → Marketing Studio** later, publishing through **Channels** (Platform Connectors underneath) so events feed ATRISI Marketing.

---

## First “wow” moment

Open a Person. See everything — Meta lead → website → WhatsApp → webinar (with interpreted transcript) → Builder Challenge 81% → interview → enrolled.

Then: *Show me everyone like Aman* / *Compare Aman to people who became mentors.*

That is when users stop seeing “marketing software” and see an **AI-native relationship intelligence platform**.

---

## Practical gate before `main`

**Dogfood ATRISI Marketing on ATRISI itself:** connect real Meta campaigns, atrisi.org, WhatsApp, webinars, Builder Challenge, and Education Platform. If the team can answer Amplify with AI funnel questions without spreadsheets, architecture and product direction are validated.

Merge / Railway follow dogfood readiness — do not expand features to compensate for an unproven timeline.

---

## Mindset

Marketo: *How do I convert a lead?*  
ATRISI Marketing: *How does a person evolve over time?*

Optimize for human development and institutional outcomes — not CPC/CTR alone.

Relationship Maturity (constitutional person state):

```text
Unknown → Observed → Identified → Engaged → Participating
→ Contributing → Leading → Mentoring → Partnering
```

---

## What exists today

| Capability | Status |
|---|---|
| Meta WhatsApp → BullMQ → Person timeline (interactions) | Live |
| Identity / raw / event / interaction tables | Live |
| Shared contracts (incl. Timeline + KnowledgeArtifact types) | Live |
| ATRISI Marketing branding + institutional Studio UI | Live |
| Timeline Service (Person + artifacts) | Phase A/B shipped — dogfood |
| KnowledgeArtifact persistence + Media AI link | Phase B shipped — dogfood |
| Initiative APIs / dashboard | Phase C |
| Marketing Studio Channels / Profiles / Jobs | Studio-0 contracts live; implementation later |
| Evidence / Intelligence | Phase D / E |
| Dogfood on ATRISI ops | Gate before main |

---

## Tenancy

Phase 1: `ownerUserId` (+ optional `organizationId`).  
Target: org-scoped uniqueness `organizationId + provider + externalId`.
