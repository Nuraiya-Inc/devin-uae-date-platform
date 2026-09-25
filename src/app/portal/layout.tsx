/**
 * Partner portal layout — mobile-first, Arabic-aware, radically simple.
 *
 * Staff users (no linked Partner record) are redirected to the console.
 * Abdullah is one tap away from every screen.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Logo from '@/components/brand/Logo';
import {
  Home,
  Building2,
  FileSpreadsheet,
  Recycle,
  Store,
  Award,
  Leaf,
  MessageSquareHeart,
  Megaphone,
  MessageCircle,
  BookOpen,
  Gift,
} from 'lucide-react';
import PortalNavLink from './PortalNavLink';
import WelcomeTour from './WelcomeTour';
import LangToggle from './LangToggle';
import SignOutButton from '@/components/SignOutButton';
import { getPortalLang } from '@/lib/portal-lang';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/portal', label: 'Home', ar: 'الرئيسية', icon: Home },
  { href: '/portal/profile', label: 'Profile', ar: 'الملف', icon: Building2 },
  { href: '/portal/reports', label: 'Reports', ar: 'التقارير', icon: FileSpreadsheet },
  { href: '/portal/benefits', label: 'Benefits', ar: 'المزايا', icon: Gift },
  { href: '/portal/collection', label: 'Collection', ar: 'جمع النواتج', icon: Recycle },
  { href: '/portal/market', label: 'Market', ar: 'السوق', icon: Store },
  { href: '/portal/esg', label: 'Sustainability', ar: 'الاستدامة', icon: Leaf },
  { href: '/portal/applications', label: 'Applications', ar: 'الطلبات', icon: Award },
  { href: '/portal/voice', label: 'Your voice', ar: 'صوتك', icon: MessageSquareHeart },
  { href: '/portal/news', label: 'Announcements', ar: 'الإعلانات', icon: Megaphone },
  { href: '/portal/guide', label: 'Guide', ar: 'الدليل', icon: BookOpen },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/signin');
  const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } });
  if (!partner) redirect('/dashboard');
  const lang = await getPortalLang();

  return (
    <div className="min-h-screen" dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ background: '#F4F1EA' }}>
      <div className="gold-bar w-full" aria-hidden />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-3">
            <Logo width={150} priority />
          </Link>
          <div className="flex items-center gap-3">
            <LangToggle lang={lang} />
            <SignOutButton variant="text" label={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'} />
            <div className="hidden sm:block" style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
              <div className="text-sm font-medium text-ink">
                {lang === 'ar' ? (partner.nameAr ?? partner.nameEn) : partner.nameEn}
              </div>
              <div className="text-[11px] text-muted" dir="ltr">
                {partner.registryNo} · {partner.tier}
              </div>
            </div>
          </div>
        </div>
        {/* Desktop nav */}
        <nav className="mx-auto hidden max-w-5xl items-center gap-1 px-2 pb-2 md:flex">
          {NAV.map((n) => (
            <PortalNavLink key={n.href} href={n.href} label={lang === 'ar' ? n.ar : n.label} icon={n.label} textOnly />
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-12">{children}</main>

      {/* First-visit onboarding tour */}
      <WelcomeTour />

      {/* Abdullah — always one tap away */}
      <Link
        href="/portal/chat"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-brand-700 px-4 py-3 text-sm font-medium text-white shadow-card-hover transition hover:bg-brand-600 md:bottom-6"
      >
        <MessageCircle className="h-4 w-4" />
        <span>
          {lang === 'ar' ? (
            <>عبدالله <span className="text-white/70">· Abdullah</span></>
          ) : (
            <>Abdullah <span className="text-white/70">· عبدالله</span></>
          )}
        </span>
      </Link>

      {/* Mobile bottom nav — first five destinations */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.slice(0, 5).map((n) => (
            <PortalNavLink key={n.href} href={n.href} label={lang === 'ar' ? n.ar : n.label} icon={n.label} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}
