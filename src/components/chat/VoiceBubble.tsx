import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';

interface VoiceBubbleProps {
  audioUrl?: string;
  duration?: number;
  isMine?: boolean;
}

export const VoiceBubble: React.FC<VoiceBubbleProps> = ({
  audioUrl,
  duration = 0,
  isMine = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio();
    audio.src = audioUrl;
    audio.preload = 'metadata';
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
      setHasError(false);
    };

    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      setHasError(true);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (hasError) {
      setHasError(false);
      setIsLoading(true);
      if (audioUrl) {
        audioRef.current.src = audioUrl;
        audioRef.current.load();
      }
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setIsLoading(true);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err) {
        console.error('Audio playback failed:', err);
        setHasError(true);
        setIsPlaying(false);
        setIsLoading(false);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const newTime = percentage * (totalDuration || 1);

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Synthetic waveform bars (20 bars with varying heights)
  const barHeights = [28, 45, 70, 35, 60, 85, 50, 40, 75, 95, 65, 50, 80, 45, 60, 75, 40, 55, 30, 65];
  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5 w-60 sm:w-68 select-none">
      <div className="flex items-center gap-2.5">
        {/* Play / Pause / Retry Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading && !hasError}
          className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs ${
            isMine
              ? 'bg-amber-400 text-stone-950 hover:bg-amber-300'
              : 'bg-rose-900 text-amber-200 hover:bg-rose-950'
          }`}
          aria-label={hasError ? 'Retry' : isPlaying ? 'Pause voice message' : 'Play voice message'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : hasError ? (
            <RotateCcw className="w-4 h-4" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform / Scrubber Bar */}
        <div
          ref={progressBarRef}
          onClick={handleSeek}
          className="flex-1 h-7 flex items-center gap-0.5 sm:gap-1 px-1 py-1 cursor-pointer group"
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemax={totalDuration}
          aria-valuemin={0}
        >
          {barHeights.map((heightPercent, idx) => {
            const barPositionPercent = (idx / barHeights.length) * 100;
            const isFilled = progressPercent >= barPositionPercent;

            return (
              <div
                key={idx}
                className="flex-1 flex items-center justify-center h-full"
              >
                <div
                  style={{ height: `${Math.max(20, heightPercent)}%` }}
                  className={`w-full rounded-full transition-all duration-150 ${
                    isFilled
                      ? isMine
                        ? 'bg-amber-300'
                        : 'bg-rose-800'
                      : isMine
                      ? 'bg-white/40 group-hover:bg-white/60'
                      : 'bg-stone-300 group-hover:bg-stone-400'
                  } ${isPlaying && isFilled ? 'scale-y-110' : ''}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Time & Error indicator */}
      <div className="flex items-center justify-between px-1 text-[10px]">
        {hasError ? (
          <span className="text-rose-300 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" /> Failed to load audio. Tap to retry.
          </span>
        ) : (
          <>
            <span className={isMine ? 'text-rose-100 font-medium' : 'text-stone-500 font-medium'}>
              {formatTime(currentTime)}
            </span>
            <span className={isMine ? 'text-rose-200' : 'text-stone-400'}>
              {formatTime(totalDuration)}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
