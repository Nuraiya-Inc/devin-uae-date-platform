/**
 * Portal — chat with Abdullah. Same runtime as the console chat
 * (/api/portal/chat), wrapped in the partner portal's skin.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import ChatWindow from '@/components/ChatWindow';

export const dynamic = 'force-dynamic';

export default async function PortalChatPage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const agent = await prisma.agent.findUnique({ where: { slug: 'abd-00' } });
  if (!agent || !agent.isActive) redirect('/portal');

  let thread = await prisma.chatThread.findUnique({
    where: { userId_agentId: { userId: session.user.id, agentId: agent.id } },
  });
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: { userId: session.user.id, agentId: agent.id, title: 'Chat with Abdullah' },
    });
  }

  const recent = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const messages = recent.reverse();

  const initial = messages.map((m) => ({
    id: m.id,
    role: m.role as 'USER' | 'ASSISTANT',
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    modelUsed: m.modelUsed,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    cachedTokensIn: m.cachedTokensIn,
  }));

  return (
    <div className="space-y-4">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">
          Abdullah · عبدالله
        </h1>
        <p className="text-sm text-muted">
          Your network concierge — reports, questions, requests. Send an Excel, a photo of your
          ledger, or a voice note; he takes it from there. تحدث معه بالعربية أو الإنجليزية.
        </p>
      </header>
      <div className="fade-up fade-up-1">
        <ChatWindow
          agentSlug={agent.slug}
          agentName="Abdullah — Partner Concierge"
          agentTier={agent.tier}
          initialMessages={initial}
          initialPrefill=""
        />
      </div>
    </div>
  );
}
