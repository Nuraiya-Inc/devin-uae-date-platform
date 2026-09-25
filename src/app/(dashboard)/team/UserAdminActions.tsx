'use client';

import { useState, useTransition } from 'react';
import { deactivateUserAction, reactivateUserAction, resetPasswordAction } from './actions';

export default function UserAdminActions({
  userId,
  userName,
  isActive,
  isSelf,
  isCEO,
}: {
  userId: string;
  userName: string;
  isActive: boolean;
  isSelf: boolean;
  isCEO: boolean;
}) {
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(kind: 'ok' | 'err', text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  }

  function onDeactivate() {
    if (!confirm(`Deactivate ${userName}? They won't be able to sign in until reactivated.`)) return;
    const fd = new FormData();
    fd.set('id', userId);
    startTransition(async () => {
      const res = await deactivateUserAction(fd);
      if (res?.ok) flash('ok', 'Deactivated.');
      else flash('err', res?.error ?? 'Failed.');
    });
  }

  function onReactivate() {
    const fd = new FormData();
    fd.set('id', userId);
    startTransition(async () => {
      const res = await reactivateUserAction(fd);
      if (res?.ok) flash('ok', 'Reactivated.');
      else flash('err', res?.error ?? 'Failed.');
    });
  }

  function onResetPassword() {
    if (newPassword.length < 8) {
      flash('err', 'Password must be at least 8 characters.');
      return;
    }
    const fd = new FormData();
    fd.set('id', userId);
    fd.set('newPassword', newPassword);
    startTransition(async () => {
      const res = await resetPasswordAction(fd);
      if (res?.ok) {
        flash('ok', `Password reset. Share securely with ${userName}.`);
        setShowReset(false);
        setNewPassword('');
      } else {
        flash('err', res?.error ?? 'Failed.');
      }
    });
  }

  return (
    <div className="bg-white border border-forest-100 rounded-lg p-5 space-y-4">
      {/* Reset password */}
      <div>
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="text-sm px-3 py-1.5 border border-forest-200 rounded hover:bg-cream"
          >
            Reset password
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (≥ 8 chars)"
              minLength={8}
              className="w-full px-3 py-2 border border-forest-200 rounded text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={onResetPassword}
                disabled={isPending}
                className="text-sm px-3 py-1.5 rounded text-white"
                style={{ background: '#0F2E2E' }}
              >
                {isPending ? 'Saving…' : 'Set password'}
              </button>
              <button
                onClick={() => { setShowReset(false); setNewPassword(''); }}
                className="text-sm px-3 py-1.5 border border-forest-200 rounded"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-forest-400">
              Share with {userName} via a secure channel (1Password vault, signal, etc.) — they should rotate it on first login.
            </p>
          </div>
        )}
      </div>

      {/* Deactivate / Reactivate */}
      <div>
        {isActive ? (
          <button
            onClick={onDeactivate}
            disabled={isPending || isSelf || isCEO}
            className="text-sm px-3 py-1.5 border border-terra/40 text-terra-700 rounded hover:bg-terra/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Deactivate user
          </button>
        ) : (
          <button
            onClick={onReactivate}
            disabled={isPending}
            className="text-sm px-3 py-1.5 border border-forest-200 rounded hover:bg-cream"
          >
            Reactivate user
          </button>
        )}
        {(isSelf || isCEO) && isActive && (
          <p className="text-xs text-forest-400 mt-1">
            {isSelf ? 'You cannot deactivate yourself. ' : ''}
            {isCEO ? 'CEO users cannot be deactivated from the UI — use the database directly.' : ''}
          </p>
        )}
      </div>

      {msg && (
        <div
          className={`p-3 rounded text-sm ${
            msg.kind === 'ok' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-terra/10 border border-terra/30 text-terra-700'
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
