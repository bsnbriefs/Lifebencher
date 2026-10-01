import React, { useEffect, useRef, useState } from 'react';
import { resolveVoiceIntroUrl } from '../../lib/voiceIntro';

export const VoiceIntroPlayer: React.FC<{
  path: string;
  durationMs?: number;
  compact?: boolean;
}> = ({ path, durationMs = 0, compact }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setError(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
    }
  }, [path]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    try {
      if (!audio.src) {
        setLoading(true);
        audio.src = await resolveVoiceIntroUrl(path);
        await audio.load?.();
        setLoading(false);
      }
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Could not play this introduction.');
    }
  };

  const total = Math.max(1, Math.round((durationMs || audioRef.current?.duration || 0) / 1000) || 1);

  return (
    <div className={compact ? 'flex items-center gap-2' : 'space-y-1.5'}>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
      />
      <button
        type="button"
        onClick={() => void toggle()}
        className="h-10 px-3 rounded-full bg-rose-900 text-amber-100 text-xs font-semibold flex items-center gap-2 shrink-0"
      >
        {loading ? '…' : playing ? '❚❚ Pause' : '▶ Play'}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-stone-200 dark:bg-stone-600 overflow-hidden">
          <div className="h-full bg-rose-800 dark:bg-rose-400" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        {!compact && (
          <p className="text-[10px] text-stone-600 dark:text-stone-300 mt-1">{Math.round(progress * total)}s / {total}s</p>
        )}
      </div>
      {error && <p className="text-[10px] text-rose-800 dark:text-rose-300">{error}</p>}
    </div>
  );
};
