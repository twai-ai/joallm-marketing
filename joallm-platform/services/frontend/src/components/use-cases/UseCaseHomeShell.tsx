import React from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UseCaseDefinition } from '../../constants/useCases';

interface UseCaseHomeShellProps {
  useCase: UseCaseDefinition;
  backHref?: string;
  backLabel?: string;
  badge?: ReactNode;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryPanelTitle: string;
  secondaryPanelBody: string;
  secondaryPanelContent?: ReactNode;
  children: ReactNode;
}

export function UseCaseHomeShell({
  useCase,
  backHref,
  backLabel,
  badge,
  title,
  description,
  primaryAction,
  secondaryPanelTitle,
  secondaryPanelBody,
  secondaryPanelContent,
  children,
}: UseCaseHomeShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white">
      <div className="workspace-shell flex flex-col gap-6 px-0 py-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-lg shadow-amber-100">
          <div className="grid gap-8 p-6 lg:grid-cols-[1.3fr_0.9fr] lg:p-8">
            <div>
              {backHref ? (
                <Link
                  to={backHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel || 'Back'}
                </Link>
              ) : null}
              {badge}
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                {description}
              </p>

              {primaryAction && <div className="mt-6 flex flex-wrap gap-3">{primaryAction}</div>}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white">
              <div className="text-sm font-medium text-amber-200">{useCase.label}</div>
              <h2 className="mt-3 text-2xl font-semibold">{secondaryPanelTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{secondaryPanelBody}</p>
              {secondaryPanelContent ? <div className="mt-6 space-y-3">{secondaryPanelContent}</div> : null}
            </div>
          </div>
        </section>

        {children}
      </div>
    </div>
  );
}
