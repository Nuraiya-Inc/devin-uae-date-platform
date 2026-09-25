'use client';

/**
 * MobileTopBar — visible only on phones (md:hidden). Shows the logo, a
 * notification bell, and a hamburger that opens the sidebar as a slide-in
 * drawer.
 *
 * The sidebar itself is the same component as desktop; on mobile it
 * positions absolutely over the content with a backdrop. The DashboardShell
 * owns the open/close state so the hamburger here and the backdrop in the
 * shell can both flip it.
 */

import Logo from '@/components/brand/Logo';
import NotificationBell from '@/components/feed/NotificationBell';
import { Menu } from 'lucide-react';

export default function MobileTopBar({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  return (
    <div
      className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 text-white shadow-md"
      style={{ background: 'linear-gradient(180deg, #004923 0%, #003318 100%)' }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="p-2 -ml-2 rounded-md text-white/85 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" strokeWidth={2} />
      </button>
      <div className="flex-1 flex justify-center">
        <Logo variant="light" width={108} priority />
      </div>
      <div className="-mr-1">
        <NotificationBell />
      </div>
    </div>
  );
}
