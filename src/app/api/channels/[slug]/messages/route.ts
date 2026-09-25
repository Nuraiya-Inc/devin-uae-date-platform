/**
 * GET  /api/channels/[slug]/messages — list messages in a channel
 * POST /api/channels/[slug]/messages — post a new message (as user)
 *
 * Both routes require the caller to be a member of the channel.
 * POST also bumps the user's lastReadAt so the new message doesn't
 * count toward their own unread count.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Parse @slug mentions from a message body. Matches the agent-slug pattern
 * we use across the platform: lowercase letters + dash + 2+ digits (e.g.
 * "@cfo-00", "@md-00", "@tech-04"). Returns deduped lowercase slugs.
 */
function extractMentionsFromBody(body: string): string[] {
  const matches = body.matchAll(/@([a-z]+-\d+)/gi);
  return Array.from(new Set(Array.from(matches, (m) => m[1].toLowerCase())));
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const postSchema = z.object({
  body: z.string().min(1).max(8000),
  mentionedAgents: z.array(z.string()).max(8).default([]),
  mentionedUsers: z.array(z.string()).max(8).default([]),
});

async function loadChannelForUser(slug: string, userId: string) {
  const channel = await prisma.channel.findUnique({ where: { slug } });
  if (!channel) return { error: NextResponse.json({ error: 'Channel not found' }, { status: 404 }) };
  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId: channel.id, userId } },
  });
  if (!membership) {
    return { error: NextResponse.json({ error: "You're not a member of this channel" }, { status: 403 }) };
  }
  return { channel, membership };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const result = await loadChannelForUser(slug, session.user.id);
  if ('error' in result) return result.error;
  const { channel, membership } = result;

  const messages = await prisma.channelMessage.findMany({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      authorUser: { select: { id: true, name: true, email: true } },
      authorAgent: { select: { id: true, slug: true, name: true } },
    },
  });

  // Mark as read up to the latest message
  if (messages.length > 0) {
    await prisma.channelMember.update({
      where: { channelId_userId: { channelId: channel.id, userId: session.user.id } },
      data: { lastReadAt: messages[messages.length - 1].createdAt },
    });
  }

  return NextResponse.json({
    channel: {
      id: channel.id,
      slug: channel.slug,
      name: channel.name,
      description: channel.description,
      isLeadership: channel.isLeadership,
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      authorKind: m.authorKind,
      author: m.authorUser
        ? { kind: 'user' as const, id: m.authorUser.id, name: m.authorUser.name }
        : m.authorAgent
        ? { kind: 'agent' as const, id: m.authorAgent.id, slug: m.authorAgent.slug, name: m.authorAgent.name }
        : { kind: 'system' as const },
      mentionedAgents: m.mentionedAgents,
      mentionedUsers: m.mentionedUsers,
      isAutoReply: m.isAutoReply,
      createdAt: m.createdAt.toISOString(),
    })),
    lastReadAt: membership.lastReadAt?.toISOString() ?? null,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug } = await params;
  const result = await loadChannelForUser(slug, session.user.id);
  if ('error' in result) return result.error;
  const { channel } = result;

  const json = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
  }

  // Merge explicit mentions (from client) with parsed @-mentions in the body.
      const responders: never[] = [];
  const parsedMentions = extractMentionsFromBody(parsed.data.body);
  const mergedMentions = Array.from(
    new Set([...parsed.data.mentionedAgents.map((s) => s.toLowerCase()), ...parsedMentions]),
  );

  const msg = await prisma.channelMessage.create({
    data: {
      channelId: channel.id,
      authorUserId: session.user.id,
      body: parsed.data.body,
      mentionedAgents: mergedMentions,
      mentionedUsers: parsed.data.mentionedUsers,
      authorKind: 'user',
    },
    include: {
      authorUser: { select: { id: true, name: true } },
    },
  });

  // Bump the sender's lastReadAt past their own message
  await prisma.channelMember.update({
    where: { channelId_userId: { channelId: channel.id, userId: session.user.id } },
    data: { lastReadAt: msg.createdAt },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'channel.post',
      entityType: 'Channel',
      entityId: channel.id,
      summary: `${session.user.name} posted in ${channel.name}`,
      metadata: { messageId: msg.id, bodyPreview: parsed.data.body.slice(0, 120), mentions: mergedMentions },
    },
  });

  // (Agent channel responders are disabled in v0.)

  return NextResponse.json({
    ok: true,
    message: {
      id: msg.id,
      body: msg.body,
      authorKind: 'user',
      author: { kind: 'user', id: session.user.id, name: msg.authorUser?.name },
      createdAt: msg.createdAt.toISOString(),
    },
  });
}
