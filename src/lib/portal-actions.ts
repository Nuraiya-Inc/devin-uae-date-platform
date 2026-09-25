'use server';

/**
 * Partner portal — server actions.
 *
 * Every action resolves the signed-in user's linked Partner record and acts
 * ONLY on it (hard rule UPN-3). All mutations write audit rows via the
 * ActivityEvent stream where staff attention is useful.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type {
  ApplicationKind,
  ListingCategory,
  Region,
  SuggestionKind,
  WasteStream,
} from '@prisma/client';

async function requirePartner() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');
  return { partner, userId: session.user.id };
}

// ── Profile ──────────────────────────────────────────────────

export async function updateProfile(formData: FormData) {
  const { partner } = await requirePartner();

  const contactName = String(formData.get('contactName') ?? '').trim() || null;
  const contactEmail = String(formData.get('contactEmail') ?? '').trim() || null;
  const contactPhone = String(formData.get('contactPhone') ?? '').trim() || null;
  const city = String(formData.get('city') ?? '').trim() || null;
  const preferredLang = formData.get('preferredLang') === 'en' ? 'en' : 'ar';

  const factKeys = ['palm_count', 'varieties', 'irrigation', 'capacity_tpy', 'certifications', 'about'] as const;
  const existing = (partner.profileFacts as Record<string, unknown> | null) ?? {};
  const facts: Record<string, unknown> = { ...existing };
  for (const k of factKeys) {
    const v = String(formData.get(k) ?? '').trim();
    if (v) facts[k] = k === 'palm_count' || k === 'capacity_tpy' ? Number(v) || v : v;
  }

  await prisma.partner.update({
    where: { id: partner.id },
    data: { contactName, contactEmail, contactPhone, city, preferredLang, profileFacts: facts as never },
  });
  revalidatePath('/portal/profile');
  revalidatePath('/portal');
}

// ── Waste collection tickets ─────────────────────────────────

export async function createTicket(formData: FormData) {
  const { partner } = await requirePartner();
  const stream = String(formData.get('stream')) as WasteStream;
  const tons = Number(formData.get('estimatedTons'));
  if (!tons || tons <= 0) return;

  const ticket = await prisma.collectionTicket.create({
    data: {
      partnerId: partner.id,
      stream,
      estimatedTons: tons,
      region: partner.region as Region,
      city: partner.city,
      locationNote: String(formData.get('locationNote') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    },
  });
  await prisma.activityEvent.create({
    data: {
      kind: 'PARTNER_ONBOARDED', // reuse generic partner kind for feed visibility
      severity: 'INFO',
      title: `Collection ticket: ${partner.registryNo} · ${stream} · ${tons}t (${partner.region})`,
      entityType: 'CollectionTicket',
      entityId: ticket.id,
      payload: {},
    },
  });
  revalidatePath('/portal/collection');
}

export async function claimTicket(formData: FormData) {
  const { partner } = await requirePartner();
  if (partner.type !== 'RECYCLER' && partner.type !== 'COLLECTOR' && partner.type !== 'FACTORY') return;
  const id = String(formData.get('ticketId'));
  await prisma.collectionTicket.updateMany({
    where: { id, status: 'OPEN', partnerId: { not: partner.id } },
    data: { status: 'CLAIMED', claimedByPartnerId: partner.id, claimedAt: new Date() },
  });
  revalidatePath('/portal/collection');
}

export async function confirmCollected(formData: FormData) {
  const { partner } = await requirePartner();
  const id = String(formData.get('ticketId'));
  const actualTons = Number(formData.get('actualTons')) || null;

  const ticket = await prisma.collectionTicket.findUnique({ where: { id } });
  if (!ticket || ticket.status !== 'CLAIMED') return;
  if (ticket.partnerId !== partner.id && ticket.claimedByPartnerId !== partner.id) return;

  await prisma.collectionTicket.update({
    where: { id },
    data: { status: 'COLLECTED', collectedAt: new Date(), actualTons },
  });

  // Traceability: the collection becomes a MaterialTransfer edge.
  if (ticket.claimedByPartnerId) {
    const now = new Date();
    const q = Math.floor(now.getUTCMonth() / 3) + 1;
    await prisma.materialTransfer.create({
      data: {
        fromPartnerId: ticket.partnerId,
        toPartnerId: ticket.claimedByPartnerId,
        stream: ticket.stream,
        tons: actualTons ?? ticket.estimatedTons,
        year: now.getUTCFullYear(),
        quarter: q,
        reconciled: true,
      },
    });
  }
  revalidatePath('/portal/collection');
}

// ── Marketplace ──────────────────────────────────────────────

export async function createListing(formData: FormData) {
  const { partner } = await requirePartner();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  await prisma.listing.create({
    data: {
      partnerId: partner.id,
      category: String(formData.get('category')) as ListingCategory,
      title,
      qtyTons: Number(formData.get('qtyTons')) || null,
      askPriceAed: Number(formData.get('askPriceAed')) || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      region: partner.region as Region,
    },
  });
  revalidatePath('/portal/market');
}

export async function expressInterest(formData: FormData) {
  const { partner } = await requirePartner();
  const listingId = String(formData.get('listingId'));
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.status !== 'ACTIVE' || listing.partnerId === partner.id) return;
  await prisma.listingInterest.upsert({
    where: { listingId_partnerId: { listingId, partnerId: partner.id } },
    update: { message: String(formData.get('message') ?? '').trim() || null },
    create: {
      listingId,
      partnerId: partner.id,
      message: String(formData.get('message') ?? '').trim() || null,
    },
  });
  revalidatePath('/portal/market');
}

export async function closeListing(formData: FormData) {
  const { partner } = await requirePartner();
  await prisma.listing.updateMany({
    where: { id: String(formData.get('listingId')), partnerId: partner.id },
    data: { status: 'CLOSED' },
  });
  revalidatePath('/portal/market');
}

// ── Applications ─────────────────────────────────────────────

export async function submitApplication(formData: FormData) {
  const { partner } = await requirePartner();
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!title || !body) return;
  await prisma.application.create({
    data: {
      partnerId: partner.id,
      kind: String(formData.get('kind')) as ApplicationKind,
      title,
      body,
    },
  });
  revalidatePath('/portal/applications');
}

// ── Voice of the network ─────────────────────────────────────

export async function submitSuggestion(formData: FormData) {
  const { partner } = await requirePartner();
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;
  await prisma.suggestion.create({
    data: {
      partnerId: partner.id,
      kind: String(formData.get('kind')) as SuggestionKind,
      body,
    },
  });
  revalidatePath('/portal/voice');
}

// ── Announcements ────────────────────────────────────────────

export async function rsvp(formData: FormData) {
  const { partner } = await requirePartner();
  const announcementId = String(formData.get('announcementId'));
  const attending = formData.get('attending') === 'yes';
  await prisma.announcementRsvp.upsert({
    where: { announcementId_partnerId: { announcementId, partnerId: partner.id } },
    update: { attending },
    create: { announcementId, partnerId: partner.id, attending },
  });
  revalidatePath('/portal/news');
}
