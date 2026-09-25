/**
 * scripts/set-user-password.ts
 *
 * One-shot CLI that sets (or resets) a single user's password. Use when you
 * need to onboard a reviewer / contractor with a clean initial password,
 * or when someone forgot theirs and there's no self-serve change-password UI
 * in the platform yet.
 *
 * Usage (inside Coolify Terminal, from /app):
 *   npx tsx scripts/set-user-password.ts <email> <new-password>
 *
 * Example:
 *   npx tsx scripts/set-user-password.ts saqib@safabioworks.com 'SaqibTemp2026!'
 *
 * Notes:
 * - Wrap the password in single quotes so the shell doesn't interpret special
 *   characters like ! $ # etc.
 * - The user must already exist (seeded). This won't create them.
 * - The new password is hashed with bcrypt (12 rounds) and written to
 *   User.passwordHash. The plaintext is NOT logged anywhere.
 * - Minimum length: 8 chars (matching the CEO seed gate).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {
  const [, , rawEmail, rawPassword] = process.argv;

  if (!rawEmail || !rawPassword) {
    console.error(
      'Usage: npx tsx scripts/set-user-password.ts <email> <new-password>\n' +
        '       (wrap the password in single quotes to avoid shell expansion)',
    );
    process.exit(2);
  }

  const email = rawEmail.toLowerCase().trim();
  const password = rawPassword;

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user with email "${email}". Run the seed first, or check the spelling.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { passwordHash: hash },
    });

    console.log(`✔ Password updated for ${email} (${user.name}, role=${user.role}).`);
    console.log('  Share the new password with them out-of-band — never paste it in chat or logs.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
