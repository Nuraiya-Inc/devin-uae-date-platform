/**
 * scripts/set-weekly-theme.ts
 *
 * Set (or replace) the theme for the current ISO week. The text is
 * injected into every agent's system prompt next to the date block,
 * so all 18 agents bias their morning work toward the same focus.
 *
 * Usage (inside Coolify Terminal, from /app):
 *   npx tsx scripts/set-weekly-theme.ts '<theme>' '[optional rationale]'
 *
 * Examples:
 *   npx tsx scripts/set-weekly-theme.ts 'Series A close-prep week'
 *
 *   npx tsx scripts/set-weekly-theme.ts \
 *     'Emirates Biotech LOI push' \
 *     'Every branch this week should produce work that either advances or de-risks the Emirates Biotech LOI. Without it, the $30M pre-money is unstable.'
 *
 * Notes:
 * - Wrap each argument in single quotes so the shell doesn't interpret
 *   special characters.
 * - Week is anchored on Monday (UTC). Setting on a Friday updates the
 *   CURRENT week's theme (this Monday through Sunday).
 * - Re-running with a different theme REPLACES the row for this week.
 * - The agent prompt cache is in-memory with a 5-min TTL, so the new
 *   theme appears in agent prompts within ~5 minutes max (or immediately
 *   on the first call after this script's process invalidates the cache
 *   in a fresh module load — most reliable is to wait the TTL).
 */

import { PrismaClient } from '@prisma/client';

function getMondayOfWeekUTC(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = d.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

async function main() {
  const [, , rawTheme, rawRationale] = process.argv;

  if (!rawTheme) {
    console.error(
      'Usage: npx tsx scripts/set-weekly-theme.ts \'<theme>\' \'[rationale]\'\n' +
        '  Wrap each argument in single quotes.\n' +
        '  Example: npx tsx scripts/set-weekly-theme.ts \'Series A close-prep week\'',
    );
    process.exit(2);
  }

  const theme = rawTheme.trim();
  const rationale = rawRationale ? rawRationale.trim() : null;

  if (theme.length < 4) {
    console.error('Theme must be at least 4 characters.');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const now = new Date();
    const monday = getMondayOfWeekUTC(now);
    const weekIso = monday.toISOString().slice(0, 10);

    const existing = await prisma.weeklyTheme.findUnique({
      where: { weekStart: monday },
    });

    const result = await prisma.weeklyTheme.upsert({
      where: { weekStart: monday },
      update: { theme, rationale },
      create: { weekStart: monday, theme, rationale },
    });

    const verb = existing ? 'updated' : 'set';
    console.log(`✔ Weekly theme ${verb} for week starting ${weekIso}:`);
    console.log(`   "${result.theme}"`);
    if (result.rationale) console.log(`   rationale: ${result.rationale.slice(0, 120)}${result.rationale.length > 120 ? '…' : ''}`);
    console.log('');
    console.log('Agents will pick this up within ~5 minutes (in-memory cache TTL).');
    console.log('Tomorrow\'s 7am sweep will bias every agent toward this theme.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
