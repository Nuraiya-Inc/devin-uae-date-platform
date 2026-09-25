'use client';

/**
 * ChangePasswordForm — three fields (current, new, confirm) + submit.
 *
 * Client-side guards:
 *   - new + confirm must match
 *   - new must be at least 8 chars
 *   - new must differ from current
 *
 * The server enforces all of the above again — these are just to fail
 * fast and avoid a network round-trip on obvious mistakes.
 */

import { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function localValidate(): string | null {
    if (!currentPassword) return 'Enter your current password.';
    if (!newPassword) return 'Enter a new password.';
    if (newPassword.length < 8) return 'New password must be at least 8 characters.';
    if (newPassword === currentPassword) return 'New password must be different from your current password.';
    if (newPassword !== confirmPassword) return 'New password and confirmation do not match.';
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const localErr = localValidate();
    if (localErr) {
      setError(localErr);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Change failed.');
    } finally {
      setBusy(false);
    }
  }

  const inputType = showPasswords ? 'text' : 'password';
  const inputClass =
    'w-full text-sm px-3 py-2 border border-line rounded-md focus:outline-none focus:border-brand-200 focus:ring-2 focus:ring-lime/20';

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Current password
        </label>
        <input
          type={inputType}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          New password
        </label>
        <input
          type={inputType}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-xs text-muted uppercase tracking-wide mb-1.5">
          Confirm new password
        </label>
        <input
          type={inputType}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowPasswords((v) => !v)}
          className="text-xs text-muted hover:text-ink inline-flex items-center gap-1.5"
        >
          {showPasswords ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              Hide passwords
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              Show passwords
            </>
          )}
        </button>

        <button
          type="submit"
          disabled={busy}
          className="text-sm px-5 py-2 rounded-full text-white font-medium disabled:opacity-50 inline-flex items-center gap-1.5"
          style={{ background: '#004923' }}
        >
          {success && !busy ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : null}
          {busy ? 'Updating…' : success ? 'Updated' : 'Update password'}
        </button>
      </div>

      {error && <div className="text-xs text-red-700">{error}</div>}
      {success && !error && (
        <div className="text-xs text-brand">
          Your password has been updated. Use it the next time you sign in.
        </div>
      )}
    </form>
  );
}
