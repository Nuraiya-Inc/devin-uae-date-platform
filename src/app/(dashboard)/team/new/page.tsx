import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import AddUserForm from '../AddUserForm';

export const dynamic = 'force-dynamic';

export default async function NewTeamMemberPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  if (!hasAtLeast(session.user.role, 'MD')) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-forest mb-2">Access restricted</h1>
        <p className="text-sm text-forest-600">
          Only CEO and MD-tier users can add team members.
        </p>
        <Link href="/team" className="text-sm text-terra-600 underline mt-4 inline-block">← Back to team</Link>
      </div>
    );
  }

  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    orderBy: [{ tier: 'asc' }, { branch: 'asc' }, { slug: 'asc' }],
    select: { id: true, slug: true, name: true, tier: true, branch: true },
  });

  return (
    <div className="max-w-2xl">
      <Link href="/team" className="text-sm text-terra-600 underline mb-2 inline-block">← Back to team</Link>
      <h1 className="text-2xl font-semibold text-forest mb-1">Add a team member</h1>
      <p className="text-sm text-forest-500 mb-6">
        They'll receive sign-in access immediately. Pick the right reporting line and agent ACL — they only see what you grant them.
      </p>
      <AddUserForm agents={agents} />
    </div>
  );
}
