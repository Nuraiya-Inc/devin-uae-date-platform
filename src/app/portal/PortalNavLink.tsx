'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  BookOpen,
  Gift,
} from 'lucide-react';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home: Home,
  Profile: Building2,
  Reports: FileSpreadsheet,
  Collection: Recycle,
  Market: Store,
  Applications: Award,
  Sustainability: Leaf,
  'Your voice': MessageSquareHeart,
  Announcements: Megaphone,
  Guide: BookOpen,
  Benefits: Gift,
};

export default function PortalNavLink({
  href,
  label,
  icon,
  mobile = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  textOnly = false,
}: {
  href: string;
  label: string;
  icon?: string;
  mobile?: boolean;
  textOnly?: boolean;
}) {
  const pathname = usePathname();
  const active = href === '/portal' ? pathname === '/portal' : pathname.startsWith(href);
  const Icon = icon ? ICONS[icon] : undefined;

  if (mobile) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
          active ? 'text-brand-700' : 'text-muted'
        }`}
      >
        {Icon && <Icon className={`h-5 w-5 ${active ? 'text-brand-700' : 'text-muted'}`} />}
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm transition ${
        active
          ? 'bg-brand-700 text-white'
          : 'text-muted hover:bg-mist hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );
}
