import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Hash, Users, Bot, MessageSquare, Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ChannelsPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const memberships = await prisma.channelMember.findMany({
    where: { userId: session.user.id },
    include: {
      channel: {
        include: {
          _count: { select: { messages: true, members: true, agents: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              authorUser: { select: { name: true } },
              authorAgent: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });

  // Compute unread per channel
  const enriched = await Promise.all(
    memberships.map(async (m) => {
      const since = m.lastReadAt ?? new Date(0);
      const unread = await prisma.channelMessage.count({
        where: {
          channelId: m.channelId,
          createdAt: { gt: since },
          NOT: { authorUserId: session.user.id },
        },
      });
      return { membership: m, unread, lastMsg: m.channel.messages[0] };
    }),
  );

  // Sort: unread first, then most recent activity
  enriched.sort((a, b) => {
    if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
    const aTime = a.lastMsg?.createdAt.getTime() ?? 0;
    const bTime = b.lastMsg?.createdAt.getTime() ?? 0;
    return bTime - aTime;
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-brand tracking-tight mb-1">Channels</h1>
        <p className="text-sm text-muted">
          Where the team — humans and agents — coordinate. Mention an agent by name to pull them in.
        </p>
      </div>

      {enriched.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted bg-white border border-line rounded-xl">
          You&apos;re not in any channels yet. Ask Nima to add you to #all-hands.
        </div>
      ) : (
        <div className="space-y-2">
          {enriched.map(({ membership: m, unread, lastMsg }) => {
            const c = m.channel;
            return (
              <Link
                key={c.id}
                href={`/channels/${c.slug}`}
                className="block bg-white rounded-xl border border-line hover:border-brand-200 hover:shadow-card-hover transition-all p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      c.isLeadership ? 'bg-brand/10 text-brand' : 'bg-mist text-muted'
                    }`}
                  >
                    {c.isLeadership ? (
                      <Lock className="w-5 h-5" strokeWidth={1.8} />
                    ) : (
                      <Hash className="w-5 h-5" strokeWidth={1.8} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-brand">{c.name}</h3>
                      {c.isLeadership && (
                        <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand/10 text-brand font-medium">
                          Exec
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime text-brand-800 font-semibold ml-auto">
                          {unread} new
                        </span>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted leading-snug mb-2 line-clamp-2">{c.description}</p>
                    )}
                    {lastMsg ? (
                      <div className="text-xs text-ink/80 truncate">
                        <span className="font-medium text-brand-700">
                          {lastMsg.authorUser?.name ?? lastMsg.authorAgent?.name ?? 'system'}:
                        </span>{' '}
                        {lastMsg.body.slice(0, 140)}
                      </div>
                    ) : (
                      <div className="text-xs text-muted italic">No messages yet — be the first.</div>
                    )}
                    <div className="text-[10px] text-muted mt-2 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> {c._count.members}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Bot className="w-3 h-3" /> {c._count.agents}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> {c._count.messages}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
