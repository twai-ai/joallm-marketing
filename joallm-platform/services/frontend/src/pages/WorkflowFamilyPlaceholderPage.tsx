import React from 'react';
import { ArrowLeft, ArrowRight, Construction, LayoutTemplate, Sparkles } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getWorkflowFamilyById } from '../constants/workflowFamilies';
import { PRIMARY_USE_CASE } from '../constants/useCases';

export function WorkflowFamilyPlaceholderPage() {
  const navigate = useNavigate();
  const { familyId = '' } = useParams<{ familyId: string }>();
  const family = getWorkflowFamilyById(familyId);

  if (!family) {
    navigate('/welcome', { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white">
      <div className="workspace-shell flex flex-col gap-6 px-0 py-8">
        <section className="rounded-3xl border border-slate-200 bg-white/92 p-8 shadow-lg shadow-slate-100">
          <button
            onClick={() => navigate('/studio')}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Studio
          </button>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            <Construction className="h-4 w-4" />
            Placeholder workspace
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900">{family.label}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">{family.description}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Planned role
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{family.helper}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <LayoutTemplate className="h-4 w-4 text-blue-500" />
                Audience
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{family.audience}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-800">Current recommendation</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use Media AI for the live guided experience today while the other vertical workspaces remain placeholders.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => navigate(PRIMARY_USE_CASE.homeRoute)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open {PRIMARY_USE_CASE.label}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
