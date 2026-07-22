/**
 * Parse program / institution brand theme JSON for Creative AI.
 *
 * Example:
 * {
 *   "palette": { "primary": "#0B2C5E", "secondary": "#C4A35A", "accent": "#F5F7FA" },
 *   "theme": {
 *     "mood": "premium institutional",
 *     "typography": "bold sans-serif headlines",
 *     "layout": "minimal, generous whitespace",
 *     "imagery": "campus, diverse students"
 *   }
 * }
 */

export type BrandThemeInput = {
  palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    /** Extra brand colors in order */
    colors?: string[];
  };
  theme?: {
    mood?: string;
    typography?: string;
    layout?: string;
    imagery?: string;
    density?: string;
    notes?: string;
  };
};

export type ParsedBrandTheme = {
  colors: string[];
  promptLines: string[];
};

function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function parseBrandTheme(input?: BrandThemeInput | null): ParsedBrandTheme | null {
  if (!input) return null;

  const colors: string[] = [];
  const add = (value?: string | null) => {
    const hex = normalizeHex(value);
    if (hex && !colors.includes(hex)) colors.push(hex);
  };

  const p = input.palette;
  if (p) {
    add(p.primary);
    add(p.secondary);
    add(p.accent);
    add(p.background);
    add(p.text);
    for (const c of p.colors || []) add(c);
  }

  const promptLines: string[] = [];
  const t = input.theme;
  if (t?.mood?.trim()) promptLines.push(`Brand mood: ${t.mood.trim()}.`);
  if (t?.typography?.trim()) promptLines.push(`Typography feel: ${t.typography.trim()}.`);
  if (t?.layout?.trim()) promptLines.push(`Layout: ${t.layout.trim()}.`);
  if (t?.imagery?.trim()) promptLines.push(`Imagery style: ${t.imagery.trim()}.`);
  if (t?.density?.trim()) promptLines.push(`Visual density: ${t.density.trim()}.`);
  if (t?.notes?.trim()) promptLines.push(t.notes.trim().endsWith('.') ? t.notes.trim() : `${t.notes.trim()}.`);

  if (colors.length === 0 && promptLines.length === 0) return null;
  return { colors: colors.slice(0, 5), promptLines };
}
