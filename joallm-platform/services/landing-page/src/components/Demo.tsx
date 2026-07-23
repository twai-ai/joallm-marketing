import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, FileStack, Workflow } from 'lucide-react';

interface DemoMessage {
  id: number;
  text: string;
  sender: 'user' | 'assistant' | 'system';
  model?: string;
}

const script: Omit<DemoMessage, 'id'>[] = [
  {
    sender: 'system',
    text: 'Q4-Earnings-2025.pdf uploaded. Indexing started and readiness tracking is live.',
  },
  {
    sender: 'user',
    text: 'Use the uploaded report and summarize the biggest operational and revenue risks.',
  },
  {
    sender: 'assistant',
    model: 'Claude 4 Sonnet · Grounded Knowledge',
    text:
      'I found 4 relevant source chunks with strong matches.\n\nTop risks:\n• Revenue concentration across the top 3 accounts\n• Cloud infrastructure cost growth compressing margins\n• EU compliance exposure pending audit review\n• Hiring gaps in critical engineering roles\n\nGrounded from pages 12, 17, 23, and 31.',
  },
  {
    sender: 'user',
    text: 'Turn that into a workflow for review and escalation.',
  },
  {
    sender: 'assistant',
    model: 'Workflow Builder · Execution-ready',
    text:
      'Workflow drafted:\n[Document Input] → [Risk Analysis] → [Condition: risk > threshold] → [Escalate] / [Archive]\n\nYou can now operationalize the same pattern for future reports.',
  },
];

const previewPanels = [
  {
    title: 'Knowledge readiness',
    value: '2 docs ready',
    helper: '1 document still indexing',
    icon: FileStack,
  },
  {
    title: 'Grounded result',
    value: '4 sources used',
    helper: 'Strong relevance on top matches',
    icon: CheckCircle2,
  },
  {
    title: 'Operational next step',
    value: 'Workflow drafted',
    helper: 'Route repeated work into execution',
    icon: Workflow,
  },
];

const trustNotes = [
  'The demo follows the strongest activation path: upload, wait confidently, ask, verify, operationalize.',
  'It stays close to the product theme without pretending the landing page is the full application.',
  'It gives non-technical buyers a guided narrative and technical evaluators a believable product shape.',
];

export const Demo: React.FC = () => {
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeModel, setActiveModel] = useState('Knowledge flow initializing');
  const containerRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = indexRef.current;
      if (nextIndex >= script.length) {
        return;
      }

      setIsTyping(true);

      setTimeout(() => {
        const nextMessage = script[nextIndex];
        setMessages((previous) => [...previous, { ...nextMessage, id: nextIndex + 1 }]);
        if (nextMessage.model) {
          setActiveModel(nextMessage.model);
        }
        indexRef.current = nextIndex + 1;
        setIsTyping(false);
      }, 1200);
    }, 2800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <section id="demo" className="lp-section-alt py-24 relative overflow-hidden" style={{ scrollMarginTop: '64px' }}>
      <div className="absolute inset-0 lp-line-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-joa-primary">Guided Demo</p>
            <h2 className="font-bold text-joa-dark leading-tight" style={{ fontSize: 'clamp(2rem, 4.2vw, 3rem)' }}>
              A preview that feels
              <span className="lp-gradient-text block">close to the real platform</span>
            </h2>
            <p className="text-lg leading-8 text-joa-text">
              Instead of making the landing page a second app, this section walks buyers through the most important journey in JoaLLM: grounded knowledge work that becomes operational.
            </p>

            <div className="grid gap-4">
              {previewPanels.map((panel) => (
                <div key={panel.title} className="lp-glass-card p-5 flex items-start gap-4">
                  <div className="lp-icon-box" style={{ background: 'rgba(59,130,246,0.08)' }}>
                    <panel.icon className="h-5 w-5 text-joa-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{panel.title}</p>
                    <p className="mt-2 text-lg font-semibold text-joa-dark">{panel.value}</p>
                    <p className="mt-1 text-sm text-joa-text">{panel.helper}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="lp-glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock3 className="h-5 w-5 text-joa-primary" />
                <h3 className="text-base font-semibold text-joa-dark">Why this demo approach works</h3>
              </div>
              <ul className="space-y-3">
                {trustNotes.map((note) => (
                  <li key={note} className="flex items-start gap-3 text-sm text-joa-text">
                    <span className="mt-1 h-2 w-2 rounded-full bg-joa-primary" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                <button className="lp-btn-primary" onClick={() => window.open('https://platform.atrisi.org/', '_blank')}>
                  Try the platform
                </button>
                <button
                  className="lp-inline-link"
                  onClick={() => window.open('mailto:support@joallm.ai?subject=Request Guided Demo', '_blank')}
                >
                  Request guided walkthrough
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="lp-glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs font-mono text-gray-400">JoaLLM guided preview</span>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'lp-pulse-dot 2s ease-in-out infinite' }} />
                <span className="text-xs text-joa-text truncate max-w-[180px]">{activeModel}</span>
              </div>
            </div>

            <div className="grid gap-0 border-b border-gray-100 lg:grid-cols-[1.2fr_0.8fr]">
              <div ref={containerRef} className="p-5 h-[430px] overflow-y-auto flex flex-col gap-4 bg-white">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-300">Guided demo starting…</div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                        message.sender === 'user'
                          ? 'border border-red-200 bg-red-50'
                          : message.sender === 'system'
                          ? 'border border-blue-100 bg-blue-50'
                          : 'border border-gray-200 bg-gray-50'
                      }`}
                    >
                      <p className="text-sm leading-7 whitespace-pre-wrap text-slate-700">{message.text}</p>
                      {message.model ? <p className="mt-2 text-xs font-mono text-gray-400">via {message.model}</p> : null}
                    </div>
                  </div>
                ))}

                {isTyping ? (
                  <div className="flex justify-start">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="flex gap-1">
                        {[0, 0.15, 0.3].map((delay, index) => (
                          <div
                            key={index}
                            className="w-1.5 h-1.5 rounded-full animate-bounce bg-gray-300"
                            style={{ animationDelay: `${delay}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-l border-gray-100 bg-slate-50/70 p-5">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">What this shows</p>
                  <h3 className="mt-2 text-lg font-semibold text-joa-dark">Product continuity</h3>
                </div>

                <div className="space-y-4">
                  <div className="lp-mini-panel">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-joa-dark">Knowledge</span>
                      <span className="lp-mini-badge">Ready</span>
                    </div>
                    <p className="text-sm text-joa-text">The page mirrors the real platform’s upload, indexing, and grounded-answer story.</p>
                  </div>

                  <div className="lp-mini-panel">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-joa-dark">Trust</span>
                      <span className="lp-mini-badge">Visible</span>
                    </div>
                    <p className="text-sm text-joa-text">Relevance, sources, and workflow outcomes are explained like a real workspace, not a vapor demo.</p>
                  </div>

                  <div className="lp-mini-panel">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-joa-dark">Next step</span>
                      <span className="lp-mini-badge">Operational</span>
                    </div>
                    <p className="text-sm text-joa-text">The story ends by routing proven work into workflows, which is where enterprise value starts to compound.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
