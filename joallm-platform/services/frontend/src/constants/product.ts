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
  acquisition: 'Acquisition Intelligence',
  documentAi: 'Document AI',
  marketingStudio: 'Acquisition',
} as const;

export const PRODUCT_DESCRIPTIONS = {
  media: 'Upload media, track analysis, and review Knowledge Artifacts',
  chat: 'Grounded conversations across institutional knowledge',
  knowledge: 'Documents, indexing, and retrieval for the Brain',
  models: 'Browse Platform model routing (BYOK-aware)',
  workflows: 'Guided Studio workspaces for create, review, and publish intent',
  notebooks: 'Advanced interactive sessions (Platform tooling)',
  documentation: 'Architecture notes and operator guides',
  acquisition: 'Connect Channels into Person Timelines (toward Program Growth)',
  documentAi: 'Ingest document sets and launch grounded retrieval',
  marketingStudio: 'Acquisition Workspace — Programs → Intents → Campaigns → Program Interest',
} as const;

export const PRODUCT_ROUTES = {
  media: '/studio/media-ai',
  chat: '/chat',
  knowledge: '/rag-search',
  models: '/farm',
  workflows: '/studio',
  notebooks: '/notebook',
  documentation: '/docs',
  acquisition: '/studio/acquisition',
  documentAi: '/studio/document-ai',
  marketingStudio: '/studio/marketing',
} as const;
