'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

/**
 * DashboardShell — the client-side wrapper that owns Sidebar + Command Palette
 * state, and hosts the main content area.
 *
 * The server-side layout fetches user + agents and hands them as props to
 * this component. We own the palette open state here so the sidebar's ⌘K
 * button, the global keyboard listener, and the palette itself all share
 * the same source of truth.
 */

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MobileTopBar from './MobileTopBar';
import CommandPalette from './CommandPalette';

const SIDEBAR_COLLAPSED_KEY = 'safa.sidebar.collapsed';

interface AgentForPalette {
  slug: string;
  name: string;
  title: string;
  tier: string;
}

interface Props {
  user: {
    name: string | null;
    role: string;
    photoUrl: string | null;
    avInitials: string;
    avColor: string;
    /** True if this user should see the Review queue sidebar entry —
     *  exec (CEO/MD) or has reviewerForBranches set. Computed in layout. */
    canReview: boolean;
    /** True if this user is exec (CEO/MD). Drives /diligence-audit visibility. */
    isExec: boolean;
    /** True if this user may open the financial-model calculator (exec + Saqib + Zara). */
    canModel: boolean;
  };
  /** True if the data-room production freeze is currently active. Server-computed
   *  in the layout so the sidebar can show a "Frozen" pill on the Data Room nav item. */
  dataRoomFrozen: boolean;
  agents: AgentForPalette[];
  children: React.ReactNode;
}

export default function DashboardShell({ user, agents, dataRoomFrozen, children }: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  // Hydrate sidebar collapsed state from localStorage on mount.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
        setSidebarCollapsed(true);
      }
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, []);

  // Persist on change.
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  // Close the mobile drawer on route change. Without this, navigating via
  // a link in the drawer leaves the drawer open over the new page.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile drawer is open so the backdrop
  // doesn't let the page scroll underneath.
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileNavOpen]);

  return (
    <div className="min-h-screen md:flex" style={{ background: '#F4F1EA' }}>
      <Sidebar
        user={user}
        dataRoomFrozen={dataRoomFrozen}
        onOpenPalette={() => setPaletteOpen(true)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      {/* Backdrop — only when drawer is open on mobile */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/40"
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="gold-bar w-full" aria-hidden />
        <MobileTopBar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Abdullah — Arabic-first quick chat, one tap from anywhere */}
      <Link
        href="/agents/abd-00/chat"
        dir="rtl"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white shadow-card-hover transition hover:bg-brand-600"
        aria-label="الدردشة مع عبدالله · Chat with Abdullah"
      >
        <MessageCircle className="h-5 w-5" />
        <span>الدردشة مع عبدالله <span className="font-normal text-white/70">· Abdullah</span></span>
      </Link>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        agents={agents}
      />
    </div>
  );
}
