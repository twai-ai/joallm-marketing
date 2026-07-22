/**
 * Frontend mirror of backend creative-brand-theme parser (keep shapes in sync).
 */

import {
  getPaletteType,
  type CreativePaletteTypeId,
} from './creativePalettes';

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

export type BrandThemeFormState = {
  paletteMode: 'preset' | 'custom';
  paletteType: CreativePaletteTypeId;
  customPrimary: string;
  customSecondary: string;
  customAccent: string;
  customBackground: string;
  mood: string;
  typography: string;
  layout: string;
  imagery: string;
  density: string;
};

export const DEFAULT_BRAND_THEME_FORM: BrandThemeFormState = {
  paletteMode: 'preset',
  paletteType: 'institutional_navy',
  customPrimary: '',
  customSecondary: '',
  customAccent: '',
  customBackground: '',
  mood: 'premium institutional, trustworthy',
  typography: 'bold sans-serif headlines, clean supporting text',
  layout: 'minimal, generous whitespace, logo top-left',
  imagery: 'campus photography, diverse students',
  density: 'sparse',
};

export const THEME_STYLE_PRESETS: Array<{
  id: string;
  label: string;
  patch: Partial<Pick<BrandThemeFormState, 'mood' | 'typography' | 'layout' | 'imagery' | 'density'>>;
}> = [
  {
    id: 'institutional',
    label: 'Institutional premium',
    patch: {
      mood: DEFAULT_BRAND_THEME_FORM.mood,
      typography: DEFAULT_BRAND_THEME_FORM.typography,
      layout: DEFAULT_BRAND_THEME_FORM.layout,
      imagery: DEFAULT_BRAND_THEME_FORM.imagery,
      density: DEFAULT_BRAND_THEME_FORM.density,
    },
  },
  {
    id: 'digital',
    label: 'Digital / WhatsApp',
    patch: {
      mood: 'modern, clean, high contrast',
      typography: 'bold geometric sans-serif, short copy',
      layout: 'mobile-first, safe margins, clear CTA button',
      imagery: 'abstract shapes, subtle campus cues',
      density: 'sparse',
    },
  },
  {
    id: 'warm',
    label: 'Warm campus',
    patch: {
      mood: 'welcoming, optimistic, community',
      typography: 'friendly rounded sans-serif',
      layout: 'photo-led, text band at bottom',
      imagery: 'students on campus, natural light',
      density: 'balanced',
    },
  },
];

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

export function brandThemeToJson(theme: BrandThemeInput): string {
  return JSON.stringify(theme, null, 2);
}

/** Build API brandTheme from the optimized-generation form (preferred over raw JSON). */
export function buildBrandThemeFromForm(
  form: BrandThemeFormState,
  options?: { useOptimized?: boolean },
): { brandTheme?: BrandThemeInput; paletteType: CreativePaletteTypeId; error?: string } {
  if (options?.useOptimized === false) {
    return { paletteType: form.paletteType };
  }

  const palette: NonNullable<BrandThemeInput['palette']> = {};
  let hasPalette = false;

  if (form.paletteMode === 'custom') {
    const primary = normalizeHex(form.customPrimary);
    const secondary = normalizeHex(form.customSecondary);
    const accent = normalizeHex(form.customAccent);
    const background = normalizeHex(form.customBackground);
    if (primary) {
      palette.primary = primary;
      hasPalette = true;
    }
    if (secondary) {
      palette.secondary = secondary;
      hasPalette = true;
    }
    if (accent) {
      palette.accent = accent;
      hasPalette = true;
    }
    if (background) {
      palette.background = background;
      hasPalette = true;
    }
  } else if (form.paletteType !== 'auto') {
    const preset = getPaletteType(form.paletteType);
    if (preset.colors[0]) palette.primary = preset.colors[0];
    if (preset.colors[1]) palette.secondary = preset.colors[1];
    if (preset.colors[2]) palette.accent = preset.colors[2];
    hasPalette = preset.colors.length > 0;
  }

  const theme: NonNullable<BrandThemeInput['theme']> = {};
  let hasTheme = false;
  const assign = (key: keyof NonNullable<BrandThemeInput['theme']>, value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      theme[key] = trimmed;
      hasTheme = true;
    }
  };
  assign('mood', form.mood);
  assign('typography', form.typography);
  assign('layout', form.layout);
  assign('imagery', form.imagery);
  assign('density', form.density);

  if (!hasPalette && !hasTheme) {
    return { paletteType: form.paletteType };
  }

  return {
    brandTheme: {
      palette: hasPalette ? palette : undefined,
      theme: hasTheme ? theme : undefined,
    },
    paletteType: 'auto',
  };
}

export function formFromBrandTheme(theme: BrandThemeInput): BrandThemeFormState {
  const next = { ...DEFAULT_BRAND_THEME_FORM };
  const p = theme.palette;
  if (p?.primary || p?.secondary || p?.accent) {
    next.paletteMode = 'custom';
    next.customPrimary = p.primary || '';
    next.customSecondary = p.secondary || '';
    next.customAccent = p.accent || '';
    next.customBackground = p.background || '';
  }
  const t = theme.theme;
  if (t?.mood) next.mood = t.mood;
  if (t?.typography) next.typography = t.typography;
  if (t?.layout) next.layout = t.layout;
  if (t?.imagery) next.imagery = t.imagery;
  if (t?.density) next.density = t.density;
  return next;
}
