/**
 * Canonical ATRISI institute brand for Story / Creative AI.
 * Mirrors ATRISI App.css `:root` “Professional Research Institute Colors”
 * and the live UI (teal + slate-950 institutional shell).
 */

import type { BrandThemeInput } from './creative-brand-theme.js';

/** Official CSS tokens (App.css) */
export const ATRISI_COLORS = {
  navy: '#0F172A',
  navyLight: '#1E293B',
  navyDark: '#020617',
  blue: '#1E40AF',
  blueLight: '#3B82F6',
  /** Teal accent — primary CTA / institute highlight */
  teal: '#0F766E',
  tealBright: '#14B8A6',
  slate: '#475569',
  slateLight: '#64748B',
  slateDark: '#334155',
  gray: '#F1F5F9',
  grayDark: '#E2E8F0',
  white: '#FFFFFF',
} as const;

/**
 * Ideogram / FLUX color_palette members (max useful set).
 * Order: teal accent → navy → blue → light ground.
 */
export const ATRISI_CREATIVE_PALETTE = [
  ATRISI_COLORS.teal,
  ATRISI_COLORS.navy,
  ATRISI_COLORS.blue,
  ATRISI_COLORS.gray,
  ATRISI_COLORS.white,
] as const;

/** Default Story Creative AI brand theme — applied unless a story brand kit overrides look. */
export const ATRISI_INSTITUTE_BRAND_THEME: BrandThemeInput = {
  palette: {
    primary: ATRISI_COLORS.teal,
    secondary: ATRISI_COLORS.navy,
    accent: ATRISI_COLORS.blue,
    background: ATRISI_COLORS.gray,
    text: ATRISI_COLORS.navy,
    colors: [...ATRISI_CREATIVE_PALETTE],
  },
  theme: {
    mood: 'premium research institute — trustworthy, calm authority, teal on deep slate',
    typography: 'clean Inter-like sans-serif; bold high-contrast headlines when copy is provided',
    layout: 'minimal, generous whitespace, clear hierarchy, balanced margins',
    imagery: 'real institutional life — campus, researchers, learners, mentors; not stock-ad clichés',
    density: 'sparse',
    notes:
      'ATRISI institute brand: teal (#0F766E) + navy (#0F172A) + blue (#1E40AF). No neon, no purple glow, no fuchsia/cyan cyberpunk flair, no gold seals, no cluttered badge stacks.',
  },
};
