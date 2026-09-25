'use client';

/**
 * CommandPalette — ⌘K / Ctrl+K global launcher.
 *
 * Built on `cmdk` (Vercel's command primitive). Three registers of commands:
 *   1. Navigation     — every top-level dashboard route
 *   2. Agent jumps    — direct chat with each agent (orchestrator + C-suite + functional)
 *   3. Quick actions  — "New task", "Upload document", "Today's briefing"
 *
 * State is owned by the parent (DashboardShell) so the Sidebar's ⌘K button
 * and the global keyboard listener both open the same palette instance.
 *
 * Implementation note: uses plain `<Command>` inside a custom overlay rather
 * than `<Command.Dialog>` so we own positioning/portal explicitly. Dialog's
 * built-in Radix overlay was conflicting with our backdrop layer.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Activity,
  Briefcase,
  ListTodo,
  ShieldAlert,
  FileText,
  Archive,
  HandCoins,
  Bot,
  Users,
  MessageSquare,
  Plus,
  Upload,
  Sparkles,
  Hash,
  ShieldCheck,
} from 'lucide-react';

interface AgentForPalette {
  slug: string;
  name: string;
  title: string;
  tier: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AgentForPalette[];
}

const NAV_COMMANDS = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard,  hint: 'home' },
  { href: '/approvals',  label: 'Approvals',  icon: ShieldCheck,      hint: 'pending sign-offs' },
  { href: '/facts',      label: 'Facts',      icon: BookOpen,         hint: 'source of truth' },
  { href: '/reports',    label: 'Reports',    icon: BarChart3,        hint: 'analytics' },
  { href: '/activity',   label: 'Activity',   icon: Activity,         hint: 'team feed' },
  { href: '/projects',   label: 'Programme',  icon: Briefcase,        hint: 'projects' },
  { href: '/tasks',      label: 'Tasks',      icon: ListTodo,         hint: 'todo' },
  { href: '/raid',       label: 'RAID',       icon: ShieldAlert,      hint: 'risks issues' },
  { href: '/documents',  label: 'Documents',  icon: FileText,         hint: 'files' },
  { href: '/data-room',  label: 'Data Room',  icon: Archive,          hint: 'investor diligence' },
  { href: '/channels',   label: 'Channels',   icon: Hash,             hint: 'team chat' },
  { href: '/investors',  label: 'Investors',  icon: HandCoins,        hint: 'pipeline' },
  { href: '/agents',     label: 'Agents',     icon: Bot,              hint: 'ai roster' },
  { href: '/team',       label: 'Team',       icon: Users,            hint: 'people' },
];

const ACTION_COMMANDS = [
  { href: '/tasks?new=1',          label: 'New task',             icon: Plus,      hint: 'create' },
  { href: '/documents?upload=1',   label: 'Upload document',      icon: Upload,    hint: 'attach file' },
  { href: '/agents/md-00/chat',    label: 'Open chat with Layla', icon: Sparkles,  hint: 'orchestrator MD' },
];

export default function CommandPalette({ open, onOpenChange, agents }: Props) {
  const router = useRouter();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh] px-4 animate-msg-in"
      role="dialog"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close palette"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      {/* Palette card */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-line overflow-hidden">
        <Command className="flex flex-col" loop>
          <div className="border-b border-line/70 px-4 py-3 flex items-center gap-2">
            <Command.Input
              placeholder="Search agents, pages, actions…"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted/70"
              autoFocus
            />
            <kbd className="font-sans text-[10px] text-muted px-1.5 py-0.5 rounded bg-mist border border-line">
              esc
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-sm text-muted text-center">
              No matches — try a different search term.
            </Command.Empty>

            <Command.Group heading="Navigate" className="text-[10px] uppercase tracking-[0.15em] text-muted px-2 py-1">
              {NAV_COMMANDS.map((c) => {
                const Icon = c.icon;
                return (
                  <Command.Item
                    key={c.href}
                    value={`nav ${c.label} ${c.hint}`}
                    onSelect={() => go(c.href)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink cursor-pointer data-[selected=true]:bg-mist data-[selected=true]:text-brand"
                  >
                    <Icon className="w-4 h-4 text-muted" strokeWidth={1.8} />
                    <span>{c.label}</span>
                    <span className="ml-auto text-[10px] text-muted/70">{c.hint}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {agents.length > 0 && (
              <Command.Group heading="Talk to an agent" className="text-[10px] uppercase tracking-[0.15em] text-muted px-2 pt-3 pb-1">
                {agents.map((a) => (
                  <Command.Item
                    key={a.slug}
                    value={`agent ${a.name} ${a.title} ${a.slug}`}
                    onSelect={() => go(`/agents/${a.slug}/chat`)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink cursor-pointer data-[selected=true]:bg-mist data-[selected=true]:text-brand"
                  >
                    <MessageSquare className="w-4 h-4 text-muted" strokeWidth={1.8} />
                    <span className="truncate">{a.name}</span>
                    <span className="ml-auto text-[10px] text-muted/70">{a.title}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className="text-[10px] uppercase tracking-[0.15em] text-muted px-2 pt-3 pb-1">
              {ACTION_COMMANDS.map((c) => {
                const Icon = c.icon;
                return (
                  <Command.Item
                    key={c.href}
                    value={`action ${c.label} ${c.hint}`}
                    onSelect={() => go(c.href)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink cursor-pointer data-[selected=true]:bg-mist data-[selected=true]:text-brand"
                  >
                    <Icon className="w-4 h-4 text-muted" strokeWidth={1.8} />
                    <span>{c.label}</span>
                    <span className="ml-auto text-[10px] text-muted/70">{c.hint}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          </Command.List>

          <div className="border-t border-line/70 px-3 py-2 text-[10px] text-muted flex items-center gap-3">
            <span>
              <kbd className="font-sans px-1.5 py-0.5 rounded bg-mist border border-line">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-sans px-1.5 py-0.5 rounded bg-mist border border-line">↵</kbd> select
            </span>
            <span className="ml-auto">
              <kbd className="font-sans px-1.5 py-0.5 rounded bg-mist border border-line">⌘K</kbd> toggle
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
