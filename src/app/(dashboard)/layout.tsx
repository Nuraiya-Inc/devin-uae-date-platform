import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { userAvatar, userAvatarUrl } from '@/lib/avatar';
import { isExec, canModel } from '@/lib/access';
import { getDataRoomFreezeStatus, getAutonomousAgentPauseStatus } from '@/facts';
import DashboardShell from '@/components/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  // Partner-portal users never see the staff console — their home is /portal.
  const linkedPartner = await prisma.partner.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (linkedPartner) redirect('/portal');

  // Fetch user (for sidebar chip) + agents (for the Command Palette quick-jump
  // list) in parallel. Agents query is light — slug/name/title/tier only.
  const [dbUser, agents] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, avatarUrl: true, reviewerForBranches: true },
    }),
    prisma.agent.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, title: true, tier: true },
      orderBy: [{ tier: 'asc' }, { slug: 'asc' }],
    }),
  ]);

  const photo = dbUser ? userAvatarUrl(dbUser) : null;
  const av = dbUser ? userAvatar(dbUser) : null;

  // Reviewer eligibility — used to gate the /review sidebar nav entry.
  // Execs (CEO/MD) always see-all; anyone else needs at least one branch
  // in reviewerForBranches. Contractors / viewers see no /review link
  // because the page itself would only show an empty state for them.
  const canReview = isExec(session.user.role) || (dbUser?.reviewerForBranches.length ?? 0) > 0;

  // Filter the Command Palette agent list to only those the current user
  // can actually CHAT with. Orchestrator (Layla / md-00) is CEO-only — we
  // don't want non-CEO users seeing it in ⌘K and landing on the restricted
  // page. They can still see her profile via /agents directly.
  const palettAgents = agents.filter((a) => {
    if (a.tier === 'ORCHESTRATOR') return session.user.role === 'CEO';
    return true;
  });

  return (
    <DashboardShell
      user={{
        name: session.user.name ?? null,
        role: session.user.role,
        photoUrl: photo,
        avInitials: av?.initials ?? '?',
        avColor: av?.color ?? '#004923',
        canReview,
        isExec: isExec(session.user.role),
        canModel: canModel(session.user.role, session.user.email ?? dbUser?.email ?? null),
      }}
      dataRoomFrozen={getDataRoomFreezeStatus().active || getAutonomousAgentPauseStatus().active}
      agents={palettAgents}
    >
      {children}
    </DashboardShell>
  );
}
