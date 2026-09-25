'use client';

import { useState } from 'react';

interface Finding {
  type: string;
  ruleId: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO';
  claim: string;
  expected: string;
  lineHint?: string;
  source: 'mechanical' | 'ai';
}

interface ScanResult {
  documentId: string;
  documentTitle: string;
  scannedAt: string;
  findings: Finding[];
  summary: { critical: number; high: number; medium: number; info: number; total: number };
  aiPassRan: boolean;
  aiPassError?: string;
}

const SEV_BG: Record<string, string> = {
  CRITICAL: 'bg-red-50 border-red-200 text-red-800',
  HIGH:     'bg-amber-50 border-amber-200 text-amber-800',
  MEDIUM:   'bg-yellow-50 border-yellow-200 text-yellow-800',
  INFO:     'bg-blue-50 border-blue-200 text-blue-800',
};

const SEV_PILL: Record<string, string> = {
  CRITICAL: 'bg-red-600 text-white',
  HIGH:     'bg-amber-600 text-white',
  MEDIUM:   'bg-yellow-500 text-white',
  INFO:     'bg-blue-500 text-white',
};

export default function DivergencePanel({ documentId }: { documentId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMinor, setShowMinor] = useState(false);

  async function runScan() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/divergence`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-forest uppercase tracking-wide">Divergence check</h2>
        <button
          onClick={runScan}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-md text-white disabled:opacity-50"
          style={{ background: '#004923' }}
          title="Compare this document against the canonical fact graph"
        >
          {busy ? 'Scanning…' : result ? 'Re-scan' : 'Check against canon'}
        </button>
      </div>

      <div className="bg-white border border-forest-100 rounded-lg p-4">
        {!result && !error && !busy && (
          <p className="text-sm text-forest-600">
            Optional check for external-facing materials (investor decks, partner letters, press). Compares this document against
            the Safa fact graph and surfaces any claim that contradicts canon — premature partner labels, off-baseline capital
            figures, geography slips, Chemplax mentions. <strong>Runs only when you click.</strong> Not a style police — only the
            cases where wrong wording creates legal or positioning risk.
          </p>
        )}

        {busy && (
          <div className="text-sm text-forest-500 animate-pulse">
            Reading the document, loading the fact graph, scanning for divergences…
          </div>
        )}

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {result.summary.total === 0 ? (
                <span className="text-sm font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                  ✓ No divergences from canon
                </span>
              ) : (
                <>
                  {result.summary.critical > 0 && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${SEV_PILL.CRITICAL}`}>
                      {result.summary.critical} CRITICAL
                    </span>
                  )}
                  {result.summary.high > 0 && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${SEV_PILL.HIGH}`}>
                      {result.summary.high} HIGH
                    </span>
                  )}
                  {result.summary.medium > 0 && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${SEV_PILL.MEDIUM}`}>
                      {result.summary.medium} MEDIUM
                    </span>
                  )}
                  {result.summary.info > 0 && (
                    <span className={`text-xs px-2 py-1 rounded font-medium ${SEV_PILL.INFO}`}>
                      {result.summary.info} INFO
                    </span>
                  )}
                </>
              )}
              <span className="text-xs text-forest-400 ml-auto">
                Scanned {new Date(result.scannedAt).toLocaleString()}
                {result.aiPassRan ? ' · mechanical + AI' : ' · mechanical only'}
              </span>
            </div>

            {result.aiPassError && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded mb-3">
                AI pass error: {result.aiPassError} — mechanical findings shown below.
              </div>
            )}

            {result.findings.length > 0 && (() => {
              const major = result.findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
              const minor = result.findings.filter((f) => f.severity === 'MEDIUM' || f.severity === 'INFO');
              return (
                <div className="space-y-2">
                  {major.map((f, idx) => <FindingRow key={`maj-${idx}`} f={f} />)}

                  {minor.length > 0 && !showMinor && (
                    <button
                      onClick={() => setShowMinor(true)}
                      className="text-xs text-forest-500 hover:text-forest-700 underline"
                    >
                      Show {minor.length} minor note{minor.length === 1 ? '' : 's'} (medium / info)
                    </button>
                  )}

                  {showMinor && minor.map((f, idx) => <FindingRow key={`min-${idx}`} f={f} />)}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </section>
  );
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <div className={`border rounded p-3 ${SEV_BG[f.severity] ?? ''}`}>
      <div className="flex items-center gap-2 mb-1 text-xs">
        <span className={`px-2 py-0.5 rounded font-medium ${SEV_PILL[f.severity]}`}>
          {f.severity}
        </span>
        <span className="font-mono">{f.ruleId}</span>
        <span className="font-mono opacity-70">· {f.type}</span>
        {f.lineHint && <span className="opacity-60">· {f.lineHint}</span>}
        <span className="ml-auto opacity-50">{f.source}</span>
      </div>
      <div className="text-sm font-medium mb-1">
        <span className="opacity-60 mr-1">Says:</span>"{f.claim}"
      </div>
      <div className="text-xs opacity-90">
        <span className="opacity-60 mr-1">Canon:</span>{f.expected}
      </div>
    </div>
  );
}
