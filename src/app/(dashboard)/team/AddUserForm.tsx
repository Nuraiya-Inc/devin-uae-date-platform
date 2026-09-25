'use client';

import { useState, useTransition } from 'react';
import { createUserAction } from './actions';

interface AgentOpt {
  id: string;
  slug: string;
  name: string;
  tier: string;
  branch: string;
}

interface AddUserFormProps {
  agents: AgentOpt[];
  /** Optional initial values when editing — when omitted, this is a create form */
  initial?: Partial<{
    name: string;
    email: string;
    title: string;
    role: string;
    entity: string;
    reportsToAgentId: string;
    canAccessAllAgents: boolean;
    canAccessAllEntities: boolean;
    extraAgentIds: string[];
  }>;
}

const TIER_LABEL: Record<string, string> = {
  ORCHESTRATOR: 'Orchestrator',
  EXECUTIVE: 'C-suite',
  FUNCTIONAL: 'Functional',
};

export default function AddUserForm({ agents, initial }: AddUserFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [extraAgentIds, setExtraAgentIds] = useState<string[]>(initial?.extraAgentIds ?? []);
  const [canAccessAll, setCanAccessAll] = useState<boolean>(initial?.canAccessAllAgents ?? false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function toggleAgent(id: string) {
    setExtraAgentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    extraAgentIds.forEach((id) => formData.append('extraAgentIds', id));
    if (canAccessAll) {
      formData.set('canAccessAllAgents', 'on');
    } else {
      formData.delete('canAccessAllAgents');
    }
    startTransition(async () => {
      const res = await createUserAction(formData);
      // createUserAction redirects on success; only get here if it returned an error
      if (res && !res.ok) setError(res.error || 'Unknown error');
    });
  }

  // Group agents by tier for the multi-select
  const orchestrator = agents.filter((a) => a.tier === 'ORCHESTRATOR');
  const executive = agents.filter((a) => a.tier === 'EXECUTIVE');
  const functional = agents.filter((a) => a.tier === 'FUNCTIONAL');

  return (
    <form action={onSubmit} className="space-y-5 bg-white border border-forest-100 rounded-lg p-6">
      <Field label="Full name" required>
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={initial?.name}
          className="w-full px-3 py-2 border border-forest-200 rounded text-sm focus:outline-none focus:border-amber"
        />
      </Field>

      <Field label="Email" required>
        <input
          name="email"
          type="email"
          required
          defaultValue={initial?.email}
          className="w-full px-3 py-2 border border-forest-200 rounded text-sm focus:outline-none focus:border-amber"
        />
      </Field>

      <Field label="Title (optional)">
        <input
          name="title"
          maxLength={120}
          defaultValue={initial?.title}
          placeholder="e.g. Lab Technician, CTO, Operations Engineer"
          className="w-full px-3 py-2 border border-forest-200 rounded text-sm focus:outline-none focus:border-amber"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Role" required>
          <select
            name="role"
            required
            defaultValue={initial?.role ?? 'TEAM_MEMBER'}
            className="w-full px-3 py-2 border border-forest-200 rounded text-sm bg-white focus:outline-none focus:border-amber"
          >
            <option value="CEO">CEO</option>
            <option value="MD">MD (Managing Director-tier)</option>
            <option value="AGENT_OWNER">Agent Owner (lead a branch)</option>
            <option value="TEAM_MEMBER">Team Member</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="VIEWER">Viewer (read-only)</option>
          </select>
        </Field>

        <Field label="Entity" required>
          <select
            name="entity"
            required
            defaultValue={initial?.entity ?? 'FZE'}
            className="w-full px-3 py-2 border border-forest-200 rounded text-sm bg-white focus:outline-none focus:border-amber"
          >
            <option value="GROUP">UAE Palm Network</option>
            
            <option value="GROUP">Cross-entity (CEO / MD)</option>
          </select>
        </Field>
      </div>

      <Field label="Reports to (agent)">
        <select
          name="reportsToAgentId"
          defaultValue={initial?.reportsToAgentId ?? ''}
          className="w-full px-3 py-2 border border-forest-200 rounded text-sm bg-white focus:outline-none focus:border-amber"
        >
          <option value="">— None (CEO / MD level) —</option>
          {orchestrator.map((a) => (
            <option key={a.id} value={a.id}>{a.slug} · {a.name}</option>
          ))}
          {executive.map((a) => (
            <option key={a.id} value={a.id}>{a.slug} · {a.name}</option>
          ))}
          {functional.map((a) => (
            <option key={a.id} value={a.id}>{a.slug} · {a.name}</option>
          ))}
        </select>
        <p className="text-xs text-forest-400 mt-1">
          Determines which agent's "branch" this person belongs to and gives them automatic chat access to that agent.
        </p>
      </Field>

      <div className="bg-cream/40 border border-forest-100 rounded p-4">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={canAccessAll}
            onChange={(e) => setCanAccessAll(e.target.checked)}
            className="mt-1"
          />
          <div>
            <div className="text-sm font-medium text-forest">Can chat with ALL agents</div>
            <div className="text-xs text-forest-500">
              Override the reporting-line scope. Useful for executive operators (CEO, MD-tier, your Chief of Staff). Disabled by default.
            </div>
          </div>
        </label>

        <label className="flex items-start gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            name="canAccessAllEntities"
            defaultChecked={initial?.canAccessAllEntities ?? false}
          />
          <div>
            <div className="text-sm font-medium text-forest">Can see ALL entities (FZE + Inc. + GROUP)</div>
            <div className="text-xs text-forest-500">Cross-entity reads. Default OFF — most people stay in their entity.</div>
          </div>
        </label>
      </div>

      {!canAccessAll && (
        <Field label={`Extra agents they can chat with beyond their reporting line (${extraAgentIds.length} selected)`}>
          <div className="max-h-72 overflow-y-auto border border-forest-200 rounded p-3 space-y-3">
            <AgentGroup label="Orchestrator (Tier 0)" agents={orchestrator} selected={extraAgentIds} onToggle={toggleAgent} />
            <AgentGroup label="C-Suite (Tier 1)" agents={executive} selected={extraAgentIds} onToggle={toggleAgent} />
            <AgentGroup label="Functional (Tier 2)" agents={functional} selected={extraAgentIds} onToggle={toggleAgent} />
          </div>
        </Field>
      )}

      <Field label="Initial password" required>
        <div className="flex gap-2">
          <input
            name="initialPassword"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            placeholder="≥ 8 characters — share securely; they'll rotate on first login"
            className="flex-1 px-3 py-2 border border-forest-200 rounded text-sm focus:outline-none focus:border-amber"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="px-3 py-2 text-xs border border-forest-200 rounded hover:bg-cream"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <p className="text-xs text-forest-400 mt-1">
          They will sign in with this once and you should require them to rotate it (via the team edit page once that supports it, or shell command for now).
        </p>
      </Field>

      {error && (
        <div className="p-3 bg-terra/10 border border-terra/30 rounded text-sm text-terra-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded text-white text-sm font-medium disabled:opacity-50"
          style={{ background: '#0F2E2E' }}
        >
          {isPending ? 'Creating…' : 'Add member'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-forest-700 mb-1">
        {label}
        {required && <span className="text-terra-600 ml-0.5">*</span>}
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
}: {
  label: string;
  agents: AgentOpt[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (agents.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-forest-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        {agents.map((a) => (
          <label key={a.id} className="flex items-center gap-2 px-2 py-1 hover:bg-cream/40 rounded cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={selected.includes(a.id)}
              onChange={() => onToggle(a.id)}
            />
            <span className="font-mono text-xs text-forest-500 w-16">{a.slug}</span>
            <span className="text-forest-700 truncate">{a.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
