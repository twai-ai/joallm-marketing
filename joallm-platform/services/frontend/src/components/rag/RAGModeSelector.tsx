import React from 'react';
import { MessageSquare, BookOpen, ShieldCheck, GitFork } from 'lucide-react';
import { RAGModeId } from '../../services/ragChatApi';

interface RAGMode {
  id: RAGModeId;
  label: string;
  tagline: string;
  icon: React.ReactNode;
  pills: string[];
  color: string;
  activeColor: string;
  iconColor: string;
}

const MODES: RAGMode[] = [
  {
    id: 'standard',
    label: 'Standard',
    tagline: 'Balanced retrieval · Fast response',
    icon: <MessageSquare className="w-4 h-4" />,
    pills: ['Balanced', 'Fast'],
    color: 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50',
    activeColor: 'border-blue-500 bg-blue-50 ring-1 ring-blue-400',
    iconColor: 'text-blue-500',
  },
  {
    id: 'research',
    label: 'Research',
    tagline: 'Deep retrieval · Multi-hop · Lineage-aware',
    icon: <BookOpen className="w-4 h-4" />,
    pills: ['Multi-hop', 'Lineage'],
    color: 'border-gray-200 bg-white hover:border-violet-300 hover:bg-violet-50',
    activeColor: 'border-violet-500 bg-violet-50 ring-1 ring-violet-400',
    iconColor: 'text-violet-500',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    tagline: 'Strict filtering · Source traceability',
    icon: <ShieldCheck className="w-4 h-4" />,
    pills: ['Traceable', 'Strict'],
    color: 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50',
    activeColor: 'border-amber-500 bg-amber-50 ring-1 ring-amber-400',
    iconColor: 'text-amber-500',
  },
  {
    id: 'decision',
    label: 'Decision',
    tagline: 'Multi-source · Structured output · Justified',
    icon: <GitFork className="w-4 h-4" />,
    pills: ['Structured', 'Justified'],
    color: 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50',
    activeColor: 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400',
    iconColor: 'text-emerald-500',
  },
];

interface RAGModeSelectorProps {
  selected: RAGModeId;
  onChange: (mode: RAGModeId) => void;
  compact?: boolean;
}

export function RAGModeSelector({ selected, onChange, compact = false }: RAGModeSelectorProps) {
  if (compact) {
    // Compact pill row — used inside the chat header
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {MODES.map((m) => {
          const isActive = m.id === selected;
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              title={m.tagline}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
                isActive ? m.activeColor : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
              }`}
            >
              <span className={isActive ? m.iconColor : 'text-gray-400'}>{m.icon}</span>
              <span className={isActive ? 'text-gray-800' : ''}>{m.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Full card grid — used above the chat
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {MODES.map((m) => {
        const isActive = m.id === selected;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
              isActive ? m.activeColor : m.color
            }`}
          >
            <div className={`flex items-center gap-2 ${isActive ? m.iconColor : 'text-gray-500'}`}>
              {m.icon}
              <span className="font-semibold text-sm text-gray-900">{m.label}</span>
            </div>
            <p className="text-xs text-gray-500 leading-tight">{m.tagline}</p>
            <div className="flex flex-wrap gap-1 mt-auto">
              {m.pills.map((pill) => (
                <span
                  key={pill}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isActive
                      ? `${m.activeColor} text-gray-700`
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {pill}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
