/**
 * Brand palette types for Creative AI.
 * Pick a type id in the UI — hex values resolve from this catalog.
 */

export type CreativePaletteTypeId =
  | 'auto'
  | 'institutional_navy'
  | 'teal_modern'
  | 'forest'
  | 'burgundy';

export type CreativePaletteType = {
  id: CreativePaletteTypeId;
  label: string;
  hint: string;
  /** Empty for auto — vision / provider may infer */
  colors: string[];
};

export const CREATIVE_PALETTE_TYPES: CreativePaletteType[] = [
  {
    id: 'auto',
    label: 'Auto',
    hint: 'Infer from references when available',
    colors: [],
  },
  {
    id: 'institutional_navy',
    label: 'Institutional navy',
    hint: 'Classic education brand',
    colors: ['#0B2C5E', '#C4A35A', '#F5F7FA'],
  },
  {
    id: 'teal_modern',
    label: 'Teal modern',
    hint: 'Clean digital / WhatsApp',
    colors: ['#0F766E', '#334155', '#E2E8F0'],
  },
  {
    id: 'forest',
    label: 'Forest',
    hint: 'Warm campus / sustainability',
    colors: ['#1B4332', '#D8E2DC', '#F8F1E7'],
  },
  {
    id: 'burgundy',
    label: 'Burgundy',
    hint: 'Heritage / premium print',
    colors: ['#7A1F2B', '#E6D5B8', '#F7F3EE'],
  },
];

export function getPaletteType(id: string | null | undefined): CreativePaletteType {
  return (
    CREATIVE_PALETTE_TYPES.find((p) => p.id === id) ||
    CREATIVE_PALETTE_TYPES[0]
  );
}
