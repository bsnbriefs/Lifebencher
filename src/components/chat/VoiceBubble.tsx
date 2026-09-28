import React, { useRef, useState } from 'react';
import { Message } from '../../types';
import { resolveChatMediaUrl } from '../../lib/chat';

function fmt(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const VoiceBubble: React.FC<{ message: Message; matchId: string }> = ({ message, matchId }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const duration = message.durationMs || 0;

  const toggle = async () => {
    setErr(null);
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    setLoading(true);
    try {
      const path = message.audioPath;
      if (!path) throw new Error('missing');
      const url = await resolveChatMediaUrl(matchId, path);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current;
        if (!a || !a.duration) return;
        setProgress(a.currentTime / a.duration);
      };
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setErr('Unable to play this voice message. Tap to retry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" onClick={() => void toggle()} className="flex items-center gap-2 min-w-0 text-left">
      <span className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center text-[11px] font-bold">
        {loading ? '…' : playing ? '❚❚' : '▶'}
      </span>
      <span className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden min-w-[72px]">
        <span className="block h-full bg-white/80" style={{ width: `${Math.round(progress * 100)}%` }} />
      </span>
      <span className="text-[10px] opacity-80">{fmt(duration)}</span>
      {err && <span className="sr-only">{err}</span>}
    </button>
  );
};
