/**
 * GET /api/channels
 *
 * List channels the current user is a member of, with last-message preview
 * and unread count (relative to ChannelMember.lastReadAt).
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // For each channel, compute unread count vs lastReadAt
  const enriched = await Promise.all(
    memberships.map(async (m) => {
      const since = m.lastReadAt ?? new Date(0);
      const unread = await prisma.channelMessage.count({
        where: {
          channelId: m.channelId,
          createdAt: { gt: since },
          // Don't count user's own messages as unread
          NOT: { authorUserId: session.user.id },
        },
      });
      const lastMsg = m.channel.messages[0];
      return {
        id: m.channel.id,
        slug: m.channel.slug,
        name: m.channel.name,
        description: m.channel.description,
        isLeadership: m.channel.isLeadership,
        memberCount: m.channel._count.members,
        agentCount: m.channel._count.agents,
        messageCount: m.channel._count.messages,
        unreadCount: unread,
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              body: lastMsg.body.slice(0, 140),
              authorName: lastMsg.authorUser?.name ?? lastMsg.authorAgent?.name ?? 'system',
              authorKind: lastMsg.authorKind,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
      };
    }),
  );

  // Sort: unread first, then by last message recency
  enriched.sort((a, b) => {
    if ((a.unreadCount > 0) !== (b.unreadCount > 0)) return a.unreadCount > 0 ? -1 : 1;
    const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({ channels: enriched });
}
