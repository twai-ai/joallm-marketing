# Marketing Studio Direction

Status: **constitutional product direction**  
Last updated: 2026-07-21  
Parent: [Platform Constitution](./PLATFORM_CONSTITUTION.md)  
Sibling: [Knowledge Acquisition Direction](./KNOWLEDGE_ACQUISITION_DIRECTION.md)

## Principle

Marketing Studio is the **execution workspace** and **integration contract** between the Marketing Brain and external platforms — not merely an asset editor.

```text
                 ATRISI

        ┌──────────────────────┐
        │ Marketing Brain       │
        │ Strategy · Campaigns  │
        │ Intelligence · Timeline│
        └──────────┬────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │ Marketing Studio     │
        │ Assets · Channels    │
        │ Profiles · Jobs      │
        │ Approvals · Brand    │
        └──────────┬────────────┘
                   │  (publish intent)
                   ▼
        ┌──────────────────────┐
        │ Integration Platform │  ← Platform-owned
        │ Connectors · OAuth   │
        │ Secrets · Webhooks   │
        └──────────┬────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
   Meta API    LinkedIn API   Mailchimp API
```

Constitutional split:

> **Studio owns publishing intent. Platform owns execution capability.**

---

## Three-layer marketing architecture

| Layer | Questions | Owner |
|---|---|---|
| **Marketing Brain** | Why? Who? What are we learning? | ATRISI Marketing (product) |
| **Marketing Studio** | What are we creating? Where? Which channel/profile? What is scheduled? | Studio workspace |
| **Execution platforms** | Deliver ads, send email, optimize delivery | External vendors via Platform Connectors |

---

## Channel (business) vs Connector (technical)

```text
PublishingJob
      │
      ▼
Channel              ← Studio / domain (“LinkedIn Organic”)
      │
      ▼
Connector            ← Platform Integration (“LinkedIn UGC API”)
      │
      ▼
External API
```

Examples:

| Channel | Connector (may change) |
|---|---|
| Meta Ads | Meta Marketing API v23 |
| LinkedIn Organic | LinkedIn UGC API |
| LinkedIn Ads | LinkedIn Marketing API |
| WhatsApp | Meta WhatsApp Cloud API |
| Email | Mailchimp / Brevo API |

Studio UI lists Channels. It never surfaces Graph vs REST vs SDK details.

---

## Ownership

### Platform owns

* Connector registry, OAuth, Secrets, API clients, Webhooks
* Event normalization → AcquisitionEvents → Timeline
* Identity, Timeline, Knowledge, Memory, Evidence services

### Marketing Studio owns

* Channel, Publishing Profile, Publishing Job
* Marketing Asset, Creative, Template, Campaign Brief
* Approval, Brand Kit, Audience Segment (studio definitions)

### Marketing Brain owns

* Initiative, Campaign, Audience (operational), Goals
* Attribution, Intelligence, Recommendations
* Timeline / Evidence consumption (not storage forks)

---

## Studio Items (first-class entities)

```text
MarketingAsset
CampaignBrief
Creative
Template
AudienceSegment
PublishingProfile
Channel
PublishingJob
Approval
BrandKit
```

`MarketingAsset` remains the content object. It evolves alongside the list above — it is not the only Studio entity.

### Publishing Job

Durable execution request / audit trail — not a social media management product:

```text
Campaign:     Amplify with AI
Asset:        Video #12
Profile:      ATRISI Corporate
Channel:      LinkedIn Organic
Scheduled:    Tomorrow 10:00
Status:       Published
```

### Publishing Profile

Business-facing defaults so marketers pick a profile instead of reconfiguring destinations:

```text
Name:         ATRISI Corporate
Channel:      LinkedIn Organic
Organization: ATRISI
Defaults:     hashtags, branding, UTM, timezone
```

---

## Connector capability contract (Platform)

Every external platform implements the same conceptual interface:

```text
connect()
validate()
publish()
schedule()
fetchEvents()
fetchMetrics()
disconnect()
```

Connectors normalize only. No Brain logic inside adapters. Raw records remain immutable on the acquisition spine.

---

## Complete flow

```text
Strategy → Campaign → Studio Asset → Publishing Job
  → Publishing Profile → Channel → Platform Connector
  → Meta / LinkedIn / Mailchimp
  → Webhook → Platform Timeline → Marketing Brain → Knowledge Graph
```

**Marketing never talks directly to Meta.** It talks to Channels. Channels bind to Platform Connectors.

---

## Studio framework (future)

Marketing Studio is one implementation of a reusable Studio pattern:

```text
Assets · Approvals · Channels · Publishing Jobs · Profiles
        + Platform Integration (Connectors)
```

Later: Research Studio, Learning Studio, Communications Studio, Grant Proposal Studio — same Integration Platform, different domain Channels and intents.

---

## Build priority relative to Acquisition

Do **not** build full Marketing Studio before Timeline + KnowledgeArtifact dogfood.

| Phase | Focus |
|---|---|
| A–B | Person Timeline + KnowledgeArtifacts (shipped — dogfood) |
| C | Initiative / Campaign Brain surfaces |
| Studio-0 | Shared contracts: Channel, Connector, PublishingProfile, PublishingJob |
| Studio-1 | **Connector registry + WhatsApp Channel → Meta connector** (shipped) |
| Studio-2 | Publishing Jobs + asset publish path + more Channels |

Explicitly out of Studio / Marketing as owned builders: full social scheduler suite, CMS, email builder product islands. Publish through Channels; measure through Timeline.

---

## Shared types

Canonical TypeScript contracts:

* [`joallm-platform/shared/types/integration-platform.ts`](../../joallm-platform/shared/types/integration-platform.ts) — Connector (Platform)
* [`joallm-platform/shared/types/studio-publishing.ts`](../../joallm-platform/shared/types/studio-publishing.ts) — Channel, Profile, Job, Studio items
* [`joallm-platform/shared/types/knowledge-acquisition.ts`](../../joallm-platform/shared/types/knowledge-acquisition.ts) — Brain / Timeline / KnowledgeArtifact
