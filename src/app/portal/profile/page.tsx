/**
 * Portal — company profile. Extensive but forgiving: everything optional,
 * completeness meter shows what a full record looks like, and Abdullah can
 * fill any of it conversationally instead.
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { updateProfile } from '@/lib/portal-actions';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');

  const facts = (partner.profileFacts as Record<string, unknown> | null) ?? {};
  const f = (k: string) => (facts[k] != null ? String(facts[k]) : '');

  const completenessFields = [
    partner.contactName,
    partner.contactPhone || partner.contactEmail,
    partner.city,
    f('palm_count') || f('capacity_tpy'),
    f('varieties'),
    f('irrigation') || f('certifications'),
    f('about'),
  ];
  const complete = completenessFields.filter(Boolean).length;
  const completePct = Math.round((complete / completenessFields.length) * 100);

  const isFarm = partner.type === 'FARM';

  return (
    <div className="space-y-5">
      <header className="fade-up">
        <div className="section-rule" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight text-brand-800">Company profile</h1>
        <p className="text-sm text-muted">
          ملف المنشأة · {partner.registryNo} · A complete profile strengthens your standing and
          speeds every application.
        </p>
      </header>

      {/* Completeness */}
      <section className="fade-up fade-up-1 rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-ink">Profile completeness</span>
          <span className="font-semibold text-brand-700">{completePct}%</span>
        </div>
        <div className="h-[8px] overflow-hidden rounded-full bg-gold-100">
          <div
            className="viz-grow h-full rounded-full bg-gold-500"
            style={{ width: `${Math.max(completePct, 3)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          Prefer to talk it through?{' '}
          <Link href="/portal/chat" className="text-brand-600 underline">
            Abdullah can complete this with you in chat
          </Link>{' '}
          — in Arabic or English.
        </p>
      </section>

      {/* The form */}
      <form action={updateProfile} className="fade-up fade-up-2 space-y-5">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-brand-800">Identity & contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Registered name" value={partner.nameEn} readOnly />
            <Field label="الاسم بالعربية" value={partner.nameAr ?? ''} readOnly rtl />
            <Field label="Type" value={`${partner.type}${partner.sizeClass ? ` · ${partner.sizeClass}` : ''}`} readOnly />
            <Field label="Region" value={partner.region} readOnly />
            <Field name="city" label="City" defaultValue={partner.city ?? ''} placeholder="Al Ain" />
            <Field name="contactName" label="Primary contact" defaultValue={partner.contactName ?? ''} placeholder="Full name" />
            <Field name="contactPhone" label="WhatsApp / phone" defaultValue={partner.contactPhone ?? ''} placeholder="+9665…" />
            <Field name="contactEmail" label="Email" defaultValue={partner.contactEmail ?? ''} placeholder="name@example.com" />
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
                Preferred language
              </label>
              <select
                name="preferredLang"
                defaultValue={partner.preferredLang}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
          <h2 className="mb-4 text-base font-semibold text-brand-800">
            {isFarm ? 'Farm details' : 'Facility details'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {isFarm ? (
              <>
                <Field name="palm_count" label="Palm trees" defaultValue={f('palm_count')} placeholder="340" type="number" />
                <Field name="varieties" label="Varieties" defaultValue={f('varieties')} placeholder="Sukkari, Khalas…" />
                <Field name="irrigation" label="Irrigation" defaultValue={f('irrigation')} placeholder="drip / flood / pivot" />
              </>
            ) : (
              <>
                <Field name="capacity_tpy" label="Capacity (tons / year)" defaultValue={f('capacity_tpy')} placeholder="12000" type="number" />
                <Field name="varieties" label="Products / streams handled" defaultValue={f('varieties')} placeholder="compost, biochar…" />
              </>
            )}
            <Field name="certifications" label="Certifications held" defaultValue={f('certifications')} placeholder="HACCP, ISO 22000…" />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
              About your operation
            </label>
            <textarea
              name="about"
              defaultValue={f('about')}
              rows={4}
              placeholder="History, specialties, what makes your operation distinctive…"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
          </div>
        </section>

        <button
          type="submit"
          className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          Save profile
        </button>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  value,
  placeholder,
  readOnly = false,
  rtl = false,
  type = 'text',
}: {
  name?: string;
  label: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  readOnly?: boolean;
  rtl?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-brand-700">
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        dir={rtl ? 'rtl' : undefined}
        className={`w-full rounded-lg border border-line px-3 py-2 text-sm ${
          readOnly ? 'bg-mist text-muted' : 'bg-white'
        }`}
      />
    </div>
  );
}
