# Program Growth Direction

Status: **constitutional product direction**  
Last updated: 2026-07-21  
Parent: [Platform Constitution](./PLATFORM_CONSTITUTION.md)  
Siblings: [Marketing Studio Direction](./MARKETING_STUDIO_DIRECTION.md) · [Knowledge Acquisition Direction](./KNOWLEDGE_ACQUISITION_DIRECTION.md)

## The problem we solve

ATRISI is **not** a generic marketing platform.

We help institutions **grow programs** — awareness, applications, admissions, and enrollment for a specific Program, Course, Event, Workshop, or Initiative.

Institutions do not wake up saying “let’s run a marketing campaign.” They say:

- “We need more MBA enrollments.”
- “We need applications for our AI Bootcamp.”
- “We need registrations for tomorrow’s webinar.”
- “We need to fill the Executive Education cohort.”

Their unit of work is always a **Program** (or Program-like object).

**Internal capability name:** Program Growth (also: Program Marketing).  
**Product surface today:** ATRISI Marketing (Brain) + Marketing Studio (create/publish).

---

## Relationship to Program Aggregate

Program Growth is a **capability**, not the root product.

See [PROGRAM_AGGREGATE_DIRECTION.md](./PROGRAM_AGGREGATE_DIRECTION.md):

```text
Institution → Program → Growth | Admissions | Learning | …
```

This document details the **Growth** capability under Program.

---

## Canonical ATRISI Programs

Public catalog: [atrisi.org/programs](https://atrisi.org/programs)

Three buckets · one systems mindset:

| Family | Programs |
|---|---|
| **Academic** | Resonance with AI (faculty) · Amplify with AI (students) |
| **Institutional Career** | Campus-to-Career AI Transformation |
| **Enterprise** | AI Native Systems Engineering · Resilient Systems |

Program Growth workspaces seed from this catalog. First dogfood Program: **Amplify with AI**.

---

## Primary object

```text
Program
```

Everything else exists to increase awareness and participation in that Program.

Example:

```text
Program: Amplify with AI
```

### Wrong spine (generic marketing)

```text
Campaign → Leads
```

### Right spine (Program Growth)

```text
Institution
    ↓
Program
    ↓
Cohort (optional)
    ↓
Go-to-Market Strategy
    ↓
Campaign
    ↓
Creative Project
    ↓
Marketing Assets
    ↓
Publishing (Channel → Connector)
    ↓
Engagement / Acquisition Events
    ↓
Application
    ↓
Admissions
    ↓
Enrollment
    ↓
Learning          ← handoff to Education Brain
```

Marketing naturally hands off to the Education Brain at Application → Admissions → Enrollment → Learning.

---

## Lifecycle (Program Marketing)

```text
Program
      │
      ▼
Go-to-Market Strategy
      │
      ▼
Campaign                 ← program-specific intent templates
      │
      ▼
Creative Project
      │
      ▼
Marketing Assets
      │
      ▼
Publishing
      │
      ▼
Engagement
      │
      ▼
Application
      │
      ▼
Admissions
      │
      ▼
Enrollment
      │
      ▼
Learning
```

---

## Example: Amplify with AI

**Program:** Amplify with AI

**Audiences (who should join):** Engineering Students · Founders · Creators · Professionals

**Campaigns (program-specific intents, not “Summer Campaign”):**

| Intent template | Example |
|---|---|
| Launch | Program announcement |
| Awareness | Campus / faculty reach |
| Registration | Early Bird |
| Reminder / Deadline | Final Call |
| Scholarship | Women in AI |
| Referral | Faculty Referral · Campus Ambassador |
| Event | Hackathon · Webinar · Open House |
| Social proof | Success Stories · Alumni · Employer · Placement |

Each campaign owns its Creative Projects and Marketing Assets.

---

## Studio workflow (never a blank canvas)

```text
Programs
   → Select Program
   → Program Growth / Marketing
   → Campaign
   → Creative Project
   → Generate Assets (Creative AI via Generation Profiles)
   → Publish (Channels → Connectors)
```

The marketer starts from the **Program**, not a generic canvas.

### Program Marketing Workspace (inside Marketing Studio)

```text
Program: Amplify with AI
  ├── Overview
  ├── Campaigns
  ├── Assets
  ├── Creatives
  ├── Audience
  ├── Channels
  ├── Applications
  └── Analytics
```

Studio is contextual to the Program.

---

## Creative AI under Program Growth

Instead of “Generate a LinkedIn post,” Studio knows:

| Context | Example |
|---|---|
| Program | Amplify with AI |
| Campaign | Deadline Reminder |
| Audience | Engineering Students |
| Tone | Urgent |
| CTA | Register Now |

Then generates a consistent set: Poster · Reel · LinkedIn · Instagram · WhatsApp · Email — via **Generation Profiles** (Studio intent) → **Creative AI** (Platform).

---

## Analytics (institutional language)

Not vanity metrics as the north star (CTR / likes / shares).

Program Growth intelligence:

- Program Awareness
- Applications
- Admissions
- Enrollments
- Cost per Enrollment
- Conversion by Institution / City / Campaign / Creative
- Top Performing Channel
- Most Effective Mentor / Referral Sources

Cross-program rollups live in the Marketing Brain; day-to-day work starts on the Program that needs growth.

---

## Brain vs Studio vs Platform (unchanged split)

| Layer | Program Growth role |
|---|---|
| **Brain (ATRISI Marketing)** | Cross-program intelligence, Timelines, Acquisition, outcomes |
| **Studio** | Program workspace → Campaigns → Assets → Publish / Generate |
| **Platform** | Connectors, Creative AI, Identity, Timeline, Knowledge |

Constitution still holds:

> Studio creates. Products operate. Platform remembers.

Acquisition Connectors (e.g. WhatsApp) feed **Person Timelines** that eventually attribute engagement back to **Program → Campaign → Creative**.

---

## Future vision

A university with Programs (MBA, BTech, Law, Nursing, AI Bootcamp, Executive MBA) automatically receives a **Program Marketing Workspace** each — campaigns, assets, analytics, applications, admissions — without manual suite setup.

That is tighter than a generic marketing suite because it matches the institution’s operating model.

---

## Naming

| Term | Use |
|---|---|
| **Program** | Primary object |
| **Program Growth** | Capability / internal product language |
| **Program Marketing** | Synonym when speaking to marketers |
| **ATRISI Marketing** | Current product brand for the Brain |
| **Marketing Studio** | Create/publish workspace (Program-scoped) |
| **Campaign** | Always under a Program; prefer intent templates |
| **Do not** | Sell as HubSpot / generic campaign CRM |

---

## Build implications (near term)

1. Ontology + docs: Program is primary (this document).
2. Marketing Studio preview: speak Program Growth, not blank canvas.
3. Acquisition: attribute events toward Program/Campaign when those objects exist.
4. Do **not** build a standalone “Campaigns” product island detached from Program.
5. Education Brain handoff points: Application → Admissions → Enrollment → Learning.
