'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectOpt {
  slug: string;
  name: string;
}

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '(Auto — let AI classify)' },
  { value: 'GENERAL', label: 'General' },
  { value: 'PITCH_DECK', label: 'Pitch deck' },
  { value: 'BUSINESS_PLAN', label: 'Business plan' },
  { value: 'FINANCIAL_MODEL', label: 'Financial model' },
  { value: 'INVESTOR_UPDATE', label: 'Investor update' },
  { value: 'TERM_SHEET', label: 'Term sheet' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'LOI', label: 'LOI' },
  { value: 'NDA', label: 'NDA' },
  { value: 'REGULATORY_DOSSIER', label: 'Regulatory dossier' },
  { value: 'SCIENTIFIC_MEMO', label: 'Scientific memo' },
  { value: 'SOP', label: 'SOP' },
  { value: 'HSE_REPORT', label: 'HSE report' },
  { value: 'BOARD_PACK', label: 'Board pack' },
  { value: 'LEGAL_OPINION', label: 'Legal opinion' },
  { value: 'POLICY', label: 'Policy' },
];

const SENSITIVITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '(Auto — let AI classify)' },
  { value: 'PUBLIC', label: 'Public' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'COMMERCIAL_SENSITIVE', label: 'Commercial sensitive' },
  { value: 'IP_CRITICAL', label: 'IP critical (strain / process)' },
  { value: 'INVESTOR_RESTRICTED', label: 'Investor restricted (term sheet / cap)' },
];

export default function UploadDocumentForm({ projects }: { projects: ProjectOpt[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!file) {
      setError('Pick a file first.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError(`Too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 25 MB.`);
      return;
    }

    setBusy(true);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/documents', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setSuccess(
        `Uploaded "${json.title}" ✓ — AI is classifying now (5–15 seconds). The list below will refresh shortly.`,
      );
      setFile(null);
      formRef.current?.reset();

      // Auto-refresh the list a few times to catch the AI classification
      let i = 0;
      const interval = setInterval(() => {
        router.refresh();
        if (++i >= 4) clearInterval(interval);
      }, 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-forest-700 mb-1">
          File <span className="text-terra-600">*</span>
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            name="file"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded file:bg-forest file:text-white file:cursor-pointer hover:file:bg-forest-500"
          />
          {file && (
            <div className="text-xs text-forest-500">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </div>
          )}
        </div>
        <p className="text-xs text-forest-400 mt-1">
          Any file type. Max 25 MB. The AI will auto-title, auto-classify by kind + sensitivity, and route to the right branches once you upload.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-forest-700 mb-1">
          Notes for the AI (optional)
        </label>
        <textarea
          name="notes"
          rows={2}
          placeholder="e.g. &quot;Draft LOI for Emirates Biotech, do not share with marketing&quot; — anything that helps the classifier."
          maxLength={1000}
          className="w-full px-3 py-2 border border-forest-200 rounded text-sm focus:outline-none focus:border-amber"
        />
      </div>

      <details
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
        className="bg-cream/40 border border-forest-100 rounded p-3"
      >
        <summary className="text-xs text-forest-500 cursor-pointer hover:text-forest-700 select-none">
          Advanced — override AI auto-classification
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Kind override">
              <select name="kind" defaultValue="" className="input">
                {KIND_OPTIONS.map((k) => (
                  <option key={k.value || 'auto'} value={k.value}>{k.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Sensitivity override">
              <select name="ipSensitivity" defaultValue="" className="input">
                {SENSITIVITY_OPTIONS.map((s) => (
                  <option key={s.value || 'auto'} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Project (optional)">
            <select name="projectSlug" defaultValue="" className="input">
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-forest-400">
            Leave fields blank to let the AI decide. Use these only when you know better than the AI will (e.g. you know this is for the board even though the body reads like a memo).
          </p>
        </div>
      </details>

      {error && (
        <div className="p-3 bg-terra/10 border border-terra/30 rounded text-sm text-terra-700">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">{success}</div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || !file}
          className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
          style={{ background: '#0F2E2E' }}
        >
          {busy ? 'Uploading…' : 'Upload & auto-classify'}
        </button>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #C2D1D1;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
        }
        .input:focus { outline: none; border-color: #D4A017; }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-forest-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
