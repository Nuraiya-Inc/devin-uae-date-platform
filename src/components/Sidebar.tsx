'use client';

/**
 * Sidebar — primary navigation for the dashboard shell.
 *
 * Client component because it uses `usePathname` for active-state highlighting
 * and registers a global `⌘K / Ctrl+K` listener that opens the Command Palette.
 *
 * Visual treatment:
 *   - Lucide icon + label per link (replaces the previous text-only nav)
 *   - Active link rendered with a soft white pill background; non-active
 *     links are translucent and reveal on hover
 *   - Section labels stay as small all-caps dividers
 *   - User chip at bottom, ⌘K affordance just above it
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Activity,
  Briefcase,
  ListTodo,
  ShieldAlert,
  Archive,
  HandCoins,
  Bot,
  Users,
  Command,
  Hash,
  ShieldCheck,
  ClipboardCheck,
  Inbox,
  Gauge,
  Calculator,
  Trophy,
  LifeBuoy,
  Rocket,
  FileBarChart,
  Sparkles,
  Map as MapIcon,
  BookUser,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import Logo from '@/components/brand/Logo';
import NotificationBell from '@/components/feed/NotificationBell';
import SignOutButton from '@/components/SignOutButton';

interface SidebarProps {
  user: {
    name: string | null;
    role: string;
    photoUrl: string | null;
    avInitials: string;
    avColor: string;
    /** Drives whether the Review queue nav entry renders. Hidden for
     *  non-exec, non-reviewer users so contractors / viewers don't see
     *  a queue page that's empty for them. */
    canReview: boolean;
    /** Drives whether the Diligence audit nav entry renders. Exec-only —
     *  the page itself redirects non-exec users, so this just hides the link. */
    isExec: boolean;
    /** Drives whether the Calculator nav entry renders. Exec + Saqib + Zara. */
    canModel: boolean;
  };
  /** True when the data-room production freeze is active (server-computed).
   *  Drives a small "Frozen" pill next to the Data Room nav item so the
   *  state is visible from any page. */
  dataRoomFrozen: boolean;
  onOpenPalette: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  /** When true on mobile, sidebar slides in as an overlay drawer.
   *  Ignored on md+ screens (sidebar is always visible there). */
  mobileOpen?: boolean;
  /** Called when a nav link is tapped on mobile — closes the drawer. */
  onCloseMobile?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  /** Arabic label — rendered as the secondary line per the bilingual IA. */
  labelAr?: string;
  icon: React.ElementType;
}

interface NavGroupDef {
  label?: string;
  labelAr?: string;
  items: NavItem[];
}

const NAV: NavGroupDef[] = [
  {
    items: [
      { href: '/dashboard',  label: 'National Impact',  labelAr: 'الأثر الوطني', icon: LayoutDashboard },
      { href: '/needs-you',  label: 'Needs you',  labelAr: 'يلزمك الانتباه', icon: Inbox },
      { href: '/feed',       label: 'Live feed',  labelAr: 'البث المباشر', icon: Activity },
      { href: '/approvals',  label: 'Approvals',  labelAr: 'الاعتمادات', icon: ShieldCheck },
      { href: '/review',     label: 'Review queue', labelAr: 'طابور المراجعة', icon: ClipboardCheck },
      { href: '/facts',      label: 'Fact graph', labelAr: 'الحقائق', icon: BookOpen },
      { href: '/activity',   label: 'Audit log',  labelAr: 'سجل التدقيق', icon: Activity },
      { href: '/guide',      label: 'Guide',      labelAr: 'الدليل', icon: LifeBuoy },
    ],
  },
  {
    label: 'Network',
    labelAr: 'الشبكة',
    items: [
      { href: '/partners',  label: 'Partners',  labelAr: 'الشركاء', icon: Users },
      { href: '/directory', label: 'Directory', labelAr: 'الدليل', icon: BookUser },
      { href: '/network',   label: 'Network inbox', labelAr: 'بريد الشبكة', icon: Inbox },
      { href: '/standings', label: 'Recognition', labelAr: 'الإنجازات', icon: Trophy },
      { href: '/ask', label: 'Ask the Sector', labelAr: 'اسأل القطاع', icon: Sparkles },
      { href: '/state-of-sector', label: 'State of Sector', labelAr: 'حالة القطاع', icon: FileBarChart },
      { href: '/showcase',  label: 'National counter', labelAr: 'العدّاد الوطني', icon: MapIcon },
      { href: '/roadmap',   label: 'Next Phase', labelAr: 'المرحلة القادمة', icon: Rocket },
      { href: '/tasks',     label: 'Tasks',     labelAr: 'المهام', icon: ListTodo },
      // Documents module is inherited from the base platform and still
      // carries its taxonomy (Sci memo / Investor / IP critical). Hidden
      // from the network console until it's re-skinned for the Center —
      // the route itself remains available at /documents.
      // { href: '/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Team',
    labelAr: 'الفريق',
    items: [
      { href: '/agents',    label: 'Agents',    labelAr: 'الوكلاء', icon: Bot },
      { href: '/team',      label: 'Staff',     labelAr: 'الفريق', icon: Users },
    ],
  },
];

export default function Sidebar({
  user,
  dataRoomFrozen,
  onOpenPalette,
  collapsed: collapsedDesktopPref = false,
  onToggleCollapsed,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

  // Track viewport: at md and below, force collapsed=false (mobile drawer
  // always renders full-width with labels). On md+ we honour the user's
  // localStorage preference.
  const [isMdPlus, setIsMdPlus] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsMdPlus(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMdPlus(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const collapsed = isMdPlus && collapsedDesktopPref;

  // Global ⌘K / Ctrl+K listener — opens the Command Palette from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenPalette]);

  // Mobile classes: when the drawer is closed we slide it off-screen and
  // remove pointer events; when open, slide back in. On md+ none of this
  // applies — the sidebar is part of the flex row.
  const mobileClasses = mobileOpen
    ? 'translate-x-0'
    : '-translate-x-full md:translate-x-0';

  return (
    <aside
      className={`${collapsed ? 'md:w-16' : 'md:w-64'} w-64 text-white p-5 flex flex-col md:transition-[width] duration-200 md:shrink-0 md:relative fixed inset-y-0 left-0 z-40 md:z-auto transform ${mobileClasses} transition-transform md:transform-none`}
      style={{ background: 'linear-gradient(180deg, #0C3B43 0%, #07272D 100%)' }}
    >
      {/* Collapse/expand toggle — md+ only; mobile drawer always renders expanded */}
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden md:block absolute top-2 right-2 text-white/50 hover:text-white p-1 rounded transition-colors z-10"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      )}

      {/* Close drawer button — mobile only, top-right */}
      {onCloseMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          className="md:hidden absolute top-2 right-2 text-white/60 hover:text-white p-1.5 rounded transition-colors z-10"
          aria-label="Close menu"
        >
          <span className="text-xl leading-none">×</span>
        </button>
      )}

      <div className={collapsed ? 'mb-6 mt-7 flex justify-center' : 'mb-8 px-1'}>
        {collapsed ? (
          <Logo variant="light" width={30} markOnly priority />
        ) : (
          <>
            <Logo variant="light" width={156} priority />
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold-300/90 mt-2 ml-1">
              Partner Network
            </div>
          </>
        )}
      </div>

      <nav className={`flex-1 ${collapsed ? 'space-y-3' : 'space-y-6'} text-sm overflow-y-auto`}>
        {NAV.map((group, gi) => {
          // Per-user nav filter: /review is only shown to exec or branch
          // reviewers (canReview). Other items are universal.
          const visibleItems = group.items.filter((item) => {
            if (item.href === '/review' && !user.canReview) return false;
            if (item.href === '/diligence-audit' && !user.isExec) return false;
            if (item.href === '/calculator' && !user.canModel) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
            <NavGroup key={gi} label={collapsed ? undefined : group.label} labelAr={collapsed ? undefined : group.labelAr}>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  labelAr={item.labelAr}
                  Icon={item.icon}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                  onNavigate={onCloseMobile}
                  trailingPill={
                    item.href === '/data-room' && dataRoomFrozen && !collapsed
                      ? 'Frozen'
                      : undefined
                  }
                />
              ))}
            </NavGroup>
          );
        })}
      </nav>

      {/* Notification bell — full when expanded; popover needs the width. Hidden when collapsed. */}
      {!collapsed && (
        <div className="mt-4 mb-2">
          <NotificationBell />
        </div>
      )}

      {/* ⌘K affordance — icon-only when collapsed */}
      <button
        type="button"
        onClick={onOpenPalette}
        className={`${collapsed ? 'mt-4 mb-2 justify-center' : 'mb-3 justify-between gap-2'} flex items-center px-3 py-2 rounded-lg text-xs text-white/70 hover:text-white hover:bg-white/8 transition-colors border border-white/10`}
        title="Open command palette (⌘K)"
      >
        <span className="inline-flex items-center gap-2">
          <Command className="w-3.5 h-3.5" />
          {!collapsed && <span>Quick search</span>}
        </span>
        {!collapsed && (
          <kbd className="font-sans text-[10px] px-1.5 py-0.5 rounded bg-white/10 border border-white/15">
            ⌘K
          </kbd>
        )}
      </button>

      <div className={`pt-4 mt-1 border-t border-white/10 flex items-center ${collapsed ? 'justify-center' : 'gap-1'}`}>
      <Link
        href="/account"
        title="Account settings"
        className={`flex flex-1 items-center ${collapsed ? 'justify-center' : 'gap-2.5'} rounded-lg hover:bg-white/5 px-2 py-2 -mx-2 min-w-0 transition-colors`}
      >
        {user.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoUrl}
            alt={user.name ?? 'You'}
            title={collapsed ? `${user.name ?? ''} · ${user.role}` : undefined}
            className={`${collapsed ? 'w-7 h-7' : 'w-9 h-9'} rounded-full border border-white/20 bg-cream flex-shrink-0 object-cover`}
          />
        ) : (
          <span
            className={`${collapsed ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'} rounded-full inline-flex items-center justify-center text-white font-medium flex-shrink-0`}
            style={{ background: user.avColor, letterSpacing: '-0.02em' }}
            aria-label={user.name ?? 'You'}
            title={collapsed ? `${user.name ?? ''} · ${user.role}` : undefined}
          >
            {user.avInitials}
          </span>
        )}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user.name}</div>
            <div className="text-xs text-white/60 mt-0.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime" />
              {user.role}
            </div>
          </div>
        )}
      </Link>
      {!collapsed && <SignOutButton variant="icon" />}
      </div>
    </aside>
  );
}

function NavGroup({ label, labelAr, children }: { label?: string; labelAr?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 px-3 mb-2">
          {label}
          {labelAr && <span className="ml-1.5 normal-case tracking-normal text-white/35" dir="rtl">{labelAr}</span>}
        </div>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  label,
  labelAr,
  Icon,
  active,
  collapsed,
  onNavigate,
  trailingPill,
}: {
  href: string;
  label: string;
  labelAr?: string;
  Icon: React.ElementType;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  /** Optional small pill rendered after the label (e.g. "Frozen"). Hidden when collapsed. */
  trailingPill?: string;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={`relative flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 pl-3 pr-3'} py-2 rounded-lg transition-colors ${
        active
          ? 'bg-white/20 text-white font-medium shadow-inner'
          : 'text-white/75 hover:text-white hover:bg-white/10'
      }`}
    >
      {/* Lime accent bar on the left for the active item — hidden when collapsed */}
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-lime"
        />
      )}
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${active ? 'text-lime' : 'opacity-90'}`}
        strokeWidth={active ? 2 : 1.8}
      />
      {!collapsed && (
        <span className="flex-1 inline-flex items-center justify-between gap-2">
          <span className="inline-flex items-baseline gap-1.5">
            <span>{label}</span>
            {labelAr && <span className="text-[11px] text-white/50" dir="rtl" lang="ar">{labelAr}</span>}
          </span>
          {trailingPill && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold bg-amber-300/20 text-amber-200 border border-amber-300/30">
              {trailingPill}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

/**
 * Active-link matcher. Exact match for "/" prefixes (so /dashboard doesn't
 * highlight when visiting /tasks), but allow sub-routes (so /tasks/123 still
 * lights up the Tasks nav).
 */
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
