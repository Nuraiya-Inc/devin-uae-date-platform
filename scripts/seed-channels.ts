/**
 * Seed default platform channels + memberships.
 *
 * Run ONCE after first deploy of the channels feature:
 *   npx tsx scripts/seed-channels.ts
 *
 * Idempotent — uses upserts. Re-running just reconciles memberships.
 *
 * Channel design:
 *   #leadership   — Nima, Kevin, Layla (MD), all 5 C-suite (private/exec)
 *   #finance      — John (CFO) + FIN-* agents + Layla + Nima
 *   #commercial   — Priya (CCO) + CCO sub-agents + Layla + Nima
 *   #technology   — Marcus (CTO) + TECH-* agents + Zara + Layla + Nima
 *   #marketing    — Ashley (CMO) + COMM-* agents + Layla + Nima
 *   #operations   — Omar (COO) + OPS-* agents + Layla + Nima
 *   #all-hands    — every user, every agent
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ChannelSpec {
  slug: string;
  name: string;
  description: string;
  isLeadership: boolean;
  /** Default responder when nobody specifically addressed — usually the branch head. */
  defaultResponderSlug: string | null;
  /** Slugs of agents that should be in this channel. */
  agentSlugs: 'all' | string[];
  /** Emails of users that should be in this channel. */
  userEmails: 'all' | string[];
}

const CHANNELS: ChannelSpec[] = [
  {
    slug: 'leadership',
    name: '#leadership',
    description: 'Exec-only — strategy, capital, hard decisions. Nima, Kevin, Layla, and the five branch heads.',
    isLeadership: true,
    defaultResponderSlug: 'md-00',
    agentSlugs: ['md-00', 'cfo-00', 'cto-00', 'cco-00', 'cmo-00', 'coo-00'],
    userEmails: ['nimav@safabioworks.com', 'kevinv@safabioworks.com'],
  },
  {
    slug: 'finance',
    name: '#finance',
    description: 'Capital strategy, fundraising, financial ops. CFO + finance functional agents.',
    isLeadership: false,
    defaultResponderSlug: 'cfo-00',
    agentSlugs: ['cfo-00', 'fin-01', 'fin-04', 'fin-05', 'md-00'],
    userEmails: ['nimav@safabioworks.com'],
  },
  {
    slug: 'commercial',
    name: '#commercial',
    description: 'Customer & partner pipeline — Emirates Biotech, Agthia, Almarai. CCO + commercial agents.',
    isLeadership: false,
    defaultResponderSlug: 'cco-00',
    agentSlugs: ['cco-00', 'md-00'],
    userEmails: ['nimav@safabioworks.com'],
  },
  {
    slug: 'technology',
    name: '#technology',
    description: 'Strain, process, IP, R&D. CTO + tech functional agents.',
    isLeadership: false,
    defaultResponderSlug: 'cto-00',
    agentSlugs: ['cto-00', 'tech-01', 'tech-04', 'tech-07', 'tech-08', 'md-00'],
    userEmails: ['nimav@safabioworks.com', 'zara@safabioworks.com'],
  },
  {
    slug: 'marketing',
    name: '#marketing',
    description: 'Brand, press, public materials. CMO + comms agents.',
    isLeadership: false,
    defaultResponderSlug: 'cmo-00',
    agentSlugs: ['cmo-00', 'comm-01', 'md-00'],
    userEmails: ['nimav@safabioworks.com'],
  },
  {
    slug: 'operations',
    name: '#operations',
    description: 'Legal, hiring, PRO, supply, plant. COO + ops agents.',
    isLeadership: false,
    defaultResponderSlug: 'coo-00',
    agentSlugs: ['coo-00', 'ops-01', 'ops-03', 'ops-05', 'ops-06', 'md-00'],
    userEmails: ['nimav@safabioworks.com'],
  },
  {
    slug: 'all-hands',
    name: '#all-hands',
    description: 'Cross-functional broadcast. Everyone — every user, every agent.',
    isLeadership: false,
    defaultResponderSlug: 'md-00',
    agentSlugs: 'all',
    userEmails: 'all',
  },
];

async function main() {
  // Find a system-creator user (the first CEO or just the first user)
  const creator = await prisma.user.findFirst({
    where: { role: 'CEO' },
    select: { id: true },
  });
  if (!creator) {
    console.error('No CEO user found — channels need a creator. Aborting.');
    process.exit(1);
  }

  // Pre-fetch all agents + users for membership resolution
  const [allAgents, allUsers] = await Promise.all([
    prisma.agent.findMany({ where: { isActive: true }, select: { id: true, slug: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true } }),
  ]);

  const agentBySlug = new Map(allAgents.map((a) => [a.slug, a]));
  const userByEmail = new Map(allUsers.map((u) => [u.email, u]));

  let created = 0;
  let updated = 0;

  for (const spec of CHANNELS) {
    const defaultResponderAgentId = spec.defaultResponderSlug
      ? agentBySlug.get(spec.defaultResponderSlug)?.id
      : null;

    // Upsert the channel itself
    const existing = await prisma.channel.findUnique({ where: { slug: spec.slug } });
    const channel = existing
      ? await prisma.channel.update({
          where: { id: existing.id },
          data: {
            name: spec.name,
            description: spec.description,
            isLeadership: spec.isLeadership,
            defaultResponderAgentId: defaultResponderAgentId ?? null,
          },
        })
      : await prisma.channel.create({
          data: {
            slug: spec.slug,
            name: spec.name,
            description: spec.description,
            isLeadership: spec.isLeadership,
            defaultResponderAgentId: defaultResponderAgentId ?? null,
            createdById: creator.id,
          },
        });

    if (existing) updated++;
    else created++;

    // Resolve agent membership
    const agentsToAdd =
      spec.agentSlugs === 'all'
        ? allAgents
        : spec.agentSlugs.map((s) => agentBySlug.get(s)).filter((a): a is { id: string; slug: string } => !!a);

    for (const a of agentsToAdd) {
      await prisma.channelAgent.upsert({
        where: { channelId_agentId: { channelId: channel.id, agentId: a.id } },
        create: { channelId: channel.id, agentId: a.id, isActive: true },
        update: { isActive: true },
      });
    }

    // Resolve user membership
    const usersToAdd =
      spec.userEmails === 'all'
        ? allUsers
        : spec.userEmails.map((e) => userByEmail.get(e)).filter((u): u is { id: string; email: string } => !!u);

    for (const u of usersToAdd) {
      await prisma.channelMember.upsert({
        where: { channelId_userId: { channelId: channel.id, userId: u.id } },
        create: { channelId: channel.id, userId: u.id, role: 'member' },
        update: {},
      });
    }

    console.log(`✓ ${spec.name} — ${agentsToAdd.length} agents, ${usersToAdd.length} users`);
  }

  console.log(`\nDone. ${created} created, ${updated} updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
