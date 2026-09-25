'use server';

/**
 * Team management server actions.
 *
 * Permission model:
 *  - CEO + MD can create / edit / deactivate any user
 *  - AGENT_OWNER can view (and via a later iteration, edit users reporting to them)
 *  - Lower roles cannot manage users at all
 *
 * Every action writes an AuditLog row. Server-side validation via zod.
 */

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hasAtLeast } from '@/lib/access';
import type { UserRole, SafaEntity } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

const ENTITY_VALUES = ['FZE', 'INC', 'GROUP'] as const;
const ROLE_VALUES = ['CEO', 'MD', 'AGENT_OWNER', 'TEAM_MEMBER', 'CONTRACTOR', 'VIEWER'] as const;

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().toLowerCase().trim(),
  title: z.string().max(120).optional(),
  role: z.enum(ROLE_VALUES),
  entity: z.enum(ENTITY_VALUES),
  reportsToAgentId: z.string().optional(),
  canAccessAllAgents: z.boolean(),
  canAccessAllEntities: z.boolean(),
  extraAgentIds: z.array(z.string()),
  initialPassword: z.string().min(8).max(200),
});

const updateUserSchema = createUserSchema.omit({ initialPassword: true }).extend({
  id: z.string(),
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  if (!hasAtLeast(session.user.role, 'MD')) {
    throw new Error('Forbidden — only CEO and MD-tier users can manage team members');
  }
  return session.user;
}

// ─────────────────────────────────────────────────────────────
// createUser
// ─────────────────────────────────────────────────────────────

export async function createUserAction(formData: FormData) {
  const actor = await requireAdmin();

  // Parse + validate
  const parsed = createUserSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    title: String(formData.get('title') ?? '') || undefined,
    role: String(formData.get('role') ?? '') as UserRole,
    entity: String(formData.get('entity') ?? '') as SafaEntity,
    reportsToAgentId: String(formData.get('reportsToAgentId') ?? '') || undefined,
    canAccessAllAgents: formData.get('canAccessAllAgents') === 'on',
    canAccessAllEntities: formData.get('canAccessAllEntities') === 'on',
    extraAgentIds: formData.getAll('extraAgentIds').map(String).filter(Boolean),
    initialPassword: String(formData.get('initialPassword') ?? ''),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  const data = parsed.data;

  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return { ok: false, error: `A user with email ${data.email} already exists.` };
  }

  // Validate reporting agent if specified
  if (data.reportsToAgentId) {
    const agent = await prisma.agent.findUnique({ where: { id: data.reportsToAgentId } });
    if (!agent) return { ok: false, error: 'Selected reporting agent not found.' };
  }

  // Validate extra agent ids
  if (data.extraAgentIds.length > 0) {
    const agents = await prisma.agent.findMany({
      where: { id: { in: data.extraAgentIds } },
      select: { id: true },
    });
    if (agents.length !== data.extraAgentIds.length) {
      return { ok: false, error: 'One or more selected extra agents not found.' };
    }
  }

  const passwordHash = await bcrypt.hash(data.initialPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      title: data.title,
      role: data.role,
      entity: data.entity,
      passwordHash,
      reportsToAgentId: data.reportsToAgentId || null,
      canAccessAllAgents: data.canAccessAllAgents,
      canAccessAllEntities: data.canAccessAllEntities,
      extraAgentIds: data.extraAgentIds,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'user.create',
      entityType: 'User',
      entityId: user.id,
      summary: `${actor.name} added ${user.name} (${user.role})`,
      metadata: {
        targetEmail: user.email,
        role: user.role,
        entity: user.entity,
        canAccessAllAgents: user.canAccessAllAgents,
      },
    },
  });

  revalidatePath('/team');
  redirect(`/team/${user.id}?created=1`);
}

// ─────────────────────────────────────────────────────────────
// updateUser
// ─────────────────────────────────────────────────────────────

export async function updateUserAction(formData: FormData) {
  const actor = await requireAdmin();

  const parsed = updateUserSchema.safeParse({
    id: String(formData.get('id') ?? ''),
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    title: String(formData.get('title') ?? '') || undefined,
    role: String(formData.get('role') ?? '') as UserRole,
    entity: String(formData.get('entity') ?? '') as SafaEntity,
    reportsToAgentId: String(formData.get('reportsToAgentId') ?? '') || undefined,
    canAccessAllAgents: formData.get('canAccessAllAgents') === 'on',
    canAccessAllEntities: formData.get('canAccessAllEntities') === 'on',
    extraAgentIds: formData.getAll('extraAgentIds').map(String).filter(Boolean),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { id: data.id } });
  if (!existing) return { ok: false, error: 'User not found.' };

  // If email changing, check uniqueness
  if (existing.email !== data.email) {
    const collision = await prisma.user.findUnique({ where: { email: data.email } });
    if (collision) return { ok: false, error: `Email ${data.email} already in use.` };
  }

  const before = {
    role: existing.role,
    entity: existing.entity,
    reportsToAgentId: existing.reportsToAgentId,
    canAccessAllAgents: existing.canAccessAllAgents,
  };

  const user = await prisma.user.update({
    where: { id: data.id },
    data: {
      name: data.name,
      email: data.email,
      title: data.title,
      role: data.role,
      entity: data.entity,
      reportsToAgentId: data.reportsToAgentId || null,
      canAccessAllAgents: data.canAccessAllAgents,
      canAccessAllEntities: data.canAccessAllEntities,
      extraAgentIds: data.extraAgentIds,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'user.update',
      entityType: 'User',
      entityId: user.id,
      summary: `${actor.name} updated ${user.name}`,
      metadata: {
        before,
        after: {
          role: user.role,
          entity: user.entity,
          reportsToAgentId: user.reportsToAgentId,
          canAccessAllAgents: user.canAccessAllAgents,
        },
      },
    },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${user.id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// deactivateUser
// ─────────────────────────────────────────────────────────────

export async function deactivateUserAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'Missing user id.' };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: 'User not found.' };
  if (target.id === actor.id) {
    return { ok: false, error: 'You cannot deactivate yourself. Have another CEO/MD do it.' };
  }
  if (target.role === 'CEO') {
    return { ok: false, error: 'Cannot deactivate a CEO user via the UI. Use the database directly.' };
  }

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'user.deactivate',
      entityType: 'User',
      entityId: id,
      summary: `${actor.name} deactivated ${target.name}`,
      metadata: { targetEmail: target.email },
    },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// reactivateUser
// ─────────────────────────────────────────────────────────────

export async function reactivateUserAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, error: 'Missing user id.' };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: 'User not found.' };

  await prisma.user.update({
    where: { id },
    data: { isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'user.reactivate',
      entityType: 'User',
      entityId: id,
      summary: `${actor.name} reactivated ${target.name}`,
      metadata: { targetEmail: target.email },
    },
  });

  revalidatePath('/team');
  revalidatePath(`/team/${id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// resetPassword
// ─────────────────────────────────────────────────────────────

export async function resetPasswordAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  if (!id) return { ok: false, error: 'Missing user id.' };
  if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return { ok: false, error: 'User not found.' };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: 'user.password_reset',
      entityType: 'User',
      entityId: id,
      summary: `${actor.name} reset password for ${target.name}`,
      // Note: never log the password itself, even hashed.
      metadata: { targetEmail: target.email },
    },
  });

  return { ok: true };
}
