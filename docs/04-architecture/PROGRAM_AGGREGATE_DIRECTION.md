# Program Aggregate Direction

Status: **constitutional product direction**  
Last updated: 2026-07-21  
Parent: [Platform Constitution](./PLATFORM_CONSTITUTION.md)  
Pattern: [Institution Capability Pattern](./INSTITUTION_CAPABILITY_PATTERN.md)  
Growth detail: [Program Growth Direction](./PROGRAM_GROWTH_DIRECTION.md)

## Philosophy

ATRISI designs **Institution Capability**, not a marketing suite.

```text
Institution
      │
      ▼
Program                 ← durable aggregate
      │
      ├── Core            ← what the Program *is*
      └── Capabilities    ← how the Program *runs*
            ├── Growth
            ├── Admissions
            ├── Learning
            ├── Assessment
            ├── Credentialing
            ├── Placement
            ├── Alumni
            └── Intelligence
```

**Growth is not data on the Program** — it is a capability attached to it.

Public catalog: [atrisi.org/programs](https://atrisi.org/programs)

---

## ATRISI surface map (current reality)

| Surface | Role today |
|---|---|
| **[atrisi.org](https://atrisi.org)** | Public institution site — Programs catalog, jobs, narrative. **Source** of program/job definitions for Education. |
| **[education.atrisi.org](https://education.atrisi.org)** | Education OS — Learning, Admissions, etc. **Already gets Program + job data from atrisi.org.** |
| **This platform** (`platform.atrisi.org` / joallm-marketing) | **Student acquisition from the market** — Growth, Acquisition Intelligence, campaigns, channel ingest, Person Timelines. |

```text
atrisi.org  ──program/job defs──►  education.atrisi.org
     │
     │  catalog copy (seed / reference)
     ▼
this platform (Marketing / Acquisition)
     │
     │  campaign + channel engagement
     │  application / interest intent
     ▼
education.atrisi.org  ◄── pulls acquisition outcomes (future contract)
```

**Implication for this codebase:**

- Do **not** become the system of record for Program/job definitions that Education already takes from atrisi.org.
- Seed Program context here only as needed for Growth/Acquisition (which program a campaign targets).
- Own: market channels → students/prospects → attributed interest / application intent.
- Education continues to own delivery; it may later **pull** acquisition outcomes from this platform.

---

## This product is Marketing / Growth — not Education sync

**Do not connect Program Core to Education as a source system.** Education already loads programs/jobs from **atrisi.org**.

This platform touches **student acquisition from the market**. Program labels here are Growth context (campaign targeting), not a competing program registry.

---

## Core vs Capability

### Core (Program owns)

Defines what the Program *is*:

```text
Program.Core
├── Identity              name, slug, family, status, institution
├── Positioning           tagline, value props, differentiation
├── Audience              eligibility, segments, ICPs
├── Pricing               tuition, scholarships, packages
├── Schedule              duration, mode, calendar
├── Cohorts               intakes, capacity, faculty
└── Outcomes Definition   success criteria for this Program
```

Examples of core fields: Name · Description · Duration · Mode · Pricing · Eligibility · Capacity · Faculty · Cohorts.

### Capabilities (attached)

| Capability | Answers | Owns (examples) |
|---|---|---|
| **Growth** | How do we attract participants? | Campaigns, Creative Projects, Assets, Publishing Jobs, Channels, Applications (intent), Growth Analytics |
| **Admissions** | Who gets in? | Applications, Evaluations, Offers, Decisions, Enrollment |
| **Learning** | How do participants learn? | Curriculum, Modules, Assignments, Evidence, Progress |
| **Assessment** | How is mastery judged? | Rubrics, assessments, reviews |
| **Credentialing** | What is certified? | Credentials, badges, transcripts |
| **Placement** | What happens after? | Opportunities, matches, employers |
| **Alumni** | How does the network compound? | Mentoring, referrals, community |
| **Intelligence** | What are we learning? | Program-scoped IQ + Brain rollups |

Every capability follows the same stack:

```text
Program → Capability → Workspace → Platform Services
```

---

## Program Workspace (shell)

```text
Program: Amplify with AI
────────────────────────
Overview          ← Core summary
Growth            ← Growth Workspace
Admissions
Learning
Assessment
Analytics
Settings          ← Core edit
```

Selecting **Growth** opens the Growth Capability Workspace — not a separate product root.

---

## Growth Capability aggregate

```text
Growth
│
├── Strategy
├── Campaigns
├── Creative Projects
├── Assets
├── Publishing
├── Engagement
├── Applications
├── Attribution
└── Intelligence
```

Internal structure matches the Capability Pattern (Strategy · Operations · Timeline · Intelligence · Analytics).

---

## Brain vs Workspace

| | Cross-program Brain | Program Capability Workspace |
|---|---|---|
| Brand today | ATRISI Marketing | Marketing Studio → Program / Growth |
| Scope | Many Programs | One Program + one Capability |
| Example | Best channels for exec ed | Final Call campaign for Amplify C3 |

---

## Shared type sketch (stabilize before CRUD)

```text
Program
  id, institutionId, slug, family, status
  core: ProgramCore
  // capabilities are NOT embedded blobs of all ops data
  // they are namespaces / bounded contexts keyed by programId

ProgramCore
  identity, positioning, audience, pricing, schedule, cohorts, outcomesDefinition

GrowthCampaign
  programId, intentTemplate, status, …

// AdmissionsApplication, LearningModule, … each carry programId
```

Implementation milestone: seed **Program + ProgramCore** from the ATRISI catalog (local) — no education source sync. Growth objects second; expose a pull API for education.atrisi.org third.

---

## Sequencing (ontology before features)

1. ~~Institution Capability Pattern~~  
2. ~~Program Aggregate Core vs Capability~~ (this doc)  
3. Seed ATRISI Programs as local Program rows (catalog — not synced)  
4. Growth objects under `programId`  
5. Campaigns + channel ingest → application intent on this platform  
6. **Pull contract** for education.atrisi.org (applications / attributed interest)  
7. Acquisition attribution → Program / Campaign  

Resist inventing Program sync from Education. Education pulls Growth outcomes.
