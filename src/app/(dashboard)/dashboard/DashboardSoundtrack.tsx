'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Dashboard soundtrack player. Tries to autoplay /money.mp3 on mount.
 *
 * Browser autoplay policies block audio-with-sound on first visit unless
 * the user has previously interacted with the origin (Media Engagement
 * Index). On those first-visit cases we surface a discreet "Play ▶" pill
 * the user clicks once; after that the browser remembers and autoplay
 * works on subsequent visits.
 *
 * To avoid restart-spam when the user navigates back to /dashboard, we
 * track the last play timestamp in localStorage and skip auto-play if
 * the track started within the last 10 minutes.
 *
 * Also respects an explicit "muted forever" toggle — clicking ⊘ on the
 * pill stops playback and skips future auto-plays until the user enables
 * again from the pill menu.
 */

const TRACK_TITLE = 'Money — Pink Floyd';
const TRACK_SRC = '/money.mp3';
const LS_LAST_PLAY = 'safa.soundtrack.lastPlayed';
const LS_MUTED = 'safa.soundtrack.muted';
const REPLAY_COOLDOWN_MS = 10 * 60 * 1000;

export default function DashboardSoundtrack() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    // Respect explicit user mute
    try {
      if (localStorage.getItem(LS_MUTED) === '1') {
        setMuted(true);
        return;
      }
    } catch { /* localStorage blocked — proceed */ }

    // Honour cooldown so navigating back to /dashboard doesn't restart the track
    try {
      const last = parseInt(localStorage.getItem(LS_LAST_PLAY) ?? '0', 10);
      if (last && Date.now() - last < REPLAY_COOLDOWN_MS) {
        return; // recently played; don't auto-restart
      }
    } catch { /* ignore */ }

    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.55;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          setPlaying(true);
          try { localStorage.setItem(LS_LAST_PLAY, String(Date.now())); } catch { /* ignore */ }
        })
        .catch(() => {
          // Autoplay blocked — surface manual play button
          setNeedsManualPlay(true);
        });
    }

    return () => {
      if (audio && !audio.paused) audio.pause();
    };
  }, []);

  function manualPlay() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.55;
    audio
      .play()
      .then(() => {
        setPlaying(true);
        setNeedsManualPlay(false);
        try { localStorage.setItem(LS_LAST_PLAY, String(Date.now())); } catch { /* ignore */ }
      })
      .catch(() => {
        // Still blocked — maybe file is missing or another issue
        setNeedsManualPlay(true);
      });
  }

  function togglePause() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => undefined);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function muteForever() {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
    setPlaying(false);
    setNeedsManualPlay(false);
    setMuted(true);
    try { localStorage.setItem(LS_MUTED, '1'); } catch { /* ignore */ }
  }

  function unmute() {
    try { localStorage.removeItem(LS_MUTED); } catch { /* ignore */ }
    setMuted(false);
    setNeedsManualPlay(true);
  }

  return (
    <>
      <audio
        ref={audioRef}
        src={TRACK_SRC}
        preload="auto"
        onEnded={() => setPlaying(false)}
      />

      {muted ? (
        <button
          onClick={unmute}
          className="fixed bottom-4 right-4 z-50 text-[10px] text-muted hover:text-brand bg-white border border-line rounded-full px-2 py-1 shadow-sm"
          title="Re-enable dashboard soundtrack"
        >
          🔇 vibe muted
        </button>
      ) : needsManualPlay ? (
        <button
          onClick={manualPlay}
          className="fixed bottom-4 right-4 z-50 text-xs bg-white border border-lime/50 rounded-full pl-2 pr-3 py-1.5 shadow-card hover:shadow-card-hover transition-shadow flex items-center gap-1.5"
          title={`Click to play ${TRACK_TITLE}`}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px]">▶</span>
          <span className="text-ink">Play vibe</span>
        </button>
      ) : playing ? (
        <div
          className="fixed bottom-4 right-4 z-50 text-xs bg-white border border-lime/50 rounded-full px-3 py-1.5 shadow-card flex items-center gap-2"
          title={TRACK_TITLE}
        >
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-lime text-brand text-[10px]" style={{ background: '#E1E32A' }}>
            <span className="animate-pulse">♪</span>
          </span>
          <span className="text-ink hidden sm:inline">{TRACK_TITLE}</span>
          <button
            onClick={togglePause}
            className="text-muted hover:text-brand"
            title="Pause"
          >
            ⏸
          </button>
          <button
            onClick={muteForever}
            className="text-muted hover:text-red-600 text-[10px]"
            title="Don't play again"
          >
            ⊘
          </button>
        </div>
      ) : null}
    </>
  );
}
