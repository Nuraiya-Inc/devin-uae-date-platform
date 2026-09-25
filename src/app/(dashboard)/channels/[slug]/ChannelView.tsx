'use client';

/**
 * ChannelView — the live message stream + post box for a single channel.
 *
 * Polling-based (refetches every 8s) for simplicity. Server-sent events or
 * websockets are a future upgrade once we have more concurrent users.
 *
 * Posting: optimistic — the new message appears in the list immediately
 * with a "sending" state, gets confirmed on server response, or marked
 * failed on error.
 */

import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User as UserIcon } from 'lucide-react';
import MarkdownText from '@/components/MarkdownText';

interface Author {
  kind: 'user' | 'agent' | 'system';
  id?: string;
  slug?: string;
  name?: string;
}

interface Message {
  id: string;
  body: string;
  authorKind: string;
  author: Author;
  mentionedAgents?: string[];
  isAutoReply?: boolean;
  createdAt: string;
}

interface Props {
  channel: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isLeadership: boolean;
  };
  initialMessages: Message[];
  currentUserId: string;
  currentUserName: string;
}

const POLL_MS = 8000;

export default function ChannelView({ channel, initialMessages, currentUserId, currentUserName }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Poll for new messages every 8s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/channels/${channel.slug}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        setMessages(data.messages ?? []);
      } catch {
        /* silent — next tick will retry */
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [channel.slug]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);

    // Optimistic insert
    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      body: text,
      authorKind: 'user',
      author: { kind: 'user', id: currentUserId, name: currentUserName },
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    setInput('');

    try {
      const res = await fetch(`/api/channels/${channel.slug}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // Replace optimistic with confirmed message
      setMessages((m) => m.map((msg) => (msg.id === optimistic.id ? data.message : msg)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      setError(msg);
      // Remove optimistic message on failure so user can retry
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] bg-white border border-line rounded-xl overflow-hidden">
      {/* Header */}
      <div className="border-b border-line px-5 py-3 flex-shrink-0">
        <h1 className="text-base font-semibold text-brand">{channel.name}</h1>
        {channel.description && (
          <p className="text-xs text-muted mt-0.5">{channel.description}</p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted italic">
            No messages yet. Start the thread.
          </div>
        ) : (
          messages.map((m) => <ChannelMessage key={m.id} message={m} mineId={currentUserId} />)
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-line/60 px-5 py-4 bg-white flex-shrink-0">
        <div className="rounded-2xl border border-line/70 bg-white shadow-card focus-within:border-brand-200 focus-within:ring-2 focus-within:ring-lime/20 transition-shadow">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={`Message ${channel.name} — Enter to send`}
            rows={2}
            disabled={sending}
            className="w-full px-5 pt-3 pb-2 text-sm bg-transparent focus:outline-none resize-none leading-relaxed placeholder:text-muted/70 disabled:opacity-50"
          />
          <div className="flex justify-between items-center px-3 pb-2.5">
            <div className="text-[10px] text-muted">
              {error ? <span className="text-red-700">{error}</span> : 'Tip: posts are visible to all members.'}
            </div>
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || sending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-card-hover"
              style={{ background: '#004923' }}
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelMessage({ message, mineId }: { message: Message; mineId: string }) {
  const isMine = message.author.kind === 'user' && message.author.id === mineId;
  const isAgent = message.author.kind === 'agent';

  return (
    <div className="flex items-start gap-3 animate-msg-in">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isAgent ? 'bg-brand/10 text-brand' : isMine ? 'bg-lime/30 text-brand-800' : 'bg-mist text-muted'
        }`}
      >
        {isAgent ? <Bot className="w-4 h-4" strokeWidth={1.8} /> : <UserIcon className="w-4 h-4" strokeWidth={1.8} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-semibold ${isAgent ? 'text-brand' : 'text-ink'}`}>
            {message.author.name ?? 'system'}
          </span>
          {isAgent && message.author.slug && (
            // Agent code name as a small monospace subtitle, sitting next
            // to the display name. Makes it clear which agent slot replied
            // in operational channels without burying the human-friendly
            // display name.
            <span className="text-[10px] font-mono text-muted">
              {message.author.slug}
            </span>
          )}
          {isAgent && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-brand/10 text-brand">
              Agent
            </span>
          )}
          {message.isAutoReply && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-mist text-muted">
              auto
            </span>
          )}
          <span className="text-[10px] text-muted ml-auto">{fmtTime(message.createdAt)}</span>
        </div>
        <div className="text-sm text-ink">
          <MarkdownText>{message.body}</MarkdownText>
        </div>
      </div>
    </div>
  );
}

function fmtTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
