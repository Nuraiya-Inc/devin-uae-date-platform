'use client';

import { useState, useTransition } from 'react';
import { updateUserAction } from './actions';

interface AgentOpt {
  id: string;
  slug: string;
  name: string;
  tier: string;
  branch: string;
}

interface EditUserFormProps {
  userId: string;
  agents: AgentOpt[];
  initial: {
    name: string;
    email: string;
    title: string;
    role: string;
    entity: string;
    reportsToAgentId: string;
    canAccessAllAgents: boolean;
    canAccessAllEntities: boolean;
    extraAgentIds: string[];
  };
}

export default function EditUserForm({ userId, agents, initial }: EditUserFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [extraAgentIds, setExtraAgentIds] = useState<string[]>(initial.extraAgentIds);
  const [canAccessAll, setCanAccessAll] = useState<boolean>(initial.canAccessAllAgents);
  const [isPending, startTransition] = useTransition();

  function toggleAgent(id: string) {
    setExtraAgentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    formData.set('id', userId);
    extraAgentIds.forEach((id) => formData.append('extraAgentIds', id));
    if (canAccessAll) formData.set('canAccessAllAgents', 'on');
    else formData.delete('canAccessAllAgents');

    startTransition(async () => {
      const res = await updateUserAction(formData);
      if (res?.ok) setSuccess(true);
      else if (res?.error) setError(res.error);
    });
  }

  const orchestrator = agents.filter((a) => a.tier === 'ORCHESTRATOR');
  const executive = agents.filter((a) => a.tier === 'EXECUTIVE');
  const functional = agents.filter((a) => a.tier === 'FUNCTIONAL');

  return (
    <form action={onSubmit} className="space-y-5 bg-white border border-forest-100 rounded-lg p-6">
      <Field label="Full name" required>
        <input name="name" required minLength={2} defaultValue={initial.name} className="input" />
      </Field>

      <Field label="Email" required>
        <input name="email" type="email" required defaultValue={initial.email} className="input" />
      </Field>

      <Field label="Title">
        <input name="title" defaultValue={initial.title} className="input" />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Role" required>
          <select name="role" required defaultValue={initial.role} className="input">
            <option value="CEO">CEO</option>
            <option value="MD">MD</option>
            <option value="AGENT_OWNER">Agent Owner</option>
            <option value="TEAM_MEMBER">Team Member</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </Field>

        <Field label="Entity" required>
          <select name="entity" required defaultValue={initial.entity} className="input">
            <option value="FZE">Safa BioWorks FZE</option>
            <option value="INC">Safa BioWorks Inc.</option>
            <option value="GROUP">Cross-entity</option>
          </select>
        </Field>
      </div>

      <Field label="Reports to (agent)">
        <select name="reportsToAgentId" defaultValue={initial.reportsToAgentId} className="input">
          <option value="">— None (CEO / MD level) —</option>
          {[...orchestrator, ...executive, ...functional].map((a) => (
            <option key={a.id} value={a.id}>{a.slug} · {a.name}</option>
          ))}
        </select>
      </Field>

      <div className="bg-cream/40 border border-forest-100 rounded p-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={canAccessAll} onChange={(e) => setCanAccessAll(e.target.checked)} className="mt-1" />
          <div>
            <div className="text-sm font-medium text-forest">Can chat with ALL agents</div>
            <div className="text-xs text-forest-500">Bypasses the reporting-line scope.</div>
          </div>
        </label>
        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input type="checkbox" name="canAccessAllEntities" defaultChecked={initial.canAccessAllEntities} />
          <div>
            <div className="text-sm font-medium text-forest">Can see ALL entities</div>
            <div className="text-xs text-forest-500">Cross-entity reads.</div>
          </div>
        </label>
      </div>

      {!canAccessAll && (
        <Field label={`Extra agents (${extraAgentIds.length} selected)`}>
          <div className="max-h-72 overflow-y-auto border border-forest-200 rounded p-3 space-y-3">
            <AgentGroup label="Orchestrator" agents={orchestrator} selected={extraAgentIds} onToggle={toggleAgent} />
            <AgentGroup label="C-Suite" agents={executive} selected={extraAgentIds} onToggle={toggleAgent} />
            <AgentGroup label="Functional" agents={functional} selected={extraAgentIds} onToggle={toggleAgent} />
          </div>
        </Field>
      )}

      {error && <div className="p-3 bg-terra/10 border border-terra/30 rounded text-sm text-terra-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">✓ Saved.</div>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
          style={{ background: '#0F2E2E' }}
        >
          {isPending ? 'Saving…' : 'Save changes'}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-forest-700 mb-1">
        {label}{required && <span className="text-terra-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function AgentGroup({
  label,
  agents,
  selected,
  onToggle,
}: { label: string; agents: AgentOpt[]; selected: string[]; onToggle: (id: string) => void }) {
  if (agents.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-forest-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {agents.map((a) => (
          <label key={a.id} className="flex items-center gap-2 px-2 py-1 hover:bg-cream/40 rounded cursor-pointer text-sm">
            <input type="checkbox" checked={selected.includes(a.id)} onChange={() => onToggle(a.id)} />
            <span className="font-mono text-xs text-forest-500 w-16">{a.slug}</span>
            <span className="text-forest-700 truncate">{a.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
