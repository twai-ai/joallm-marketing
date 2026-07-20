# Creative AI Platform Direction

Status: **constitutional platform direction**  
Last updated: 2026-07-21  
Parent: [Platform Constitution](./PLATFORM_CONSTITUTION.md)  
Sibling: [Marketing Studio Direction](./MARKETING_STUDIO_DIRECTION.md)

## Principle

Creative media generation is a **Platform capability**, not a Marketing feature.

> **Studio owns creative intent. Platform owns generative capability.**

Studios never call OpenAI, Imagen, FLUX, Ideogram, Firefly, or Stability directly. They call the Creative AI service through **Generation Profiles**.

```text
Platform
│
├── Timeline
├── Identity
├── Knowledge
├── Integration
└── Creative AI
      │
      ├── Image Generation
      ├── Video Generation
      ├── Audio Generation
      ├── Voice
      ├── OCR
      ├── Background Removal
      ├── Upscaling
      └── Style Transfer
```

Consumers:

| Studio | Uses Creative AI for |
|---|---|
| Marketing Studio | Posters, ads, social cards, hero banners, brand variants |
| Learning Studio | Course illustrations, diagrams |
| Research Studio | Figures, conceptual diagrams |
| Grant Proposal Studio | Proposal graphics |
| Communications Studio | Announcements, institutional visuals |

---

## Generation Profile vs Provider

Do **not** expose providers first in Studio UI.

```text
Generate Image

Style
-------
Marketing Poster
Social Media
Product Mockup
Hero Banner
Illustration
Infographic

Quality
-------
Draft
Standard
Premium

Provider
--------
Auto (recommended)
OpenAI
Google
FLUX
Ideogram
Adobe
…
```

| Layer | Role |
|---|---|
| **Generation Profile** | Business intent: style + quality + brand constraints + Auto routing |
| **Image Generation Provider** | Technical backend: OpenAI GPT Image, Google Imagen, FLUX, Ideogram, Firefly, Stability |
| **Creative Job** | Durable request/response audit (prompt, profile, provider used, cost, outputs) |

When a vendor model changes, Profiles stay; Provider adapters change.

---

## Recommended image providers (v1 catalog)

| Provider | Best for | Role |
|---|---|---|
| **OpenAI GPT Image** | General creatives, editing, prompt adherence, text-in-image | Primary default |
| **Google Imagen** | Photorealism, product visuals, conversational editing | Primary alternative |
| **Black Forest Labs FLUX** | Realism, cost/performance, open/self-host path | Strong production option |
| **Ideogram** | Posters, banners, logos, typography | Must-have for marketing graphics |
| **Stability AI** | Self-host, fine-tune, enterprise control | Advanced / on-prem |
| **Adobe Firefly** | Brand-safe commercial + Creative Cloud shops | Enterprise marketing |

Auto routing examples (illustrative):

| Generation Profile style | Prefer |
|---|---|
| Marketing Poster / Infographic / logo-heavy | Ideogram |
| Product Mockup / photoreal people | Imagen or FLUX |
| Social Media / general marketing | OpenAI |
| Brand-safe enterprise default | Firefly (when connected) |
| High-volume draft | FLUX |

---

## Capability contract

Every image provider implements a subset of:

```text
generateImage()
editImage()
upscale()
removeBackground()
expandCanvas()
generateVariants()
```

The Creative AI service negotiates capabilities: if Ideogram lacks `removeBackground`, route that step to a provider that supports it (or a dedicated tool adapter).

Studios only call:

```text
CreativeAI.generate({ profileId | style, quality, prompt, brandKitId?, providerOverride? })
CreativeAI.edit({ … })
CreativeAI.upscale({ … })
…
```

---

## Ownership

### Platform owns

* Provider registry and adapters
* Secrets / API keys (**same Settings BYOK store** as chat — `users.api_keys`, encrypted)
* Auto router (style × quality × capability × cost × org policy)
* Rate limits, usage metering, safety filters
* Output storage hooks (files / media library)

BYOK resolution order per provider: user Settings key → platform env fallback. Free tier without custom keys uses platform defaults when configured.

Settings → **AI & Models** → Provider Keys (OpenAI shared with GPT Image) + **Creative AI providers** (Imagen, FLUX, Ideogram, Stability, Firefly).

### Studio owns

* Generation Profiles (named styles for that Studio)
* Brand Kit constraints passed into Creative AI
* Which generated assets become Marketing Assets / Creatives
* Approval of generated variants before publish

### Product (Brain) owns

* Whether / how generated assets appear in campaigns, attribution, and timelines  
  (publish still goes Channel → Connector; generation does not bypass the graph)

---

## Relationship to Marketing Studio

```text
Marketing Studio
       │
       ├── Generation Profile  →  Creative AI  →  providers
       │                              │
       │                              ▼
       │                         Asset / Creative
       │
       └── Publishing Job → Channel → Connector → Meta / LinkedIn / …
```

Marketing Studio is a **consumer** of Creative AI, not the owner of image APIs.

---

## Build priority

| Phase | Focus |
|---|---|
| Contracts | Shared types: GenerationProfile, ImageProvider, CreativeJob, capabilities |
| Creative-0 | Provider registry + OpenAI adapter (default) + Auto stub |
| Creative-1 | Ideogram + Imagen adapters; Marketing Poster / Social Media profiles |
| Creative-2 | FLUX, Firefly, Stability; edit / upscale / variants |
| Creative-3 | Video / audio / voice under same Creative AI umbrella |

Do not ship Marketing-only OpenAI hard-coding. Start with the abstraction even if v1 only wires one provider.

---

## Shared types

* [`joallm-platform/shared/types/creative-ai.ts`](../../joallm-platform/shared/types/creative-ai.ts)
* Constitution: [PLATFORM_CONSTITUTION.md](./PLATFORM_CONSTITUTION.md)
