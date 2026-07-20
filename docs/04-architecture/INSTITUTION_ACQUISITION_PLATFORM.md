# Institution Acquisition Platform

Status: **constitutional product direction**  
Last updated: 2026-07-21  
Parent: [Platform Constitution](./PLATFORM_CONSTITUTION.md)  
Related: [Program Aggregate](./PROGRAM_AGGREGATE_DIRECTION.md) · [Institution Capability Pattern](./INSTITUTION_CAPABILITY_PATTERN.md) · [Knowledge Acquisition](./KNOWLEDGE_ACQUISITION_DIRECTION.md)

## What this codebase is

**Not** “Marketing for Institutions” as the product identity.  
**Yes** — an **Institution Acquisition Platform** (pure-play market acquisition).

Marketing and advertising are **one acquisition strategy** inside that platform. The same architecture can later power admissions outreach, exec-ed enrollment, CSR nominations, research recruitment, faculty hiring, volunteer/partner acquisition — without a new root model.

| Surface | Role |
|---|---|
| **atrisi.org** | Stable SoR — programs / jobs |
| **education.atrisi.org** | Convert + Deliver (stable on server) |
| **This platform** | **Acquire** — interest from the market |

---

## Three phases (hard system boundary)

### Phase 1 — Acquire (this platform)

```text
Programs (targeting context from atrisi.org)
      │
      ▼
Acquisition Workspace
      │
      ▼
Campaigns → Creatives → Channels → Engagement
      │
      ▼
Timeline
      │
      ▼
Program Interest   ← output
```

Output is **interest**, not enrollment.

### Phase 2 — Convert (Education)

```text
Interest → Application → Evaluation → Offer → Enrollment
```

### Phase 3 — Deliver (Education)

```text
Enrollment → Learning → Assessment → Completion → Outcome
```

---

## Root outcome object: Program Interest

Campaigns are not what Education consumes. Everything in Phase 1 leads to:

```text
Program Interest
  person
  programId          (Amplify with AI, …)
  confidence
  source             (LinkedIn, WhatsApp, …)
  campaignId         (attribution — optional detail)
  evidence[]         (clicked, downloaded, attended webinar, …)
  intent
  occurredAt
```

Alias: `AcquisitionOutcome`.

### Education must not pull

- Posters, ads, creatives  
- Publishing Jobs  
- Creative Projects  
- Internal campaign ops  

### Education pulls only

```text
Program Interest → Person → Source → Evidence → Intent → (Application)
```

That keeps the integration tiny.

---

## Naming

| Prefer | Avoid as product root |
|---|---|
| **Institution Acquisition Platform** | “Marketing suite” |
| **Market Acquisition** / **Acquisition Workspace** | “Marketing Studio” as the long-term name |
| **Growth Intelligence** (Brain / cross-program IQ) | Growth as the only verb |
| **Program Interest** | Syncing Campaign/Creative entities to Education |

Transitional UI may still say “Marketing Studio”; constitutionally it is the **Acquisition Workspace** entry (Program → Acquisition).

Acquisition strategies under the workspace (not all “marketing”):

- Ads · WhatsApp · Events · Webinars · Referrals · CSR · Communities · Campus ambassadors · Partners · APIs · Imports

---

## Acquisition Workspace (per Program)

```text
Program: Amplify with AI
  └── Acquisition
        Campaigns
        Channels
        Assets
        Analytics
```

(Creative Projects / Publishing Jobs live under Campaigns → Assets → Publish.)

---

## Build sequence (validate architecture, not Creative AI)

| Sprint | Deliverable |
|---|---|
| **1** | ~~Program → Acquisition Workspace (static UI)~~ |
| **2** | ~~Campaign CRUD~~ |
| **3** | Creative Projects + Assets (upload / attach — Canva/Figma/manual OK) |
| **4** | Publishing Jobs |
| **5** | One outbound connector (LinkedIn **or** Meta Ads) |
| **6** | Timeline ingestion + attribution → Program Interest |
| **7** | Program Interest API — Education pull |

### Deliberately postpone

**AI image generation** — does not validate the architecture. Uploaded/manual assets still exercise Programs → Campaigns → Assets → Publishing → Timeline → Interest. Creative AI is a later Platform enhancement.

### Keep live today

WhatsApp inbound acquisition + Person Timeline (Phase 1 ingest path already started).

---

## Relationship to earlier docs

- Program Aggregate / Capability Pattern still describe Institution OS vocabulary.  
- **This product’s job** is Phase 1 only.  
- “Growth” in older docs maps to **Acquisition Workspace** + **Growth Intelligence** (Brain).  
- Marketing Studio Direction remains useful for Channel/Connector/Publish mechanics under Acquisition.
