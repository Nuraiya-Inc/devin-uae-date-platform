import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isExec } from '@/lib/access';
import ApprovalCard from './ApprovalCard';

export const dynamic = 'force-dynamic';

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!isExec(session.user.role)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-brand mb-2">Access restricted</h1>
        <p className="text-sm text-muted">Approvals are exec-only.</p>
      </div>
    );
  }

  const [pending, recent] = await Promise.all([
    prisma.approvalRequest.findMany({
      where: { status: 'PENDING' },
      include: { agent: { select: { slug: true, name: true, branch: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.approvalRequest.findMany({
      where: { status: { in: ['APPROVED', 'REJECTED', 'EXECUTE_FAILED'] } },
      include: { agent: { select: { slug: true, name: true } } },
      orderBy: { decidedAt: 'desc' },
      take: 15,
    }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand tracking-tight mb-1">Approvals</h1>
        <p className="text-sm text-muted">
          Agent actions that need your sign-off before they run. External email sends, sensitive
          posts, and partner-language drafts queue here.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted bg-white border border-line rounded-xl">
            Nothing pending. Agents are operating within their decision rights.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <ApprovalCard
                key={a.id}
                approval={{
                  id: a.id,
                  kind: a.kind,
                  severity: a.severity,
                  summary: a.summary,
                  detail: a.detail,
                  payload: a.payload as Record<string, unknown>,
                  createdAt: a.createdAt.toISOString(),
                  agent: a.agent,
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold mb-3">
          Recent decisions
        </h2>
        {recent.length === 0 ? (
          <div className="text-xs text-muted italic">No recent approvals.</div>
        ) : (
          <div className="space-y-1">
            {recent.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-lg border border-line/60 px-4 py-2.5 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                      a.status === 'APPROVED'
                        ? 'bg-brand/10 text-brand'
                        : a.status === 'REJECTED'
                        ? 'bg-mist text-muted'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {a.status}
                  </span>
                  <span className="text-muted text-xs font-mono">{a.agent.slug}</span>
                  <span className="text-ink truncate">{a.summary}</span>
                </div>
                <span className="text-[10px] text-muted whitespace-nowrap flex-shrink-0 ml-3">
                  {a.decidedAt ? new Date(a.decidedAt).toLocaleString() : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
