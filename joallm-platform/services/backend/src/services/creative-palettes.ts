/**
 * Brand palette type catalog for Creative AI (mirrors frontend constants/creativePalettes.ts).
 */

export type CreativePaletteTypeId =
  | 'auto'
  | 'atrisi_institute'
  | 'institutional_navy'
  | 'teal_modern'
  | 'forest'
  | 'burgundy';

export type CreativePaletteType = {
  id: CreativePaletteTypeId;
  label: string;
  colors: string[];
};

export const CREATIVE_PALETTE_TYPES: CreativePaletteType[] = [
  { id: 'auto', label: 'Auto', colors: [] },
  // Official ATRISI App.css / institutional UI (teal + navy + blue)
  {
    id: 'atrisi_institute',
    label: 'ATRISI institute',
    colors: ['#0F766E', '#0F172A', '#1E40AF', '#F1F5F9', '#FFFFFF'],
  },
  // Legacy generic institutional (kept for older Creative jobs)
  { id: 'institutional_navy', label: 'Institutional navy', colors: ['#0B2C5E', '#C4A35A', '#F5F7FA'] },
  { id: 'teal_modern', label: 'Teal modern', colors: ['#0F766E', '#334155', '#E2E8F0'] },
  { id: 'forest', label: 'Forest', colors: ['#1B4332', '#D8E2DC', '#F8F1E7'] },
  { id: 'burgundy', label: 'Burgundy', colors: ['#7A1F2B', '#E6D5B8', '#F7F3EE'] },
];

export function resolvePaletteColors(options: {
  paletteType?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}): string[] {
  const fromType = CREATIVE_PALETTE_TYPES.find((p) => p.id === options.paletteType);
  if (fromType && fromType.colors.length > 0) {
    return [...fromType.colors];
  }

  const normalize = (value?: string | null): string | null => {
    if (!value) return null;
    const raw = value.trim();
    const withHash = raw.startsWith('#') ? raw : `#${raw}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
    return withHash.toUpperCase();
  };

  return [
    normalize(options.primaryColor),
    normalize(options.secondaryColor),
    normalize(options.accentColor),
  ].filter(Boolean) as string[];
}
