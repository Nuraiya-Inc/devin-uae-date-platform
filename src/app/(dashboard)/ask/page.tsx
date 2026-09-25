'use client';

/**
 * Ask the Sector — an official asks a question in Arabic or English and the
 * Analytics agent (ana-01) answers from LIVE data via its query_sector_metrics
 * tool. Aggregate-only by design (rule UPN-3). Thin client over the existing
 * agent chat endpoint.
 */

import { useState, useRef, useEffect } from 'react';

interface Turn { role: 'user' | 'agent'; text: string }

const SUGGESTIONS: Array<{ en: string; ar: string; q: string }> = [
  { en: 'Which emirates are behind on reporting?', ar: 'أي إمارة الأقل التزامًا بالتقارير؟', q: 'Which emirates are behind on reporting this year? Give the participation rate per emirate.' },
  { en: 'How much residue was diverted this year?', ar: 'كم كمية النواتج المُحوّلة هذا العام؟', q: 'How much palm residue was diverted from burning or burial this year, and what is the diversion rate?' },
  { en: "What's our estimated climate contribution?", ar: 'ما مساهمتنا المناخية التقديرية؟', q: 'What is the network\'s estimated climate contribution this year and cumulatively? Be clear it is indicative.' },
  { en: 'Give me a one-paragraph state of the sector.', ar: 'أعطني ملخصًا موجزًا لحالة القطاع.', q: 'Give me a concise one-paragraph state of the sector overview from the live numbers.' },
];

export default function AskSectorPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/agents/ana-01/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, threadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Request failed');
      if (data.threadId) setThreadId(data.threadId);
      setTurns((t) => [...t, { role: 'agent', text: data.content ?? '(no answer)' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col p-4 sm:p-6">
      <header className="mb-4">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Ask the Sector</h1>
        <p className="text-sm text-muted">
          اسأل القطاع · Ask a question in Arabic or English — answered live from approved network data by the analytics agent. Aggregates only.
        </p>
      </header>

      {turns.length === 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.en}
              onClick={() => ask(s.q)}
              className="rounded-xl border border-line bg-white p-3 text-left shadow-card transition hover:border-brand-300 hover:shadow-card-hover"
            >
              <div className="text-sm font-medium text-ink">{s.en}</div>
              <div className="text-xs text-brand-700" dir="rtl">{s.ar}</div>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-white/60 p-4">
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
              t.role === 'user' ? 'bg-brand-700 text-white' : 'border border-line bg-white text-ink'
            }`}>
              {t.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-line bg-white px-4 py-2.5 text-sm text-muted">
              Reading the live numbers…
            </div>
          </div>
        )}
        {error && <div className="text-center text-xs text-red-600">{error}</div>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); } }}
          rows={1}
          placeholder="Ask about participation, production, diversion, climate contribution…"
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
      <p className="mt-2 text-center text-[11px] text-muted">
        Answers are generated by the analytics agent from aggregate data. ESG figures are indicative estimates.
      </p>
    </div>
  );
}
