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
  /** ATRISI institutional (teal+slate) vs Amplify program (amber). Default: institutional. */
  brand?: 'institutional' | 'amplify';
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
  brand = 'institutional',
}: UseCaseHomeShellProps) {
  const isAmplify = brand === 'amplify';

  return (
    <div
      className={
        isAmplify
          ? 'min-h-screen bg-gradient-to-br from-slate-50 via-amber-50 to-white'
          : 'atrisi-page min-h-screen bg-slate-50'
      }
    >
      <div className="workspace-shell flex flex-col gap-6 px-0 py-6">
        <section
          className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
            isAmplify ? 'border-slate-200 shadow-amber-100' : 'border-atrisi-gray-dark'
          }`}
        >
          {!isAmplify ? <div className="atrisi-accent-line w-full" aria-hidden /> : null}
          <div className="grid gap-8 p-6 lg:grid-cols-[1.3fr_0.9fr] lg:p-8">
            <div>
              {backHref ? (
                <Link
                  to={backHref}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50/50 hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backLabel || 'Back'}
                </Link>
              ) : null}
              {badge}
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
                {description}
              </p>

              {primaryAction && <div className="mt-6 flex flex-wrap gap-3">{primaryAction}</div>}
            </div>

            <div
              className={
                isAmplify
                  ? 'rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white'
                  : 'rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-[0_0_40px_rgba(20,184,166,0.12)]'
              }
            >
              <div
                className={`text-sm font-medium ${
                  isAmplify ? 'text-amber-200' : 'text-teal-300'
                }`}
              >
                {useCase.label}
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">{secondaryPanelTitle}</h2>
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
