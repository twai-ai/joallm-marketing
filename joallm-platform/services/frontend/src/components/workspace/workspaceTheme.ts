export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

export const workspaceShell =
  'h-full flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_32%),linear-gradient(180deg,_#f8fbff_0%,_#eef3f8_100%)]';

export const workspaceHeader =
  'border-b border-slate-200/80 bg-white/85 px-5 py-4 backdrop-blur-xl';

export const workspacePanel =
  'rounded-2xl border border-slate-200/80 bg-white/88 shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-sm';

export const workspacePanelMuted =
  'rounded-2xl border border-slate-200/70 bg-slate-50/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]';

export const workspaceSectionLabel =
  'text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500';

export const workspaceTitle =
  'text-lg font-semibold tracking-tight text-slate-900';

export const workspaceBody =
  'text-sm leading-6 text-slate-600';

export const workspaceInput =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

export const workspaceTextarea =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100';

export const workspaceSelect = workspaceInput;

export const workspaceButton = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  accent:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
  success:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3.5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50',
};

export const workspaceBadge = {
  neutral:
    'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600',
  accent:
    'inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700',
  success:
    'inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700',
  warn:
    'inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800',
  brand:
    'inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700',
};

const workflowNodeTones = {
  input: {
    tile: 'from-emerald-500 to-emerald-600',
    soft: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    stroke: '#10b981',
    preview: '#34d399',
  },
  llm: {
    tile: 'from-blue-500 to-indigo-600',
    soft: 'bg-blue-50 text-blue-700 border-blue-200',
    stroke: '#2563eb',
    preview: '#60a5fa',
  },
  rag: {
    tile: 'from-indigo-500 to-sky-600',
    soft: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    stroke: '#4f46e5',
    preview: '#818cf8',
  },
  conditional: {
    tile: 'from-amber-500 to-orange-500',
    soft: 'bg-amber-50 text-amber-800 border-amber-200',
    stroke: '#f59e0b',
    preview: '#fbbf24',
  },
  transform: {
    tile: 'from-violet-500 to-fuchsia-600',
    soft: 'bg-violet-50 text-violet-700 border-violet-200',
    stroke: '#8b5cf6',
    preview: '#a78bfa',
  },
  output: {
    tile: 'from-slate-600 to-slate-800',
    soft: 'bg-slate-100 text-slate-700 border-slate-200',
    stroke: '#475569',
    preview: '#94a3b8',
  },
  legacy: {
    tile: 'from-slate-400 to-slate-500',
    soft: 'bg-amber-50 text-amber-800 border-amber-200',
    stroke: '#94a3b8',
    preview: '#cbd5e1',
  },
} as const;

export const getWorkflowNodeTone = (type: string) =>
  workflowNodeTones[type as keyof typeof workflowNodeTones] ?? workflowNodeTones.legacy;

export const notebookCellTone = {
  markdown: 'border-slate-200 bg-white',
  code: 'border-slate-200 bg-slate-950/95 text-slate-100',
  ai: 'border-blue-200 bg-blue-50/70',
  knowledge: 'border-indigo-200 bg-indigo-50/60',
  chart: 'border-amber-200 bg-amber-50/60',
  agent: 'border-violet-200 bg-violet-50/60',
  debug: 'border-rose-200 bg-rose-50/60',
};
