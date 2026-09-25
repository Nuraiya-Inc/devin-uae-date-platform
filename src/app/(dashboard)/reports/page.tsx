import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import { fmtDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!isExec(session.user.role)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-forest mb-2">Access restricted</h1>
        <p className="text-sm text-forest-600">Reports are visible to CEO and MD-tier users only.</p>
      </div>
    );
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();

  // ────────────────────────────────────────────────────────
  // Pull data in parallel
  // ────────────────────────────────────────────────────────

  const [
    investorsByStage,
    raidBySeverity,
    raidByKind,
    tasksByStatus,
    tasksByPriority,
    slippingTasks,
    tasksByBranch,
    agentActivity,
    totalTokensThisWeek,
  ] = await Promise.all([
    prisma.investor.groupBy({
      by: ['stage'],
      _count: { stage: true },
      where: { isActive: true },
    }),
    prisma.raidEntry.groupBy({
      by: ['severity'],
      _count: { severity: true },
      where: { status: { not: 'CLOSED' } },
    }),
    prisma.raidEntry.groupBy({
      by: ['kind'],
      _count: { kind: true },
      where: { status: { not: 'CLOSED' } },
    }),
    prisma.task.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.task.groupBy({
      by: ['priority'],
      _count: { priority: true },
      where: { status: { notIn: ['DONE', 'CANCELLED'] } },
    }),
    prisma.task.findMany({
      where: {
        status: { notIn: ['DONE', 'CANCELLED'] },
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
      include: {
        ownerAgent: { select: { slug: true } },
        assignee: { select: { name: true } },
      },
    }),
    // Tasks by owning agent's branch (open only)
    prisma.task.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] } },
      select: {
        id: true,
        ownerAgent: { select: { branch: true } },
      },
    }),
    // Top agents by message volume (last 7 days)
    prisma.auditLog.groupBy({
      by: ['agentId'],
      where: {
        createdAt: { gte: sevenDaysAgo },
        action: 'agent.message',
        agentId: { not: null },
      },
      _count: { agentId: true },
      orderBy: { _count: { agentId: 'desc' } },
      take: 10,
    }),
    prisma.message.aggregate({
      where: { createdAt: { gte: sevenDaysAgo } },
      _sum: { tokensIn: true, tokensOut: true, cachedTokensIn: true },
    }),
  ]);

  // Resolve agent metadata for activity report
  const agentIds = agentActivity.map((a) => a.agentId!).filter(Boolean);
  const agents = agentIds.length > 0
    ? await prisma.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, slug: true, name: true, branch: true },
      })
    : [];
  const agentMeta = new Map(agents.map((a) => [a.id, a]));

  // ────────────────────────────────────────────────────────
  // Counts for the four cards across the top
  // ────────────────────────────────────────────────────────

  const investorTotal = investorsByStage.reduce((acc, x) => acc + x._count.stage, 0);
  const raidCritical = raidBySeverity.find((r) => r.severity === 'CRITICAL')?._count.severity ?? 0;
  const raidHigh = raidBySeverity.find((r) => r.severity === 'HIGH')?._count.severity ?? 0;
  const tasksOpen = tasksByStatus
    .filter((s) => s.status !== 'DONE' && s.status !== 'CANCELLED')
    .reduce((acc, x) => acc + x._count.status, 0);

  const totalIn = totalTokensThisWeek._sum.tokensIn ?? 0;
  const totalOut = totalTokensThisWeek._sum.tokensOut ?? 0;
  const totalCached = totalTokensThisWeek._sum.cachedTokensIn ?? 0;

  // Tasks by branch
  const byBranchCount = new Map<string, number>();
  for (const t of tasksByBranch) {
    const b = t.ownerAgent?.branch ?? 'UNASSIGNED';
    byBranchCount.set(b, (byBranchCount.get(b) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-forest mb-1">Reports</h1>
      <p className="text-sm text-forest-500 mb-6">
        Executive summary across investor pipeline, risk, workstream, and agent activity.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Investors in flight" value={investorTotal} accent="forest" />
        <SummaryCard label="Open RAID — Critical" value={raidCritical} accent={raidCritical > 0 ? 'terra' : 'forest'} />
        <SummaryCard label="Open RAID — High" value={raidHigh} accent={raidHigh > 0 ? 'amber' : 'forest'} />
        <SummaryCard label="Open tasks" value={tasksOpen} accent="forest" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ───── Series A ───── */}
        <ReportCard title="Series A pipeline" subtitle="$14M raise · staged plan (Seed $5M → A $14M → B $20M → C $45M)">
          {investorsByStage.length === 0 ? (
            <Empty text="No active investors. Chat with FIN-01 to populate." />
          ) : (
            <div className="space-y-1">
              {investorsByStage
                .sort((a, b) => b._count.stage - a._count.stage)
                .map((s) => (
                  <Row key={s.stage} label={s.stage.replace('_', ' ').toLowerCase()} value={s._count.stage} />
                ))}
            </div>
          )}
          <Link href="/investors" className="text-xs text-terra-600 hover:underline mt-3 inline-block">
            View pipeline →
          </Link>
        </ReportCard>

        {/* ───── RAID ───── */}
        <ReportCard title="RAID register" subtitle="Open items by severity + kind">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-forest-400 mb-1">By severity</div>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => {
                const c = raidBySeverity.find((r) => r.severity === sev)?._count.severity ?? 0;
                return <Row key={sev} label={sev} value={c} />;
              })}
            </div>
            <div>
              <div className="text-xs text-forest-400 mb-1">By kind</div>
              {['RISK', 'ISSUE', 'DEPENDENCY', 'ASSUMPTION'].map((k) => {
                const c = raidByKind.find((r) => r.kind === k)?._count.kind ?? 0;
                return <Row key={k} label={k} value={c} />;
              })}
            </div>
          </div>
          <Link href="/raid" className="text-xs text-terra-600 hover:underline mt-3 inline-block">
            View RAID →
          </Link>
        </ReportCard>

        {/* ───── Tasks ───── */}
        <ReportCard title="Tasks" subtitle="Open work + slipping deliverables">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-forest-400 mb-1">By priority (open)</div>
              {['P0', 'P1', 'P2', 'P3'].map((p) => {
                const c = tasksByPriority.find((x) => x.priority === p)?._count.priority ?? 0;
                return <Row key={p} label={p} value={c} />;
              })}
            </div>
            <div>
              <div className="text-xs text-forest-400 mb-1">By branch (open)</div>
              {['FINANCE', 'TECHNOLOGY', 'COMMERCIAL', 'MARKETING', 'OPERATIONS', 'EXECUTIVE'].map((b) => (
                <Row key={b} label={b.toLowerCase()} value={byBranchCount.get(b) ?? 0} />
              ))}
            </div>
          </div>
          {slippingTasks.length > 0 && (
            <div className="mt-3 p-3 bg-terra/10 border border-terra/30 rounded text-xs">
              <div className="font-semibold text-terra-700 mb-1">⚠ {slippingTasks.length} task{slippingTasks.length === 1 ? '' : 's'} past due</div>
              <ul className="space-y-1">
                {slippingTasks.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <Link href={`/tasks/${t.id}`} className="text-forest-700 hover:text-terra-600">
                      <span className="font-mono text-forest-500">{t.ownerAgent?.slug ?? '—'}</span>
                      {' · '}
                      {t.title}
                      <span className="text-forest-400"> — due {fmtDate(t.dueDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ReportCard>

        {/* ───── Agent activity ───── */}
        <ReportCard
          title="Agent activity (7 days)"
          subtitle={`${totalIn.toLocaleString()} in / ${totalOut.toLocaleString()} out tokens${totalCached > 0 ? ` · ${totalCached.toLocaleString()} cached` : ''}`}
        >
          {agentActivity.length === 0 ? (
            <Empty text="No agent activity in the last 7 days." />
          ) : (
            <div className="space-y-1">
              {agentActivity.map((a) => {
                const meta = agentMeta.get(a.agentId!);
                return (
                  <Row
                    key={a.agentId}
                    label={meta ? `${meta.slug} · ${meta.name}` : a.agentId!}
                    value={a._count.agentId}
                  />
                );
              })}
            </div>
          )}
          <Link href="/activity" className="text-xs text-terra-600 hover:underline mt-3 inline-block">
            Full activity log →
          </Link>
        </ReportCard>

      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: 'forest' | 'amber' | 'terra' }) {
  const colors = {
    forest: 'border-forest-100',
    amber: 'border-amber/40 bg-amber/5',
    terra: 'border-terra/40 bg-terra/5',
  };
  return (
    <div className={`bg-white border rounded-lg p-3 ${colors[accent]}`}>
      <div className="text-xs text-forest-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-forest mt-1">{value}</div>
    </div>
  );
}

function ReportCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-forest-100 rounded-lg p-5">
      <h2 className="font-semibold text-forest">{title}</h2>
      <p className="text-xs text-forest-400 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-forest-600 capitalize">{label}</span>
      <span className="text-forest-700 font-mono tabular-nums">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-forest-400 italic">{text}</div>;
}
