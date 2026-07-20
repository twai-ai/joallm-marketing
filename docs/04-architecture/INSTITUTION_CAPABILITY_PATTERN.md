# Institution Capability Pattern

Status: **constitutional**  
Last updated: 2026-07-21  
Parent: [Platform Constitution](./PLATFORM_CONSTITUTION.md)  
Applies to: [Program Aggregate](./PROGRAM_AGGREGATE_DIRECTION.md) · [Program Growth](./PROGRAM_GROWTH_DIRECTION.md) · Education / Admissions / Learning (future)

## Purpose

Define the **standard shape** every ATRISI capability follows so new capabilities (Research, Placement, Alumni, CSR, Fundraising, Industry Engagement) are **instantiations of a pattern**, not new architectures.

This is what turns ATRISI from “an education platform with modules” into an **Institution Operating System**.

---

## Durable aggregates

Capabilities never invent their own root. They attach to one of:

| Aggregate | Role |
|---|---|
| **Institution** | Buyer / operating context |
| **Program** | Delivery unit (catalog: [atrisi.org/programs](https://atrisi.org/programs)) |
| **Person** | Relationship / learner / applicant / alumnus (Timeline) |

```text
Institution
      │
      ▼
Program          ← primary delivery aggregate
      │
      ├── Core (owned state)
      └── Capabilities (attached workspaces)
            │
            ▼
         Person Timelines (Platform)
```

---

## Universal stack

Every capability uses the same stack:

```text
Program (or Institution)
      │
      ▼
Capability          ← Growth | Admissions | Learning | …
      │
      ▼
Workspace           ← human + AI operating surface (Studio)
      │
      ▼
Platform Services   ← Timeline · Knowledge · Connectors · Creative AI · Identity
```

Constitution still holds: *Studio creates. Products operate. Platform remembers.*

Clarification:

- **Products operate** via Capability Workspaces on durable aggregates.
- **Capabilities are not columns on Program** — they are attached operating systems.

---

## Core vs Capability (critical)

### Core — Program owns (defines what the Program *is*)

```text
Identity          name, slug, family, status
Positioning       tagline, value props, differentiation
Audience          eligibility, segments, ICPs
Pricing           tuition, scholarships, packages
Schedule          duration, mode, calendar
Cohorts           intakes, capacity, faculty links
Outcomes Definition   what “success” means for this Program
```

Core is **state**. Changing Core changes the Program definition.

### Capability — attached (defines how the Program *runs*)

```text
Growth
Admissions
Learning
Assessment
Credentialing
Placement
Alumni
Intelligence        ← may also roll up at Brain / Institution
```

A capability owns its own objects, workspace, and analytics contract. It **references** Program (and often Person). It does not dump its tables into Program core.

---

## Internal shape of every Capability

Every capability is expressed as:

```text
Capability
│
├── Strategy        intent, policies, playbooks
├── Operations      day-to-day work objects
├── Timeline        events attributed to Program · Person · Capability
├── Intelligence    interpretations, recommendations
└── Analytics       contracts / north-star metrics
```

### Examples

| Capability | Strategy | Operations | Timeline | Intelligence | Analytics |
|---|---|---|---|---|---|
| **Growth** | GTM, audience bets | Campaigns, Creatives, Assets, Publishing, Channels | Engagement, applications | Attribution, creative insights | Awareness → Applications → CPE |
| **Admissions** | Policies, rubrics | Applications, Evaluations, Offers, Decisions | Status changes | Yield risk, quality signals | Admit rate, enrollment quality |
| **Learning** | Curriculum intent | Modules, Assignments, Evidence, Progress | Learning events | Capability gaps | Completion, evidence maturity |
| **Assessment** | Rubrics, standards | Assessments, reviews | Assessment events | Mastery signals | Pass / mastery rates |
| **Placement** | Employer strategy | Opportunities, matches | Placement events | Fit recommendations | Placement rate |
| **Alumni** | Community intent | Networks, mentoring | Alumni interactions | Mentorship impact | Engagement, referrals |

---

## Growth Capability (first instantiation)

Growth answers: *How do we attract participants?*

```text
Growth
│
├── Strategy
├── Campaigns
├── Creative Projects
├── Assets
├── Publishing
├── Engagement
├── Applications          ← handoff boundary toward Admissions
├── Attribution
└── Intelligence
```

Growth is **not** Program core data. Campaigns live under Growth under Program.

Workspace pattern:

```text
Program / Growth
  Overview · Campaigns · Creative Projects · Assets · Publishing
  Channels · Applications · Analytics · Intelligence
```

Studio entry today (“Marketing Studio”) is a transitional catalog → Growth workspace. Long-term: **Program Workspace → Growth tab**.

---

## Admissions Capability (boundary)

Answers: *Who gets in?*

Owns: Applications (accepted from Growth) · Evaluations · Offers · Decisions · Enrollment.

Growth may *create* application intent; Admissions *owns* the admissions aggregate after handoff.

---

## Learning Capability (boundary)

Answers: *How do participants learn?*

Owns: Curriculum · Modules · Assignments · Evidence · Capability · Progress.

Handoff from Admissions/Enrollment. Consumes Platform Timeline + Knowledge; does not own Connectors or Creative AI providers.

---

## Workspace contract

Each Capability Workspace must declare:

1. **Root aggregate** — always `Program` (or `Institution` for org-wide caps)
2. **Owned objects** — what it creates/edits
3. **Read models** — what it reads from Core / other capabilities
4. **Timeline kinds** — which Timeline entry types it emits
5. **Platform services** — Connectors, Creative AI, Knowledge, Identity, …
6. **Analytics contract** — north-star metrics + dimensions (Program, Cohort, Channel, …)
7. **Handoff ports** — e.g. Growth → Admissions via Application

---

## Brain vs Capability Workspace

| | Brain | Capability Workspace |
|---|---|---|
| Scope | Cross-program / institutional | Single Program (+ capability) |
| Question | What works across Programs? | What do we do for *this* Program? |
| Example | “Which creatives win for exec ed?” | “Run Final Call for Amplify Cohort 3” |

ATRISI Marketing (current product brand) is the **Growth Brain** (cross-program). Day-to-day Growth work is the **Growth Workspace** on a Program.

---

## Adding a new capability (checklist)

1. Name the Capability and the question it answers.  
2. Attach to Program (or Institution) — never invent a new root.  
3. Split Core vs Capability ownership — no Core pollution.  
4. Fill Strategy · Operations · Timeline · Intelligence · Analytics.  
5. Define Workspace IA and handoff ports.  
6. List Platform services consumed (never fork Connectors / Creative AI).  
7. Publish Analytics contract.  
8. Document in this pattern + Program Aggregate Direction.

---

## Naming

| Term | Meaning |
|---|---|
| **Institution Capability** | Philosophy — institutions run capabilities on Programs |
| **Capability Pattern** | This document — reusable shape |
| **Program Core** | Definitional state of a Program |
| **Capability** | Attached operating system (Growth, Admissions, …) |
| **Workspace** | Studio UI for one Capability on one Aggregate |
| **Brain** | Cross-aggregate intelligence product surface |

---

## Sequencing implication

**Stabilize ontology before features.**

1. This pattern (constitutional)  
2. Program Core schema + shared types  
3. Growth Capability objects under Program  
4. Program Workspace shell (tabs = capabilities)  
5. Only then: Campaign CRUD, Creative AI generate, Admissions handoff  

Resist bolting Campaign/Channel as peer roots to Program.
