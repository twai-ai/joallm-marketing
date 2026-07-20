# Media AI Roadmap And Journal

Last updated: 2026-04-02

## Purpose

This document captures the Media AI product and backend direction that has emerged during the current implementation cycle.

It serves two purposes:
- a roadmap for what we want Media AI to become
- a journal of important design decisions so the team does not lose context later

The guiding principle is:
- keep the current product vertical-specific and guided
- defer enterprise-grade generalization until the reusable AI workflow template system is mature

## Current Product Position

Media AI is now treated as:
- a guided vertical inside `Studio`
- focused on `Overview`, `Runs`, `Results`, and `Settings`
- optimized for ingesting media, generating timeline-aware insights, and turning results into usable outputs

**Architectural convergence:** Media AI feeds the **Timeline Service** via Knowledge Interpretation (`KnowledgeArtifact`). Call/Zoom/Meet/WhatsApp voice/webinar outputs enrich Person (and later Initiative) timelines — not a separate product island. Build order: Timeline Service (Phase A) → KnowledgeArtifact linkage (Phase B). See [Knowledge Acquisition Direction](./KNOWLEDGE_ACQUISITION_DIRECTION.md).

The current surface intentionally avoids:
- graph-first workflow composition
- generic workflow-canvas UX as the primary user entry point
- overexposing custom automation before the vertical patterns are proven

## What Exists Today

### Media Analysis
- transcription pipeline with chunking for long-form media
- frame analysis for video
- combined audio + visual insight generation
- long-form batching for insight generation
- improved prompt payloads with preprocessing and postprocessing
- chaptered, moment-based, and clip-ready results

### Results UX
- guided results experience instead of a canvas-first screen
- timeline-aware chapters, moments, clips, topics, and actions
- export helpers for transcript and summary artifacts
- Knowledge sync status surfaced in the UI
- speaker labels are now treated as a first-class enrichment path in the media pipeline

### Knowledge Integration
- media-derived knowledge chunks written back into `document_chunks`
- staged sync model:
  - `Syncing to Knowledge`
  - `Generating embeddings`
- vector-retrieval readiness represented separately from media-analysis readiness

### Clip MVP
- clip suggestions in Results
- `Create clip` action from Results
- rendered clip persisted into the same storage system as source media
- clip metadata stored in the database via render outputs and edit plans

## Key Product Decisions

### 1. Studio is the umbrella, not the canvas

The intended product model is:
- `Studio` = umbrella workspace
- `Media AI` = active vertical today
- future verticals = `Docs AI`, `DICOM AI`, `Research AI`

The canvas/custom workflow model is intentionally not the primary user experience right now.

### 2. Media results must be operational, not only descriptive

Media results should support:
- scanning
- jumping to exact moments
- clipping
- exporting
- syncing back into Knowledge for RAG

This means timestamps are first-class product data, not incidental metadata.

### 3. Knowledge readiness must be staged

A media file may be:
- ready for analysis review
- not yet fully ready for vector retrieval

The UI and backend should preserve that distinction.

## Deferred Enterprise-Grade Enhancements

These ideas are valuable, but they are intentionally not treated as immediate product requirements.

### Clip Intelligence As A Knowledge Layer

Target future model:
- clip binary stored in the same bucket/storage layer as media
- clip metadata stored in the database
- clip-specific embeddings and Knowledge chunks added for retrieval

Deferred because:
- current user value is unlocked by direct clip creation first
- full clip-level retrieval is more enterprise/library-scale

### Full Workflow Family Generalization

Target future model:
- reusable workflow-family registry
- family-specific workspaces and result contracts
- generalized AI workflow templates across multiple verticals

Deferred because:
- Media AI is the proving ground
- generalization should follow multiple mature verticals, not precede them

### Advanced Media Creator Stack

Examples:
- inline clip-range editing
- caption burn-in
- aspect-ratio variants for reels/shorts
- vertical reframe
- clip management workspace

Deferred because:
- current MVP is clip creation from results
- advanced creator tooling can be layered after the clip path is stable

### Enterprise Media Retrieval Layer

Examples:
- clip search across libraries
- speaker-aware media retrieval
- cross-asset search across media and documents
- advanced RAG over transcript windows, chapters, and clips

Deferred because:
- this is a strong long-term differentiator
- it should build on the current Knowledge sync foundation

## Media Inference Architecture Direction

The current direction for better insight quality is:

### Preprocessing
- normalize transcript windows
- align transcript and frame-analysis events
- infer media type heuristically
- extract candidate moments
- construct structured prompt payloads

### Inference
- use a stronger media-specific system prompt
- send structured payloads instead of primitive transcript dumps
- keep long-form batching
- later add a second-pass synthesis prompt for global cohesion

### Postprocessing
- validate and snap timestamps to real segment boundaries
- dedupe overlapping moments
- normalize tags and topics
- filter weak unsupported action items
- preserve clip-worthiness and downstream usability

This architecture is preferred over a pure “prompt tweak” approach.

## Speaker Intelligence Direction

Speaker intelligence is a foundational media-quality layer, not just optional transcript metadata.

### Why it matters
- attribute quotes to the right speaker
- improve action-item ownership
- improve long-form interview, meeting, and podcast summaries
- improve clip suggestions by keeping moments tied to a voice or turn
- support future speaker-aware retrieval in Knowledge

### Current implementation direction
- keep audio transcription as the primary ASR layer
- run a speaker-enrichment pass immediately after transcription and before transcript persistence
- preserve speaker labels on `transcript_segments`
- feed speaker-aware timeline entries into media insight generation

### Current speaker-label modes
- `provided`
  - use provider-supplied speaker labels directly when available
- `heuristic_dialogue`
  - infer turn-taking for clearly conversational content
- `single_speaker_default`
  - preserve single-speaker attribution structure when dialogue cannot be established confidently

### Future direction
- real audio diarization provider integration
- explicit `speaker_turns` persistence
- role inference such as `Host`, `Guest`, `Presenter`, `Interviewer`
- vision-assisted speaker-role enrichment
- speaker-aware retrieval and clip search

## Future RAG Direction For Media

The preferred long-term model is hybrid:
- batching for reliability and coverage
- retrieval for precision and targeted insight generation

For long-form media:
1. split into windows
2. generate local summaries and candidate moments
3. embed window-level and insight-level summaries
4. retrieve best windows for targeted tasks
5. synthesize final outputs

This is better than:
- only one huge prompt
- or pure retrieval without narrative coverage

## Roadmap Phases

### Phase 1
- improve long-form media results
- chapters
- moments
- clips
- action items
- better Media AI results UX

Status:
- substantially implemented

### Phase 2
- topic cloud
- timeline navigation
- exports

Status:
- substantially implemented

### Phase 3
- Knowledge sync from media insights
- staged readiness for RAG

Status:
- implemented at a foundational level

### Phase 4
- stronger media prompting with preprocessing/postprocessing
- mode-aware media inference refinement

Status:
- first backend pass implemented
- second-pass synthesis still pending

### Phase 5
- clip creation from Results
- derived render outputs stored in media storage

Status:
- MVP implemented

### Phase 6
- enterprise-grade retrieval and creator enhancements

Examples:
- clip embeddings
- clip search
- inline range editing
- caption workflows
- speaker-aware retrieval
- cross-asset media + docs RAG

Status:
- intentionally deferred

### Phase 7
- real audio speaker diarization
- explicit speaker-turn persistence
- role inference over speaker turns
- speaker-aware summaries, action items, clips, and retrieval

Status:
- foundation implemented
- provider-backed diarization still pending

## Journal Notes

### Journal Entry: Guided verticals over generic workflows

Decision:
- the product should be oriented around vertical workspaces, not a generic workflow canvas

Reason:
- most users want outcomes, not node graphs
- the canvas is an advanced implementation detail today

### Journal Entry: Media first, generalize later

Decision:
- keep Media AI as the active vertical and treat others as placeholders until patterns are proven

Reason:
- avoids premature abstraction
- preserves UX clarity

### Journal Entry: Results must stay timeline-native

Decision:
- every meaningful media insight should remain grounded in time ranges whenever possible

Reason:
- timelines are required for clip creation, trust, and downstream usability

### Journal Entry: Knowledge sync is not the same as analysis readiness

Decision:
- separate “analysis is ready” from “vector retrieval is ready”

Reason:
- the user should be able to consume results before embeddings finish
- collapsing both into one “indexing” state is misleading

### Journal Entry: Clip intelligence is a future enhancement

Decision:
- current clip implementation stores clip assets and clip metadata, but not clip-level embeddings

Reason:
- that is a strong enterprise/media-library feature, but not required for the first user-facing clip workflow

## Recommended Next Steps

Near-term:
- refine the Media AI route model so it no longer leaks old custom-workflow paths
- add second-pass synthesis for long-form media insights
- add `Edit range` on clip cards before creation

Later:
- clip-level Knowledge chunks and embeddings
- richer creator pipeline
- generalized vertical framework after at least one or two more verticals are mature
