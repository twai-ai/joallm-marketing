import React from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { UseCaseDefinition } from '../../constants/useCases';

interface UseCaseAssetShellProps {
  useCase: UseCaseDefinition;
  onBack: () => void;
  badge?: ReactNode;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  summaryCards?: ReactNode;
  sidePanelTitle: string;
  sidePanelBody: string;
  sidePanelContent?: ReactNode;
  children?: ReactNode;
}

export function UseCaseAssetShell({
  useCase,
  onBack,
  badge,
  title,
  description,
  primaryAction,
  summaryCards,
  sidePanelTitle,
  sidePanelBody,
  sidePanelContent,
  children,
}: UseCaseAssetShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white">
      <div className="workspace-shell flex flex-col gap-6 px-0 py-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-lg shadow-amber-100">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:p-8">
            <div>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {useCase.label}
              </button>

              {badge}

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>

              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                {description}
              </p>

              {primaryAction ? <div className="mt-6 flex flex-wrap gap-3">{primaryAction}</div> : null}
              {summaryCards ? <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards}</div> : null}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
              <div className="text-sm font-medium text-amber-200">{useCase.label}</div>
              <h2 className="mt-3 text-2xl font-semibold">{sidePanelTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{sidePanelBody}</p>
              {sidePanelContent ? <div className="mt-6 space-y-3">{sidePanelContent}</div> : null}
            </div>
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}

