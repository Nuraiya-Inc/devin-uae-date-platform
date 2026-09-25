/**
 * Avatar — clean monogram initials in a brand-coloured circle.
 *
 * Renders white initials on a deterministic brand-green / olive background.
 * Optional `photoUrl` (e.g. from User.avatarUrl) overrides initials with an image.
 */

import { cn } from '@/lib/utils';

interface AvatarProps {
  initials: string;
  color: string;
  /** Diameter in pixels. */
  size?: number;
  /** If provided, renders this image instead of initials. */
  photoUrl?: string | null;
  /** Optional outer ring colour (Tailwind utility, e.g. 'ring-lime/30'). */
  ring?: string;
  className?: string;
  /** Accessible label */
  alt?: string;
}

export default function Avatar({
  initials,
  color,
  size = 40,
  photoUrl,
  ring,
  className,
  alt,
}: AvatarProps) {
  const fontSize = Math.round(size * 0.4);

  if (photoUrl) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0',
          ring && `ring-2 ring-offset-2 ring-offset-white ${ring}`,
          className,
        )}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={alt ?? initials}
          width={size}
          height={size}
          className="w-full h-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full flex-shrink-0 font-medium text-white select-none tracking-tight',
        ring && `ring-2 ring-offset-2 ring-offset-white ${ring}`,
        className,
      )}
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: `${fontSize}px`,
        letterSpacing: '-0.02em',
      }}
      aria-label={alt ?? initials}
    >
      {initials}
    </span>
  );
}
