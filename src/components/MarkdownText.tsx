/**
 * MarkdownText — renders agent + user message bodies as proper markdown.
 *
 * Why: agents emit `**bold**`, `# headers`, lists, tables, inline `code`,
 * and links as part of normal output. Rendering them as raw text leaks
 * markdown syntax to the user. This component handles GitHub-flavoured
 * markdown (tables, strikethrough, autolinks, task lists) and styles each
 * element to sit cleanly inside chat bubbles + the briefing card.
 *
 * Variants:
 *   - 'default'  — dark text on light background (assistant messages, briefing)
 *   - 'inverted' — light text on dark background (user messages on brand-green)
 *
 * Links always open in a new tab. No raw HTML allowed (react-markdown sanitises
 * by default).
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  /** Markdown source. */
  children: string;
  /** Colour variant — pick based on the surrounding bubble bg. */
  variant?: 'default' | 'inverted';
  /** Additional className for the wrapper. */
  className?: string;
}

export default function MarkdownText({ children, variant = 'default', className }: Props) {
  const inverted = variant === 'inverted';

  // Tone tokens — keep all colour decisions in one place so the bubble colours
  // and the markdown text colours stay coherent.
  const textBase   = inverted ? 'text-white' : 'text-ink';
  const textMuted  = inverted ? 'text-white/70' : 'text-muted';
  const linkClass  = inverted ? 'text-white underline decoration-white/40 hover:decoration-white' : 'text-brand underline decoration-brand/30 hover:decoration-brand';
  const codeBg     = inverted ? 'bg-white/15 text-white' : 'bg-mist text-ink';
  const codeBlockBg = inverted ? 'bg-black/25 text-white' : 'bg-forest-50 text-ink';
  const blockquoteBorder = inverted ? 'border-white/40' : 'border-brand/30';
  const tableBorder = inverted ? 'border-white/30' : 'border-line';
  const tableHeaderBg = inverted ? 'bg-white/10' : 'bg-mist/60';

  return (
    <div className={`${textBase} leading-relaxed text-sm ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Block elements
          p:          ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1:         ({ children }) => <h1 className="text-lg font-semibold mt-3 mb-1.5 first:mt-0">{children}</h1>,
          h2:         ({ children }) => <h2 className="text-base font-semibold mt-3 mb-1.5 first:mt-0">{children}</h2>,
          h3:         ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h3>,
          h4:         ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0">{children}</h4>,
          ul:         ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
          ol:         ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
          li:         ({ children }) => <li className="leading-snug">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={`border-l-2 ${blockquoteBorder} pl-3 my-2 ${textMuted}`}>
              {children}
            </blockquote>
          ),
          hr:         () => <hr className={`my-3 ${inverted ? 'border-white/20' : 'border-line'}`} />,

          // Inline
          strong:     ({ children }) => <strong className="font-semibold">{children}</strong>,
          em:         ({ children }) => <em className="italic">{children}</em>,
          del:        ({ children }) => <del className="line-through opacity-70">{children}</del>,
          a:          ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {children}
            </a>
          ),

          // Code
          code: ({ children, className }) => {
            const isBlock = /language-/.test(className ?? '');
            if (isBlock) {
              return (
                <code className={`block ${codeBlockBg} rounded-md p-3 my-2 text-[12px] font-mono overflow-x-auto whitespace-pre`}>
                  {children}
                </code>
              );
            }
            return (
              <code className={`${codeBg} px-1 py-[1px] rounded text-[12px] font-mono`}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,

          // GFM tables
          table:    ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className={`w-full border-collapse text-xs border ${tableBorder}`}>
                {children}
              </table>
            </div>
          ),
          thead:    ({ children }) => <thead className={tableHeaderBg}>{children}</thead>,
          tbody:    ({ children }) => <tbody>{children}</tbody>,
          tr:       ({ children }) => <tr className={`border-b ${tableBorder} last:border-b-0`}>{children}</tr>,
          th:       ({ children }) => <th className="text-left px-2 py-1.5 font-semibold align-top">{children}</th>,
          td:       ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
