'use client';

import './globals.css';
import ErrorRecovery from '@/components/ErrorRecovery';

/** Catches errors thrown in the root layout itself (must render <html>/<body>). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <ErrorRecovery error={error} reset={reset} />
      </body>
    </html>
  );
}
