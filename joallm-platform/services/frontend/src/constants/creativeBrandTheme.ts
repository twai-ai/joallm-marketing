/**
 * Frontend mirror of backend creative-brand-theme parser (keep shapes in sync).
 */

export type BrandThemeInput = {
  palette?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
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

export const BRAND_THEME_JSON_EXAMPLE = `{
  "palette": {
    "primary": "#0B2C5E",
    "secondary": "#C4A35A",
    "accent": "#F5F7FA"
  },
  "theme": {
    "mood": "premium institutional, trustworthy",
    "typography": "bold sans-serif headlines, clean supporting text",
    "layout": "minimal, generous whitespace, logo top-left",
    "imagery": "campus photography, diverse students"
  }
}`;

function normalizeHex(value?: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

export function parseBrandThemeJson(text: string): {
  theme: BrandThemeInput | null;
  error: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) return { theme: null, error: null };
  try {
    const raw = JSON.parse(trimmed) as BrandThemeInput;
    if (!raw || typeof raw !== 'object') {
      return { theme: null, error: 'Theme JSON must be an object' };
    }
    const colors: string[] = [];
    const p = raw.palette;
    if (p) {
      for (const key of ['primary', 'secondary', 'accent', 'background', 'text'] as const) {
        const hex = normalizeHex(p[key]);
        if (hex) colors.push(hex);
      }
      for (const c of p.colors || []) {
        const hex = normalizeHex(c);
        if (hex && !colors.includes(hex)) colors.push(hex);
      }
    }
    const hasTheme = Boolean(
      raw.theme &&
        Object.values(raw.theme).some((v) => typeof v === 'string' && v.trim().length > 0),
    );
    if (colors.length === 0 && !hasTheme) {
      return { theme: null, error: 'Add palette colors and/or theme fields' };
    }
    return { theme: raw, error: null };
  } catch {
    return { theme: null, error: 'Invalid JSON' };
  }
}
