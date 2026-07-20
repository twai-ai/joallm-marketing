export const PRODUCT_LABELS = {
  media: 'Media AI',
  chat: 'Chat',
  knowledge: 'Knowledge',
  models: 'Models',
  workflows: 'Studio',
  notebooks: 'Notebooks',
  documentation: 'Documentation',
} as const;

export const PRODUCT_DESCRIPTIONS = {
  media: 'Upload media, track analysis, and review structured insights',
  chat: 'AI conversations and grounded answers',
  knowledge: 'Documents, indexing, and retrieval',
  models: 'Browse available AI models',
  workflows: 'Build custom automations and advanced AI pipelines',
  notebooks: 'Interactive working sessions',
  documentation: 'Implementation notes and guides',
} as const;

export const PRODUCT_ROUTES = {
  media: '/studio/media-ai',
  chat: '/chat',
  knowledge: '/rag-search',
  models: '/farm',
  workflows: '/studio',
  notebooks: '/notebook',
  documentation: '/docs',
} as const;
