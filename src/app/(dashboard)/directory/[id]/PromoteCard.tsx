'use client';

/**
 * PromoteCard — staff action that registers a DirectoryEntry as a Partner
 * (TD4). Creates exactly one Partner at REGISTERED tier, links partnerId,
 * and flips relationship to REGISTERED. Tier/certification changes are not
 * offered here — they go through the approvals queue (UPN-2).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import type { Region, ValueChainStage } from '@prisma/client';
import { REGION_LABELS } from '@/lib/directory-labels';

const TYPE_OPTIONS = [
  { value: 'FARM', label: 'Farm' },
  { value: 'FACTORY', label: 'Factory' },
  { value: 'COMPANY', label: 'Company' },
  { value: 'RECYCLER', label: 'Recycler' },
  { value: 'COLLECTOR', label: 'Collector' },
];

const STAGE_TO_TYPE: Record<ValueChainStage, string> = {
  GROWERS_FARMS: 'FARM',
  PROCESSORS_MANUFACTURERS: 'FACTORY',
  WASTE_COLLECTION: 'COLLECTOR',
  TRADERS_IMPORT_EXPORT: 'COMPANY',
  BUYERS_END_USERS: 'COMPANY',
  ECOSYSTEM: 'COMPANY',
};

export default function PromoteCard({
  entryId,
  stage,
  region,
  location,
}: {
  entryId: string;
  stage: ValueChainStage;
  region: Region | null;
  location: string | null;
}) {
  const router = useRouter();
  const [type, setType] = useState(STAGE_TO_TYPE[stage]);
  const [chosenRegion, setChosenRegion] = useState<string>(region ?? '');
  const [city, setCity] = useState(location ?? '');
  const [contactName, setContactName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function promote() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/directory/${entryId}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          region: chosenRegion || undefined,
          city: city || undefined,
          contactName: contactName || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setDone(json.registryNo);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-mint-300 bg-mint-100 p-5 text-sm text-mint-700">
        Registered as partner <span className="font-mono font-semibold">{done}</span> — the entry now counts in
        partner aggregates.
      </div>
    );
  }

  const canSubmit = !busy && !!chosenRegion;

  return (
    <section className="rounded-xl border border-line bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-brand-800">
        <UserPlus className="h-4 w-4" /> Register as partner
      </h2>
      <p className="mb-4 text-xs text-muted">
        Creates a Partner at REGISTERED tier and links it here — the entity starts counting in partner aggregates
        only after this. Tier or certification changes afterwards go through the approvals queue (UPN-2).
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted">
          Partner type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-forest-700"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted">
          Emirate {region === null && <span className="text-red-600">(required — entry has none)</span>}
          <select
            value={chosenRegion}
            onChange={(e) => setChosenRegion(e.target.value)}
            disabled={region !== null}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-forest-700 disabled:bg-mist disabled:text-muted"
          >
            <option value="">Select emirate…</option>
            {Object.entries(REGION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-muted">
          City
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-forest-700"
          />
        </label>

        <label className="block text-xs text-muted">
          Contact name
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-forest-700"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      <button
        onClick={promote}
        disabled={!canSubmit}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? 'Registering…' : 'Register this entry as a partner'}
      </button>
    </section>
  );
}
