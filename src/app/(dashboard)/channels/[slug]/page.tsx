import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ChannelView from './ChannelView';

export const dynamic = 'force-dynamic';

export default async function ChannelPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');

  const { slug } = await params;

  const channel = await prisma.channel.findUnique({ where: { slug } });
  if (!channel) notFound();

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId: session.user.id } },
  });
  if (!membership) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold text-brand mb-2">Access restricted</h1>
        <p className="text-sm text-muted">
          You&apos;re not a member of {channel.name}. Ask Nima to add you.
        </p>
      </div>
    );
  }

  const messages = await prisma.channelMessage.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      authorUser: { select: { id: true, name: true } },
      authorAgent: { select: { id: true, slug: true, name: true } },
    },
  });

  // Mark this thread read up to the latest message
  if (messages.length > 0) {
    await prisma.channelMember.update({
      where: { channelId_userId: { channelId: channel.id, userId: session.user.id } },
      data: { lastReadAt: messages[messages.length - 1].createdAt },
    });
  }

  return (
    <ChannelView
      channel={{
        id: channel.id,
        slug: channel.slug,
        name: channel.name,
        description: channel.description,
        isLeadership: channel.isLeadership,
      }}
      initialMessages={messages.map((m) => ({
        id: m.id,
        body: m.body,
        authorKind: m.authorKind,
        author: m.authorUser
          ? { kind: 'user' as const, id: m.authorUser.id, name: m.authorUser.name }
          : m.authorAgent
          ? { kind: 'agent' as const, id: m.authorAgent.id, slug: m.authorAgent.slug, name: m.authorAgent.name }
          : { kind: 'system' as const },
        mentionedAgents: m.mentionedAgents,
        isAutoReply: m.isAutoReply,
        createdAt: m.createdAt.toISOString(),
      }))}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? 'You'}
    />
  );
}
