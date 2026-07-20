/**
 * Creative AI BYOK — keys live in the same encrypted users.api_keys store as LLM keys.
 * OpenAI is shared with chat (GPT Image uses the same key).
 */

export type CreativeApiKeySlot =
  | 'openai'
  | 'google_imagen'
  | 'flux'
  | 'ideogram'
  | 'stability'
  | 'adobe_firefly';

export const CREATIVE_API_PROVIDER_FIELDS: Array<{
  key: Exclude<CreativeApiKeySlot, 'openai'>;
  label: string;
  placeholder: string;
  description: string;
  keyUrl: string;
  keyUrlLabel: string;
  strengths: string;
}> = [
  {
    key: 'google_imagen',
    label: 'Google Imagen',
    placeholder: 'AIza... or OAuth-linked project key',
    description: 'Photorealism, product visuals, conversational editing for Generation Profiles.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyUrlLabel: 'aistudio.google.com/apikey',
    strengths: 'Product mockups · Photo-real',
  },
  {
    key: 'flux',
    label: 'Black Forest Labs FLUX',
    placeholder: 'bfl_...',
    description: 'High-volume and cost-efficient image generation; strong for enterprise scale.',
    keyUrl: 'https://docs.bfl.ai/',
    keyUrlLabel: 'docs.bfl.ai',
    strengths: 'Draft · High volume · Realism',
  },
  {
    key: 'ideogram',
    label: 'Ideogram',
    placeholder: '...',
    description: 'Posters, banners, logos, and marketing graphics with embedded text.',
    keyUrl: 'https://ideogram.ai/',
    keyUrlLabel: 'ideogram.ai',
    strengths: 'Typography · Posters · Logos',
  },
  {
    key: 'stability',
    label: 'Stability AI',
    placeholder: 'sk-...',
    description: 'Self-host / fine-tune oriented generation and upscaling.',
    keyUrl: 'https://platform.stability.ai/account/keys',
    keyUrlLabel: 'platform.stability.ai',
    strengths: 'Upscale · Enterprise control',
  },
  {
    key: 'adobe_firefly',
    label: 'Adobe Firefly',
    placeholder: '...',
    description: 'Brand-safe commercial creatives for enterprise Creative Cloud shops.',
    keyUrl: 'https://developer.adobe.com/firefly-services/',
    keyUrlLabel: 'developer.adobe.com/firefly-services',
    strengths: 'Brand-safe · Enterprise',
  },
];

export const EMPTY_CREATIVE_API_KEYS: Record<Exclude<CreativeApiKeySlot, 'openai'>, string> = {
  google_imagen: '',
  flux: '',
  ideogram: '',
  stability: '',
  adobe_firefly: '',
};
