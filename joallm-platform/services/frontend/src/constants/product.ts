/** User-facing platform brand (ATRISI Marketing). Package scopes may still use @joallm/*. */
import { ONTOLOGY } from './ontology';

export const PLATFORM_NAME = ONTOLOGY.product.name;
export const PLATFORM_SHORT_NAME = ONTOLOGY.product.shortName;
export const PLATFORM_TAGLINE = ONTOLOGY.product.tagline;
export const PLATFORM_CAPABILITY = ONTOLOGY.product.capability;

/** Constitutional: Studio creates. Products operate. Platform remembers. */
export const PLATFORM_CONSTITUTION = ONTOLOGY.constitution;

/**
 * User-facing product surface labels.
 * Keys may lag routes (e.g. workflows → Studio) for permission compatibility.
 */
export const PRODUCT_LABELS = {
  media: 'Media AI',
  chat: 'Chat',
  knowledge: 'Knowledge',
  models: 'Models',
  /** Studio directory / guided workspaces (not a generic workflow product) */
  workflows: 'Studio',
  notebooks: 'Notebooks',
  documentation: 'Documentation',
  acquisition: 'People & inbox',
  documentAi: 'Document AI',
  marketingStudio: 'Campaigns',
  story: 'Story',
} as const;

export const PRODUCT_DESCRIPTIONS = {
  media: 'Upload media, track analysis, and review Knowledge Artifacts',
  chat: 'Grounded conversations across institutional knowledge',
  knowledge: 'Documents, indexing, and retrieval for the Brain',
  models: 'Browse Platform model routing (BYOK-aware)',
  workflows: 'Guided Studio workspaces for create, review, and publish intent',
  notebooks: 'Advanced interactive sessions (Platform tooling)',
  documentation: 'Architecture notes and operator guides',
  acquisition: 'Shared inbox for WhatsApp, Messenger, Instagram, and Lead Ads',
  documentAi: 'Ingest document sets and launch grounded retrieval',
  marketingStudio: 'Programs, goals, campaigns, creatives, and publish',
  story: 'Compose a multi-medium narrative; propose storyline; export packs',
} as const;

export const PRODUCT_ROUTES = {
  media: '/studio/media-ai',
  chat: '/chat',
  knowledge: '/rag-search',
  models: '/farm',
  workflows: '/studio',
  notebooks: '/notebook',
  documentation: '/docs',
  acquisition: '/studio/people',
  documentAi: '/studio/document-ai',
  marketingStudio: '/studio/campaigns',
  story: '/studio/story',
} as const;
