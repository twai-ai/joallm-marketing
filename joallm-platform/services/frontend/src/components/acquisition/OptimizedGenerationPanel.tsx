import { useMemo, useState } from 'react';
import { ChevronDown, Sparkles, Wand2 } from 'lucide-react';
import type { ImageGenerationQuality } from '@joallm/shared';
import {
  CREATIVE_PALETTE_TYPES,
  getPaletteType,
  type CreativePaletteTypeId,
} from '../../constants/creativePalettes';
import {
  BRAND_THEME_JSON_EXAMPLE,
  DEFAULT_BRAND_THEME_FORM,
  THEME_STYLE_PRESETS,
  brandThemeToJson,
  buildBrandThemeFromForm,
  formFromBrandTheme,
  parseBrandThemeJson,
  type BrandThemeFormState,
} from '../../constants/creativeBrandTheme';

type ProviderChoice = 'auto' | 'ideogram' | 'flux';

const QUALITY_OPTIONS: { value: ImageGenerationQuality; label: string }[] = [
  { value: 'draft', label: 'Draft (fast)' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium (max res)' },
];

export type OptimizedGenerationPanelProps = {
  programName: string;
  headline: string;
  cta: string;
  onHeadlineChange: (value: string) => void;
  onCtaChange: (value: string) => void;
  onPrefillFromProgram: () => void;
  brandForm: BrandThemeFormState;
  onBrandFormChange: (patch: Partial<BrandThemeFormState>) => void;
  optimizedEnabled: boolean;
  onOptimizedEnabledChange: (enabled: boolean) => void;
  advancedJson: string;
  onAdvancedJsonChange: (value: string) => void;
  brandThemeError: string | null;
  onBrandThemeErrorChange: (error: string | null) => void;
  quality: ImageGenerationQuality;
  onQualityChange: (value: ImageGenerationQuality) => void;
  provider: ProviderChoice;
  onProviderChange: (value: ProviderChoice) => void;
  variantCount: number;
  onVariantCountChange: (value: number) => void;
  onApplyOptimizedDefaults: () => void;
};

function ColorSwatch({ color, label }: { color: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
      <span className="h-3.5 w-3.5 rounded-full ring-1 ring-slate-200" style={{ background: color }} />
      {label || color}
    </span>
  );
}

function ThemeField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-400"
        placeholder={placeholder}
      />
    </label>
  );
}

export function OptimizedGenerationPanel({
  programName,
  headline,
  cta,
  onHeadlineChange,
  onCtaChange,
  onPrefillFromProgram,
  brandForm,
  onBrandFormChange,
  optimizedEnabled,
  onOptimizedEnabledChange,
  advancedJson,
  onAdvancedJsonChange,
  brandThemeError,
  onBrandThemeErrorChange,
  quality,
  onQualityChange,
  provider,
  onProviderChange,
  variantCount,
  onVariantCountChange,
  onApplyOptimizedDefaults,
}: OptimizedGenerationPanelProps) {
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);

  const resolvedPreview = useMemo(() => {
    if (advancedJson.trim() && showAdvancedJson) {
      const parsed = parseBrandThemeJson(advancedJson);
      if (parsed.theme) {
        return { brandTheme: parsed.theme, paletteType: 'auto' as CreativePaletteTypeId };
      }
    }
    return buildBrandThemeFromForm(brandForm, { useOptimized: optimizedEnabled });
  }, [advancedJson, brandForm, optimizedEnabled, showAdvancedJson]);

  const previewColors = useMemo(() => {
    const palette = resolvedPreview.brandTheme?.palette;
    if (palette) {
      const colors = [
        palette.primary,
        palette.secondary,
        palette.accent,
        palette.background,
      ].filter(Boolean) as string[];
      if (colors.length) return colors;
    }
    if (!optimizedEnabled || brandForm.paletteMode === 'custom') return [];
    return getPaletteType(brandForm.paletteType).colors;
  }, [brandForm.paletteMode, brandForm.paletteType, optimizedEnabled, resolvedPreview]);

  const syncJsonFromForm = () => {
    const built = buildBrandThemeFromForm(brandForm, { useOptimized: optimizedEnabled });
    if (built.brandTheme) {
      onAdvancedJsonChange(brandThemeToJson(built.brandTheme));
      onBrandThemeErrorChange(null);
    }
  };

  const importJsonToForm = () => {
    const parsed = parseBrandThemeJson(advancedJson);
    if (parsed.error || !parsed.theme) {
      onBrandThemeErrorChange(parsed.error || 'Invalid JSON');
      return;
    }
    onBrandFormChange(formFromBrandTheme(parsed.theme));
    onBrandThemeErrorChange(null);
  };

  return (
    <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50/80 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <Wand2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">Optimized generation</h3>
            <p className="mt-0.5 max-w-xl text-xs leading-5 text-slate-600">
              Structured brand kit for sharper flyers — exact copy, palette, theme, and engine
              settings sent to the prompt enhancer and Ideogram.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs font-medium text-teal-900">
            <input
              type="checkbox"
              checked={optimizedEnabled}
              onChange={(e) => onOptimizedEnabledChange(e.target.checked)}
              className="rounded border-slate-300 text-teal-600"
            />
            Use brand kit
          </label>
          <button
            type="button"
            onClick={onApplyOptimizedDefaults}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Apply recommended
          </button>
        </div>
      </div>

      {optimizedEnabled && (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-teal-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              1 · Exact copy
            </p>
            <button
              type="button"
              onClick={onPrefillFromProgram}
              className="text-[11px] font-medium text-teal-800 hover:underline"
            >
              Prefill from {programName}
            </button>
          </div>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">Headline (exact)</span>
              <input
                value={headline}
                onChange={(e) => onHeadlineChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                placeholder={programName}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-slate-600">CTA (exact)</span>
              <input
                value={cta}
                onChange={(e) => onCtaChange(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
                placeholder="Apply now"
              />
            </label>
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            2 · Brand palette
          </p>
          <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-white p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => onBrandFormChange({ paletteMode: 'preset' })}
              className={`rounded-full px-3 py-1.5 ${
                brandForm.paletteMode === 'preset' ? 'bg-teal-600 text-white' : 'text-slate-600'
              }`}
            >
              Preset catalog
            </button>
            <button
              type="button"
              onClick={() => onBrandFormChange({ paletteMode: 'custom' })}
              className={`rounded-full px-3 py-1.5 ${
                brandForm.paletteMode === 'custom' ? 'bg-teal-600 text-white' : 'text-slate-600'
              }`}
            >
              Custom colors
            </button>
          </div>

          {brandForm.paletteMode === 'preset' ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CREATIVE_PALETTE_TYPES.filter((p) => p.id !== 'auto').map((palette) => {
                const selected = brandForm.paletteType === palette.id;
                return (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() => onBrandFormChange({ paletteType: palette.id })}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? 'border-teal-500 bg-white ring-2 ring-teal-200'
                        : 'border-slate-200 bg-white hover:border-teal-300'
                    }`}
                  >
                    <span className="text-xs font-semibold text-slate-900">{palette.label}</span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="inline-flex overflow-hidden rounded-full ring-1 ring-slate-200">
                        {palette.colors.map((color) => (
                          <span
                            key={color}
                            className="h-3.5 w-3.5"
                            style={{ background: color }}
                            title={color}
                          />
                        ))}
                      </span>
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-500">{palette.hint}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['customPrimary', 'Primary', '#0B2C5E'],
                  ['customSecondary', 'Secondary', '#C4A35A'],
                  ['customAccent', 'Accent', '#F5F7FA'],
                  ['customBackground', 'Background', '#FFFFFF'],
                ] as const
              ).map(([key, label, placeholder]) => (
                <label key={key} className="block text-sm">
                  <span className="text-xs font-medium text-slate-600">{label}</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="color"
                      value={
                        brandForm[key].trim().startsWith('#')
                          ? brandForm[key]
                          : placeholder
                      }
                      onChange={(e) => onBrandFormChange({ [key]: e.target.value })}
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white"
                    />
                    <input
                      value={brandForm[key]}
                      onChange={(e) => onBrandFormChange({ [key]: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-teal-400"
                      placeholder={placeholder}
                    />
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              3 · Visual theme
            </p>
            <div className="flex flex-wrap gap-1.5">
              {THEME_STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onBrandFormChange(preset.patch)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 hover:border-teal-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <ThemeField
              label="Mood"
              value={brandForm.mood}
              onChange={(mood) => onBrandFormChange({ mood })}
              placeholder="premium institutional, trustworthy"
            />
            <ThemeField
              label="Typography"
              value={brandForm.typography}
              onChange={(typography) => onBrandFormChange({ typography })}
              placeholder="bold sans-serif headlines"
            />
            <ThemeField
              label="Layout"
              value={brandForm.layout}
              onChange={(layout) => onBrandFormChange({ layout })}
              placeholder="minimal, logo top-left"
            />
            <ThemeField
              label="Imagery"
              value={brandForm.imagery}
              onChange={(imagery) => onBrandFormChange({ imagery })}
              placeholder="campus photography, diverse students"
            />
          </div>
          <label className="mt-3 block text-sm">
            <span className="text-xs font-medium text-slate-600">Density</span>
            <select
              value={brandForm.density}
              onChange={(e) => onBrandFormChange({ density: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 sm:max-w-xs"
            >
              <option value="sparse">Sparse — lots of whitespace</option>
              <option value="balanced">Balanced</option>
              <option value="dense">Dense — information-rich</option>
            </select>
          </label>
        </>
      )}

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {optimizedEnabled ? '4' : '1'} · Engine
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-600">Quality</span>
          <select
            value={quality}
            onChange={(e) => onQualityChange(e.target.value as ImageGenerationQuality)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-600">Provider</span>
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value as ProviderChoice)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
          >
            <option value="auto">Auto (text → Ideogram)</option>
            <option value="ideogram">Ideogram (best for text)</option>
            <option value="flux">FLUX (BFL)</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-slate-600">Variants</span>
          <select
            value={variantCount}
            onChange={(e) => onVariantCountChange(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400"
          >
            <option value={1}>1 image</option>
            <option value={2}>2 variants</option>
            <option value={3}>3 variants</option>
            <option value={4}>4 variants</option>
          </select>
        </label>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Premium + Ideogram recommended for flyers with headline/CTA text.
      </p>

      {optimizedEnabled && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-slate-700">Will send to API</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {headline.trim() && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                Headline: {headline.trim().slice(0, 32)}
                {headline.length > 32 ? '…' : ''}
              </span>
            )}
            {cta.trim() && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                CTA: {cta.trim()}
              </span>
            )}
            {previewColors.map((color) => (
              <ColorSwatch key={color} color={color} />
            ))}
            {resolvedPreview.brandTheme?.theme?.mood && (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-900">
                {resolvedPreview.brandTheme.theme.mood.slice(0, 40)}
                {(resolvedPreview.brandTheme.theme.mood.length || 0) > 40 ? '…' : ''}
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
              {quality} · {provider}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAdvancedJson((open) => !open)}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-left text-xs font-medium text-slate-600 hover:border-teal-300"
      >
        <span>Advanced: edit raw brand theme JSON</span>
        <ChevronDown className={`h-4 w-4 transition ${showAdvancedJson ? 'rotate-180' : ''}`} />
      </button>

      {showAdvancedJson && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onAdvancedJsonChange(BRAND_THEME_JSON_EXAMPLE);
                onBrandThemeErrorChange(null);
              }}
              className="text-[11px] font-medium text-teal-800 hover:underline"
            >
              Insert example
            </button>
            <button
              type="button"
              onClick={syncJsonFromForm}
              className="text-[11px] font-medium text-teal-800 hover:underline"
            >
              Sync from form above
            </button>
            <button
              type="button"
              onClick={importJsonToForm}
              className="text-[11px] font-medium text-teal-800 hover:underline"
            >
              Import JSON into form
            </button>
          </div>
          <textarea
            value={advancedJson}
            onChange={(e) => {
              onAdvancedJsonChange(e.target.value);
              if (!e.target.value.trim()) onBrandThemeErrorChange(null);
            }}
            rows={6}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-teal-400"
            placeholder='{ "palette": { "primary": "#0B2C5E" }, "theme": { "mood": "..." } }'
          />
          {brandThemeError ? (
            <span className="mt-1 block text-[11px] text-rose-600">{brandThemeError}</span>
          ) : (
            <span className="mt-1 block text-[11px] text-slate-500">
              When filled, advanced JSON overrides the structured form on generate.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { DEFAULT_BRAND_THEME_FORM };
