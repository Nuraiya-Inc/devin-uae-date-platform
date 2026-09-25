import Link from 'next/link';
import { prisma } from '@/lib/db';
import Avatar from '@/components/Avatar';
import { agentAvatar } from '@/lib/avatar';
import { getAgentPhotoUrl } from '@/lib/team-avatars';

// Skip static optimisation — this page reads from Postgres which isn't reachable
// at build time. Render on every request instead.
export const dynamic = 'force-dynamic';

const BRANCH_LABEL: Record<string, string> = {
  EXECUTIVE: 'Executive',
  FINANCE: 'Finance',
  TECHNOLOGY: 'Technology',
  COMMERCIAL: 'Commercial',
  MARKETING: 'Marketing & Comms',
  OPERATIONS: 'Operations',
};

const BRANCH_ORDER = ['EXECUTIVE', 'FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS'];

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    orderBy: [{ tier: 'asc' }, { branch: 'asc' }, { slug: 'asc' }],
  });

  const byBranch: Record<string, typeof agents> = {};
  for (const a of agents) {
    (byBranch[a.branch] ||= []).push(a);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">Agents</h1>
      <p className="text-sm text-forest-500 mb-6">
        18 Phase-1 agents across 5 branches. Click any agent to view its profile.
      </p>

      {BRANCH_ORDER.filter((b) => byBranch[b]).map((branch) => (
        <section key={branch} className="mb-8">
          <h2 className="text-sm font-semibold text-forest mb-3 uppercase tracking-wide">
            {BRANCH_LABEL[branch]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {byBranch[branch].map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AgentCard({ agent: a }: { agent: { id: string; slug: string; name: string; title: string; mission: string; tier: string } }) {
  const showAvatar = a.tier === 'ORCHESTRATOR' || a.tier === 'EXECUTIVE';
  const av = showAvatar ? agentAvatar(a.name) : null;
  const photoUrl = showAvatar ? getAgentPhotoUrl(a.slug) : null;
  return (
    <Link
      href={`/agents/${a.slug}`}
      className="bg-white rounded-xl p-4 border border-line hover:border-brand-200 hover:shadow-card transition-all flex gap-3"
    >
      {av && <Avatar initials={av.initials} color={av.color} photoUrl={photoUrl} size={48} alt={a.name} />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted font-mono">{a.slug}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            a.tier === 'ORCHESTRATOR' ? 'bg-lime/20 text-brand-700' :
            a.tier === 'EXECUTIVE'    ? 'bg-brand-100 text-brand-700' :
                                        'bg-mist text-brand-600'
          }`}>
            {a.tier === 'ORCHESTRATOR' ? 'Orchestrator' : a.tier === 'EXECUTIVE' ? 'C-Suite' : 'Functional'}
          </span>
        </div>
        <div className="font-medium text-brand truncate">{a.name}</div>
        <div className="text-xs text-muted mt-0.5">{a.title}</div>
        <p className="text-sm text-ink/80 mt-1.5 line-clamp-2">{a.mission}</p>
      </div>
    </Link>
  );
}

