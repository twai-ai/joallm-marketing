/**
 * Canonical ATRISI Program catalog for the Program aggregate.
 * Source of truth (public): https://atrisi.org/programs
 *
 * Growth / Admissions / Learning are capabilities under Program —
 * not separate product roots.
 */

export type ProgramFamily = 'academic' | 'institutional_career' | 'enterprise';

export type ProgramDefinition = {
  id: string;
  name: string;
  family: ProgramFamily;
  familyLabel: string;
  tagline: string;
  summary: string;
  audiences: string[];
  tracks?: string[];
  bestFor: string[];
  /** Public program page on atrisi.org when known */
  publicPath?: string;
};

/**
 * Three program buckets. One systems mindset.
 * @see https://atrisi.org/programs
 */
export const ATRISI_PROGRAMS: ProgramDefinition[] = [
  {
    id: 'resonance-with-ai',
    name: 'Resonance with AI',
    family: 'academic',
    familyLabel: 'Academic · Faculty',
    tagline: 'From AI Awareness to AI-Native Thinking',
    summary:
      'Faculty workshops around teaching, research, assessment, and curriculum — Practice and Mentor tracks.',
    audiences: ['Faculty', 'Faculty Development Programs', 'Research Institutions'],
    tracks: ['Applied Intelligence · Practice Track', 'AI-Native Capability · Mentor Track'],
    bestFor: ['Universities', 'Faculty Development Programs', 'Research Institutions'],
    publicPath: '/programs',
  },
  {
    id: 'amplify-with-ai',
    name: 'Amplify with AI',
    family: 'academic',
    familyLabel: 'Academic · Student',
    tagline: 'From AI usage to AI-Native Capability and Applied Intelligence',
    summary:
      'Student workshops from AI literacy to intelligent-system capstones — Builder and Domain tracks.',
    audiences: [
      'Engineering students',
      'Other student streams',
      'Innovation Cells',
      'Final-year cohorts',
      'Technical & domain clubs',
    ],
    tracks: ['AI-Native Capability · Builder Track', 'Applied Intelligence · Domain Track'],
    bestFor: ['Engineering + all other student streams', 'Innovation Cells', 'Final-year cohorts'],
    publicPath: '/programs',
  },
  {
    id: 'campus-to-career',
    name: 'Campus-to-Career AI Transformation',
    family: 'institutional_career',
    familyLabel: 'Institutional Career',
    tagline: 'One-year final-year engineering pathway',
    summary:
      'College-facing pathway for employability, portfolio evidence, placement readiness, and institutional intelligence.',
    audiences: ['Final-year engineering cohorts', 'TPOs', 'Departments', 'Innovation cells'],
    bestFor: [
      'Engineering colleges',
      'Universities',
      'TPOs',
      'Final-year departments',
      'Innovation cells',
    ],
    publicPath: '/programs',
  },
  {
    id: 'ai-native-systems-engineering',
    name: 'AI Native Systems Engineering',
    family: 'enterprise',
    familyLabel: 'Enterprise',
    tagline: 'From AI Adoption to Organizational Intelligence Systems',
    summary:
      'Corporate pilots for workflow intelligence, agents, knowledge systems, and organizational memory.',
    audiences: ['CTO Offices', 'CIO Teams', 'Engineering', 'Data', 'Product', 'Transformation Heads'],
    bestFor: ['Enterprises running JoaLLM-backed pilots and academies'],
    publicPath: '/programs',
  },
  {
    id: 'resilient-systems',
    name: 'Resilient Systems',
    family: 'enterprise',
    familyLabel: 'Enterprise · Resilience',
    tagline: 'From Security to Systemic Resilience',
    summary:
      'Infrastructure resilience for smart cities, critical systems, and decentralized security.',
    audiences: [
      'Government',
      'Infrastructure Operators',
      'Cybersecurity Teams',
      'Engineering Institutions',
    ],
    bestFor: ['Government', 'Infrastructure Operators', 'Cybersecurity Teams'],
    publicPath: '/programs',
  },
];

export const PROGRAM_FAMILIES: { id: ProgramFamily; label: string }[] = [
  { id: 'academic', label: 'Academic' },
  { id: 'institutional_career', label: 'Institutional Career' },
  { id: 'enterprise', label: 'Enterprise' },
];

export function getProgramById(id: string): ProgramDefinition | undefined {
  return ATRISI_PROGRAMS.find((program) => program.id === id);
}

/** Dogfood Program for first Growth campaigns */
export const PRIMARY_GROWTH_PROGRAM = getProgramById('amplify-with-ai')!;

/**
 * When atrisi.org adds programs, update ATRISI_PROGRAMS here (or a future
 * catalog sync). This list is campaign/ad targeting context only — not SoR.
 * Education continues to load full program/job defs from atrisi.org.
 */
export const PROGRAM_CATALOG_NOTE =
  'Targeting catalog mirrors atrisi.org/programs; grows as new Programs are published.';

