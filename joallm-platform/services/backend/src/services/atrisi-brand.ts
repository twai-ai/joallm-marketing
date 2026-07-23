/**
 * Canonical ATRISI institute brand for Story / Creative AI.
 * Mirrors ATRISI App.css `:root` “Professional Research Institute Colors”
 * and the live institutional UI (teal + slate-950 shell, Inter, light content bands).
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

/** Default Story Creative AI brand theme — applied on Brand + More visuals. */
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
    mood: 'premium research institute — trustworthy, calm authority; teal accents on deep slate-950',
    typography:
      'Inter-like geometric sans-serif only; bold high-contrast headlines; short supporting lines; never decorative script, never gothic, never handwritten',
    layout:
      'institutional marketing layout: generous whitespace, clear hierarchy, safe margins, optional navy or white content band; hero can use navy→blue 135deg gradient fields behind subject',
    imagery:
      'real institutional life — campus, researchers, learners, mentors; photoreal or clean editorial; not stock-ad clichés',
    density: 'sparse',
    notes:
      'ATRISI institute brand (App.css): teal #0F766E, navy #0F172A, blue #1E40AF, slate body #334155/#475569, ground #F1F5F9. Primary gradient navy→blue; light sections white/slate-50. No neon, purple glow, fuchsia/cyan cyberpunk flair, gold seals, or cluttered badge stacks. Amplify amber is out of scope for institute Story creatives.',
  },
};

/** Locked-copy typeface line injected when Story title is rendered on-image. */
export const ATRISI_EXACT_TYPE_DIRECTION =
  'Typeface: Inter-like geometric sans-serif, letter-perfect kerning, high contrast (navy #0F172A or white on dark), large readable headline — no script, no outline gimmicks, no extra labels.';
