import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  ImagePlus,
  Send,
  Shield,
  ArrowLeft,
  CheckCheck,
  Clock,
  Phone,
  Mail,
  Copy,
  Check,
  Palette,
  MoreVertical,
  AlertTriangle,
  Sparkles,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Trash2,
  X,
  Heart,
  Star,
  Reply,
  Pencil,
  Smile,
  Flag,
  Search,
  ArrowDown,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, Match } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { endMatch, listenUserMatches } from '../../lib/matches';
import { formatMessageTime, listenLatestMessage, listenMatchMessages, markMatchMessagesRead, resolveChatMediaUrl, sendMatchAudio, sendMatchImage, sendMatchMessage, unsendMatchMessage, toggleMessageReaction, toggleMessageStar, setChatPresence, listenChatPresence, setChatTyping, listenChatTyping, getDisappearingMessages, setDisappearingMessages, getChatTheme, setChatTheme, CHAT_THEME_OPTIONS, type ChatThemeId, reportUser, reportMessage, blockUser, isUserBlocked, unblockUser, listBlockedUserIds, listBlockedProfiles, type BlockedProfilePreview } from '../../lib/chat';
import { RecordingSession, startAudioRecording } from '../../lib/audioRecorder';
import {
  declineContactExchange,
  exchangeUiState,
  listenContactExchange,
  requestOrApproveContact
} from '../../lib/contactExchange';
import { ContactExchangeRequest } from '../../types';
import { db } from '../../lib/firebase';
import { CallOverlay } from '../chat/CallOverlay';

interface MessagesScreenProps {
  initialConversationId?: string | null;
}

type ContactExchangeState = 'none' | 'pending_me' | 'pending_them' | 'unlocked';

interface ConversationWithMeta extends Conversation {
  expiresAt: string;
  exchangeState: ContactExchangeState;
  otherUserContact?: {
    phone: string;
    email: string;
  };
}

const CHAT_THEME_STYLE: Record<ChatThemeId, {
  shell: string;
  header: string;
  title: string;
  meta: string;
  icon: string;
  mine: string;
  theirs: string;
  stamp: string;
  dateChip: string;
  composer: string;
  input: string;
  send: string;
  jump: string;
  badge: string;
}> = {
  classic: {
    shell: '',
    header: 'border-stone-200',
    title: 'text-stone-900',
    meta: 'text-stone-500',
    icon: 'text-stone-600',
    mine: 'bg-rose-900 text-white rounded-br-xs',
    theirs: 'bg-white text-stone-800 border border-stone-200/90 rounded-bl-xs shadow-2xs',
    stamp: 'text-stone-400',
    dateChip: 'bg-stone-100 border-stone-200 text-stone-500',
    composer: '',
    input: 'bg-white border-stone-300 text-stone-800 placeholder:text-stone-400',
    send: 'bg-rose-900 text-amber-200',
    jump: 'bg-rose-900 text-white border-white',
    badge: 'bg-rose-50 text-rose-800'
  },
  midnight: {
    shell: 'bg-[#14110F] text-[#F4EDE6]',
    header: 'border-[#2A2422]',
    title: 'text-[#F4EDE6]',
    meta: 'text-[#B7A59C]',
    icon: 'text-[#E8B4B8]',
    mine: 'bg-[#7A1F2B] text-white rounded-br-xs',
    theirs: 'bg-[#2A2422] text-[#F4EDE6] rounded-bl-xs',
    stamp: 'text-[#B7A59C]',
    dateChip: 'bg-[#2A2422] border-[#3A322F] text-[#B7A59C]',
    composer: 'bg-[#14110F]',
    input: 'bg-[#2A2422] border-[#3A322F] text-[#F4EDE6] placeholder:text-[#8A7A73]',
    send: 'bg-[#7A1F2B] text-white',
    jump: 'bg-[#7A1F2B] text-white border-[#F4EDE6]',
    badge: 'bg-[#3A2A2C] text-[#E8B4B8]'
  },
  blush: {
    shell: 'bg-[#F8EEEA]',
    header: 'border-[#EBD3D0]',
    title: 'text-[#4A2A2E]',
    meta: 'text-[#9A6F72]',
    icon: 'text-[#7A1F2B]',
    mine: 'bg-[#7A1F2B] text-white rounded-br-xs',
    theirs: 'bg-[#E8C9C6] text-[#3F2428] rounded-bl-xs',
    stamp: 'text-[#9A6F72]',
    dateChip: 'bg-[#F3E0DC] border-[#EBD3D0] text-[#7A4A4E]',
    composer: '',
    input: 'bg-[#7A1F2B] border-[#7A1F2B] text-white placeholder:text-[#F3D6D8]',
    send: 'bg-[#C45C26] text-white',
    jump: 'bg-[#7A1F2B] text-white border-white',
    badge: 'bg-[#F3E0DC] text-[#7A1F2B]'
  }
};

const PLACEHOLDER_PHOTO =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80';

function getSmartIcebreakers(profile?: ConversationWithMeta['otherUser']): string[] {
  if (!profile) return [
    'What is something you are genuinely excited about these days?',
    'What does a really good weekend look like for you?',
    'What are you hoping to build with the right person?'
  ];
  const prompts: string[] = [];
  const interests = profile.interests || [];
  const values = profile.values || [];
  if (interests[0]) prompts.push(`I noticed you are into ${interests[0]}. How did you get into it?`);
  if (profile.profession) prompts.push(`What do you enjoy most about working in ${profile.profession}?`);
  if (profile.location) prompts.push(`What is one place in ${profile.location} you would happily recommend?`);
  if (values[0]) prompts.push(`You listed ${values[0]} as a value. What does that look like in everyday life for you?`);
  if (profile.relationshipGoal) prompts.push(`What would a healthy ${profile.relationshipGoal.toLowerCase()} look like for you?`);
  if (profile.lifestyle?.kids) prompts.push(`How do you picture family life around the question of children?`);
  prompts.push('What is something you are genuinely excited about these days?');
  return [...new Set(prompts)].slice(0, 3);
}

// Keep voice playback exclusive: only one voice note can play at a time.
let activeVoiceAudio: HTMLAudioElement | null = null;

const VoiceMessageBubble: React.FC<{ message: Message; matchId: string; mine: boolean }> = ({ message, matchId, mine }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(Math.max(0, Number(message.durationMs || 0) / 1000));
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioPath = (message as Message & { audioPath?: string }).audioPath || '';

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio && activeVoiceAudio === audio) {
        audio.pause();
        activeVoiceAudio = null;
      }
    };
  }, []);

  const loadAudio = async (): Promise<HTMLAudioElement> => {
    const audio = audioRef.current;
    if (!audio) throw new Error('Audio player is unavailable.');
    if (!audioPath) throw new Error('Voice note is unavailable.');

    // Do not put the signed URL in the JSX `src` prop. That can trigger a second
    // browser load while play() is starting, which causes the interrupted-load error.
    if (!audio.src) {
      setLoading(true);
      setError(null);
      try {
        const resolved = await resolveChatMediaUrl(matchId, audioPath);
        audio.src = resolved;

        // Wait until the browser has accepted the new source before calling play().
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onError = () => {
            cleanup();
            reject(new Error('Unable to load this voice note.'));
          };
          const cleanup = () => {
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('loadedmetadata', onReady);
            audio.removeEventListener('error', onError);
          };

          audio.addEventListener('canplay', onReady, { once: true });
          audio.addEventListener('loadedmetadata', onReady, { once: true });
          audio.addEventListener('error', onError, { once: true });
          audio.load();

          // Some browsers already have enough data immediately after load().
          if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            cleanup();
            resolve();
          }
        });
      } finally {
        setLoading(false);
      }
    }

    return audio;
  };

  const togglePlayback = async () => {
    setError(null);
    try {
      const audio = await loadAudio();
      if (audio.paused) {
        // Stop any other voice note before starting this one.
        if (activeVoiceAudio && activeVoiceAudio !== audio) {
          activeVoiceAudio.pause();
          activeVoiceAudio.currentTime = 0;
        }
        activeVoiceAudio = audio;
        audio.playbackRate = playbackRate;
        await audio.play();
      } else {
        audio.pause();
        if (activeVoiceAudio === audio) activeVoiceAudio = null;
      }
    } catch (err) {
      const audio = audioRef.current;
      setPlaying(false);
      const code = audio?.error?.code;
      setError(
        code === 4
          ? 'This voice format is not supported on this device. Please ask them to resend it.'
          : err instanceof Error
            ? err.message
            : 'Unable to play this voice note. Tap retry.'
      );
    }
  };

  const retry = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setProgress(0);
    setError(null);
    try {
      const loaded = await loadAudio();
      await loaded.play();
    } catch (err) {
      setPlaying(false);
      setError(err instanceof Error ? err.message : 'Unable to play this voice note.');
    }
  };

  return (
    <div className="w-[220px] max-w-full">
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={(e) => {
          const value = e.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setDuration(value);
        }}
        onTimeUpdate={(e) => {
          const current = e.currentTarget.currentTime;
          const total = e.currentTarget.duration || duration || 1;
          setProgress(Math.min(100, (current / total) * 100));
        }}
        onPlay={() => {
          activeVoiceAudio = audioRef.current;
          setPlaying(true);
        }}
        onPause={() => {
          if (activeVoiceAudio === audioRef.current) activeVoiceAudio = null;
          setPlaying(false);
        }}
        onEnded={() => {
          if (activeVoiceAudio === audioRef.current) activeVoiceAudio = null;
          setPlaying(false);
          setProgress(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onError={() => {
          setPlaying(false);
          if (!loading) setError('Unable to play this voice note. Tap retry.');
        }}
        className="hidden"
      />

      <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${mine ? 'bg-white/10' : 'bg-stone-100'}`}>
        <button
          type="button"
          onClick={() => void togglePlayback()}
          disabled={loading || !audioPath}
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold ${mine ? 'bg-white text-rose-900' : 'bg-rose-900 text-white'} disabled:opacity-50`}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        >
          {loading ? '…' : playing ? '❚❚' : '▶'}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`h-1.5 rounded-full overflow-hidden ${mine ? 'bg-white/20' : 'bg-stone-300'}`}>
            <div
              className={`h-full rounded-full ${mine ? 'bg-white' : 'bg-rose-900'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className={`text-[10px] ${mine ? 'text-white/70' : 'text-stone-500'}`}>
              {duration > 0 ? `${Math.floor(duration / 60)}:${Math.floor(duration % 60).toString().padStart(2, '0')}` : 'Voice note'}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
                setPlaybackRate(next);
                if (audioRef.current) audioRef.current.playbackRate = next;
              }}
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${mine ? 'border-white/30 text-white/80' : 'border-stone-300 text-stone-600'}`}
              aria-label={`Playback speed ${playbackRate} times`}
              title="Change playback speed"
            >
              {playbackRate}×
            </button>
          </div>
        </div>
      </div>

      {error && (
        <button
          type="button"
          onClick={() => void retry()}
          className={`mt-1 text-left text-[11px] underline ${mine ? 'text-white/80' : 'text-rose-900'}`}
        >
          {error} Tap to retry.
        </button>
      )}
    </div>
  );
};

const ImageMessageBubble: React.FC<{ message: Message; matchId: string }> = ({ message, matchId }) => {
  const imagePath = (message as Message & { imagePath?: string }).imagePath || '';
  const [url, setUrl] = useState<string | null>((message as Message & { imageUrl?: string }).imageUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const pointerPositionsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; zoom: number; midpoint: { x: number; y: number } } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const loadImage = async () => {
    if (url || loading) return;
    if (!imagePath) {
      setError('Photo is unavailable.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveChatMediaUrl(matchId, imagePath);
      setUrl(resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this photo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!url && imagePath) void loadImage();
  }, [imagePath]);

  const closeViewer = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    pointerPositionsRef.current.clear();
    pinchStartRef.current = null;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFullScreen(false);
  };

  if (!url) {
    return (
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void loadImage();
        }}
        disabled={loading}
        className="w-[220px] max-w-full min-h-[120px] rounded-xl bg-black/10 flex items-center justify-center text-[11px] font-semibold disabled:opacity-60"
      >
        {loading ? 'Loading photo…' : error || 'Tap to load photo'}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setZoom(1);
          setPan({ x: 0, y: 0 });
          setFullScreen(true);
        }}
        className="block max-w-full rounded-xl overflow-hidden cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-amber-300"
        aria-label="Open photo"
      >
        <img
          src={url}
          alt="Sent photo"
          className="block max-w-[78vw] sm:max-w-[420px] max-h-[55dvh] w-auto h-auto object-contain rounded-xl"
          onError={() => {
            setUrl(null);
            setError('Unable to load this photo. Tap to retry.');
          }}
        />
      </button>

      {fullScreen && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeViewer(e);
          }}
        >
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-4 bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => closeViewer(e)}
              className="pointer-events-auto w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center active:scale-95"
              aria-label="Close photo"
            >
              <X className="w-6 h-6" />
            </button>
            <span className="text-white/75 text-[11px] font-medium">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              pointerPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

              if (pointerPositionsRef.current.size === 2) {
                const points = Array.from(pointerPositionsRef.current.values());
                const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
                const midpoint = {
                  x: (points[0].x + points[1].x) / 2,
                  y: (points[0].y + points[1].y) / 2
                };
                pinchStartRef.current = { distance: Math.max(1, distance), zoom, midpoint };
                panStartRef.current = null;
              } else if (zoom > 1) {
                panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
              }
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              if (!pointerPositionsRef.current.has(e.pointerId)) return;
              pointerPositionsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

              if (pointerPositionsRef.current.size === 2 && pinchStartRef.current) {
                const points = Array.from(pointerPositionsRef.current.values());
                const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
                const nextZoom = Math.max(
                  1,
                  Math.min(4, pinchStartRef.current.zoom * (distance / pinchStartRef.current.distance))
                );
                setZoom(Number(nextZoom.toFixed(2)));

                const midpoint = {
                  x: (points[0].x + points[1].x) / 2,
                  y: (points[0].y + points[1].y) / 2
                };
                setPan((current) => ({
                  x: current.x + (midpoint.x - pinchStartRef.current!.midpoint.x),
                  y: current.y + (midpoint.y - pinchStartRef.current!.midpoint.y)
                }));
                pinchStartRef.current.midpoint = midpoint;
                return;
              }

              if (pointerPositionsRef.current.size === 1 && panStartRef.current && zoom > 1) {
                setPan({
                  x: panStartRef.current.panX + (e.clientX - panStartRef.current.x),
                  y: panStartRef.current.panY + (e.clientY - panStartRef.current.y)
                });
              }
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              pointerPositionsRef.current.delete(e.pointerId);
              if (pointerPositionsRef.current.size < 2) pinchStartRef.current = null;
              if (pointerPositionsRef.current.size === 0) panStartRef.current = null;
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              pointerPositionsRef.current.delete(e.pointerId);
              pinchStartRef.current = null;
              panStartRef.current = null;
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              const next = zoom > 1 ? 1 : 2;
              setZoom(next);
              setPan({ x: 0, y: 0 });
            }}
          >
            <img
              src={url}
              alt="Sent photo enlarged"
              draggable={false}
              className="max-w-[96vw] max-h-[88dvh] w-auto h-auto object-contain select-none rounded-sm"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: pointerPositionsRef.current.size ? 'none' : 'transform 120ms ease-out',
                willChange: 'transform',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                pointerEvents: 'none'
              }}
            />
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/65 px-2 py-1.5">
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, Number((zoom - 0.5).toFixed(1)));
                setZoom(next);
                if (next === 1) setPan({ x: 0, y: 0 });
              }}
              disabled={zoom <= 1}
              className="w-9 h-9 rounded-full text-white text-xl flex items-center justify-center disabled:opacity-40"
              aria-label="Zoom out"
            >−</button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="min-w-12 h-9 rounded-full text-white text-[11px] font-semibold"
              aria-label="Reset zoom"
            >{Math.round(zoom * 100)}%</button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
              disabled={zoom >= 4}
              className="w-9 h-9 rounded-full text-white text-xl flex items-center justify-center disabled:opacity-40"
              aria-label="Zoom in"
            >+</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const ViewOnceButton: React.FC<{ message: Message; matchId: string; mine: boolean }> = ({ message, matchId, mine }) => {
  const consumed = Boolean(message.viewedAt) && !mine;
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'shown' | 'error'>(consumed ? 'idle' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const clearUrl = () => {
    setUrl(null);
  };

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    const onPop = () => {
      setOpen(false);
      setUrl(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };
    window.history.pushState({ viewOnce: true }, '');
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const requestOpen = async () => {
    if (consumed) return;
    setStatus('loading');
    setError(null);
    try {
      const { auth } = await import('../../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/chat/view-once', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, messageId: message.id, action: 'open' })
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setStatus('error');
        setError(res.status === 410 ? 'Photo viewed' : body.error || 'Unable to load this photo. Please try again.');
        return;
      }
      setUrl(body.url);
      setOpen(true);
    } catch {
      setStatus('error');
      setError('Unable to load this photo. Please try again.');
    }
  };

  const onLoaded = async () => {
    setStatus('shown');
    if (mine) return;
    try {
      const { auth } = await import('../../lib/firebase');
      const token = await auth.currentUser?.getIdToken();
      await fetch('/api/chat/view-once', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, messageId: message.id, action: 'consume' })
      });
    } catch {
      /* consume is server-enforced on retry */
    }
  };

  const close = () => {
    setOpen(false);
    setUrl(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void requestOpen()}
        disabled={consumed}
        className="block w-52 max-w-full text-left rounded-2xl overflow-hidden border border-white/20 bg-black/20"
      >
        <div className="h-36 w-full bg-stone-900/80 flex flex-col items-center justify-center gap-1 text-white">
          <span className="text-2xl" aria-hidden="true">📷</span>
          <span className="text-xs font-semibold">
            {consumed ? 'Photo viewed' : status === 'loading' ? 'Opening photo…' : 'Tap to view once'}
          </span>
          {!consumed && <span className="text-[10px] opacity-80">Disappears after viewing</span>}
        </div>
      </button>
      {error && !consumed && <p className="text-[10px] mt-1 opacity-80">{error}</p>}
      {open && url && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center overflow-hidden" role="dialog" aria-modal="true" aria-label="View once photo">
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] pb-4 bg-gradient-to-b from-black/75 to-transparent">
            <button type="button" onClick={close} className="w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label="Close photo">
              <X className="w-6 h-6" />
            </button>
            <span className="text-white/75 text-[11px] font-medium">{Math.round(zoom * 100)}%</span>
          </div>
          <img
            src={url}
            alt=""
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoad={() => void onLoaded()}
            onError={() => { close(); setStatus('error'); setError('Unable to load this photo. Please try again.'); }}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            className="max-w-full max-h-[80dvh] object-contain select-none"
          />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full bg-black/65 px-2 py-1.5">
            <button type="button" className="w-9 h-9 text-white" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out">−</button>
            <button type="button" className="min-w-12 h-9 text-white text-[11px]" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button type="button" className="w-9 h-9 text-white" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} aria-label="Zoom in">+</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};


const SwipeToReply: React.FC<{
  children: React.ReactNode;
  onReply: () => void;
  mine: boolean;
}> = ({ children, onReply, mine }) => {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const offsetRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    startRef.current = { x: e.clientX, y: e.clientY };
    offsetRef.current = 0;
    setOffset(0);
    setSwiping(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is optional.
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    // Let normal vertical scrolling win. Only a clearly horizontal gesture
    // becomes a reply gesture.
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.25) return;

    const direction = mine ? -1 : 1;
    const signed = dx * direction;
    if (signed <= 0) {
      offsetRef.current = 0;
      setOffset(0);
      return;
    }

    const next = Math.min(72, signed);
    offsetRef.current = next;
    setOffset(next);
    if (next > 12) setSwiping(true);
  };

  const finishSwipe = (e?: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;

    const finalOffset = offsetRef.current;
    if (finalOffset >= 52) {
      onReply();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(12); } catch { /* optional */ }
      }
    }

    if (e) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Pointer capture is optional.
      }
    }

    startRef.current = null;
    offsetRef.current = 0;
    setOffset(0);
    setSwiping(false);
  };

  return (
    <div
      className="relative min-w-0 touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => finishSwipe(e)}
      onPointerCancel={(e) => finishSwipe(e)}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') finishSwipe();
      }}
    >
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-rose-100 text-rose-900 flex items-center justify-center transition-opacity ${
          offset > 8 ? 'opacity-100' : 'opacity-0'
        } ${mine ? 'right-full mr-2' : 'left-full ml-2'}`}
        aria-hidden="true"
      >
        ↩
      </div>
      <div
        style={{ transform: `translateX(${mine ? -offset : offset}px)` }}
        className={swiping ? 'transition-none' : 'transition-transform duration-150'}
      >
        {children}
      </div>
    </div>
  );
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ initialConversationId }) => {
  const { user, currentProfile } = useAuth();
  const myId = user?.id || '';
  const [matchRecords, setMatchRecords] = useState<Record<string, Match>>({});
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [newMessagesWhileAway, setNewMessagesWhileAway] = useState(0);
  const prevMessageCountRef = useRef(0);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfilePreview[]>([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [disappearingMode, setDisappearingMode] = useState<'off' | '24h' | '7d' | '30d'>('off');
  const [chatTheme, setChatThemeState] = useState<ChatThemeId>('classic');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [savingDisappearing, setSavingDisappearing] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportMessageTarget, setReportMessageTarget] = useState<Message | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recordingPreview, setRecordingPreview] = useState<{ blob: Blob; duration: number; url: string } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingSessionRef = useRef<RecordingSession | null>(null);
  const recordingPreviewUrlRef = useRef<string | null>(null);
  const [contactState, setContactState] = useState<ContactExchangeRequest | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null);
  const [reactionMenuId, setReactionMenuId] = useState<string | null>(null);
  const [starredMessageIds, setStarredMessageIds] = useState<Set<string>>(new Set());
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [unsendMessageId, setUnsendMessageId] = useState<string | null>(null);
  const [unsending, setUnsending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showContactExchange, setShowContactExchange] = useState(false);
  const [resolvedOtherContact, setResolvedOtherContact] = useState<{ phone: string; email: string } | undefined>(undefined);
  const phoneShown = resolvedOtherContact?.phone || '';
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingStateRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const rawConv = conversations.find((c) => c.id === activeConvId || c.matchId === activeConvId) || null;
  const liveUi = rawConv && myId ? exchangeUiState(contactState, myId) : 'none';
  const otherContact =
    contactState && myId && liveUi === 'unlocked'
      ? myId === contactState.user1Id
        ? contactState.user2Contact
        : contactState.user1Contact
      : undefined;
  const activeConv = rawConv
    ? {
        ...rawConv,
        exchangeState:
          liveUi === 'declined' ? 'none' : liveUi,
        otherUserContact: resolvedOtherContact || (otherContact
          ? { phone: otherContact.phone || '', email: otherContact.email || '' }
          : undefined)
      }
    : null;

  useEffect(() => {
    if (!myId) return;
    return listenUserMatches(myId, async (matches) => {
      const record: Record<string, Match> = {};
      matches.forEach((m) => {
        record[m.id] = m;
      });
      setMatchRecords(record);
      const activeMatches = matches.filter((m) => m.status !== 'ended');
      Promise.all(activeMatches.map(async (m) => {
        const otherId = m.user1Id === myId ? m.user2Id : m.user1Id;
        return { matchId: m.id, blocked: await isUserBlocked(otherId).catch(() => false) };
      })).then((blocked) => {
      const blockedIds = new Set(blocked.filter((x) => x.blocked).map((x) => x.matchId));
      setConversations((prev) => {
        const prevById = new Map(prev.map((c) => [c.matchId, c]));
        return activeMatches
          .filter((m) => !blockedIds.has(m.id))
          .map((m) => {
            const existing = prevById.get(m.id);
            return {
              id: m.id,
              matchId: m.id,
              participantIds: [m.user1Id, m.user2Id],
              otherUser: m.otherProfile,
              lastMessageText: existing?.lastMessageText || 'Start a thoughtful conversation',
              lastMessageAt: existing?.lastMessageAt || '',
              unreadCount: existing?.unreadCount || 0,
              expiresAt: m.expiresAt,
              exchangeState: existing?.exchangeState || 'none',
              otherUserContact: existing?.otherUserContact
            } satisfies ConversationWithMeta;
          });
      });
      });
    });
  }, [myId]);

  useEffect(() => {
    if (initialConversationId) setActiveConvId(initialConversationId);
  }, [initialConversationId]);

  useEffect(() => {
    if (!activeConvId) {
      setDisappearingMode('off');
      setChatThemeState('classic');
      return;
    }
    let cancelled = false;
    void getDisappearingMessages(activeConvId)
      .then((mode) => { if (!cancelled) setDisappearingMode(mode); })
      .catch(() => { if (!cancelled) setDisappearingMode('off'); });
    void getChatTheme(activeConvId)
      .then((theme) => { if (!cancelled) setChatThemeState(theme); })
      .catch(() => { if (!cancelled) setChatThemeState('classic'); });
    return () => { cancelled = true; };
  }, [activeConvId]);

  useEffect(() => {
    const unsubs = conversations.map((c) =>
      listenLatestMessage(c.matchId, (preview) => {
        if (!preview) return;
        setConversations((prev) =>
          prev.map((item) =>
            item.matchId === c.matchId
              ? {
                  ...item,
                  lastMessageText: preview.text,
                  lastMessageAt: formatMessageTime(preview.at)
                }
              : item
          )
        );
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [conversations.map((c) => c.matchId).join('|')]);

  useEffect(() => {
    if (!activeConvId) {
      setCurrentMessages([]);
      setInputVal('');
      setHasLoadedDraft(false);
      setShowJumpToLatest(false);
      setNewMessagesWhileAway(0);
      prevMessageCountRef.current = 0;
      setOtherOnline(false);
      setOtherTyping(false);
      return;
    }
    const draftKey = `lifebencher:chat-draft:${activeConvId}`;
    try {
      setInputVal(localStorage.getItem(draftKey) || '');
    } catch {
      setInputVal('');
    }
    setHasLoadedDraft(true);
    void markMatchMessagesRead(activeConvId);
    return listenMatchMessages(activeConvId, setCurrentMessages);
  }, [activeConvId]);

  // Keep presence and typing scoped to the open match only.
  useEffect(() => {
    if (!activeConvId || !myId) return;
    const match = matchRecords[activeConvId];
    if (!match) return;
    const otherId = match.user1Id === myId ? match.user2Id : match.user1Id;

    void setChatPresence(activeConvId, myId, true);
    void setChatTyping(activeConvId, myId, false);
    typingStateRef.current = false;
    setOtherOnline(false);
    setOtherTyping(false);

    const stopPresence = listenChatPresence(activeConvId, otherId, setOtherOnline);
    const stopTyping = listenChatTyping(activeConvId, otherId, setOtherTyping);

    const goOffline = () => {
      void setChatPresence(activeConvId, myId, false);
      void setChatTyping(activeConvId, myId, false);
      typingStateRef.current = false;
    };

    window.addEventListener('pagehide', goOffline);
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
      goOffline();
      window.removeEventListener('pagehide', goOffline);
      stopPresence();
      stopTyping();
    };
  }, [activeConvId, myId, matchRecords]);

  // Re-run the read receipt after the realtime message listener has loaded.
  // This avoids the initial open/read race and lets the sender receive the
  // blue double tick through the existing realtime listener.
  useEffect(() => {
    const ids = new Set<string>();
    currentMessages.forEach((message) => {
      const starredBy = (message as Message & { starredBy?: string[] }).starredBy || [];
      if (myId && starredBy.includes(myId)) ids.add(message.id);
    });
    setStarredMessageIds(ids);
  }, [currentMessages, myId]);

  useEffect(() => {
    if (!activeConvId || currentMessages.length === 0) return;
    void markMatchMessagesRead(activeConvId);
  }, [activeConvId, currentMessages.length]);

  useEffect(() => {
    if (!activeConvId || !hasLoadedDraft) return;
    const draftKey = `lifebencher:chat-draft:${activeConvId}`;
    try {
      if (inputVal.trim()) localStorage.setItem(draftKey, inputVal);
      else localStorage.removeItem(draftKey);
    } catch {
      // Draft persistence is best-effort only.
    }
  }, [activeConvId, inputVal, hasLoadedDraft]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      const away = distance > 140;
      setShowJumpToLatest(away);
      if (!away) setNewMessagesWhileAway(0);
    };
    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [activeConvId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    const prevCount = prevMessageCountRef.current;
    const nextCount = currentMessages.length;
    prevMessageCountRef.current = nextCount;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distance < 140;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: nextCount > 1 ? 'smooth' : 'auto' });
      setShowJumpToLatest(false);
      setNewMessagesWhileAway(0);
    } else if (nextCount > prevCount) {
      setShowJumpToLatest(true);
      setNewMessagesWhileAway((n) => n + (nextCount - prevCount));
    }
  }, [currentMessages, activeConvId]);

  useEffect(() => {
    setShowContactExchange(false);
  }, [activeConvId]);

  useEffect(() => {
    if (!activeConvId) {
      setContactState(null);
      return;
    }
    const match = matchRecords[activeConvId];
    if (!match) return;
    return listenContactExchange(match.id, match.user1Id, match.user2Id, setContactState);
  }, [activeConvId, matchRecords]);

  // After mutual consent, repair/read the private contact secret directly.
  // This keeps phone numbers private while fixing older exchanges where the
  // contact listener did not surface the stored number.
  useEffect(() => {
    if (!activeConvId || liveUi !== 'unlocked' || !myId) {
      setResolvedOtherContact(undefined);
      return;
    }
    const match = matchRecords[activeConvId];
    if (!match) return;
    const otherUid = match.user1Id === myId ? match.user2Id : match.user1Id;
    let cancelled = false;

    const repairAndLoad = async () => {
      const ownPhone = currentProfile?.phone || currentProfile?.whatsapp || user?.phone || '';
      const ownEmail = user?.email || '';
      try {
        if (ownEmail) {
          await setDoc(
            doc(db, 'matches', activeConvId, 'contactSecrets', myId),
            { email: ownEmail, phone: ownPhone },
            { merge: true }
          );
        }
      } catch {
        // Existing contact exchange remains usable even if this repair is denied.
      }

      try {
        const snap = await getDoc(doc(db, 'matches', activeConvId, 'contactSecrets', otherUid));
        if (!cancelled && snap.exists()) {
          const data = snap.data() as { phone?: string; email?: string };
          setResolvedOtherContact({ phone: data.phone || '', email: data.email || '' });
        }
      } catch {
        // Fall back to the contact exchange listener data.
      }
    };

    void repairAndLoad();
    return () => {
      cancelled = true;
    };
  }, [activeConvId, liveUi, myId, matchRecords, currentProfile?.phone, currentProfile?.whatsapp, user?.phone, user?.email]);

  const handleEditMessage = async () => {
    if (!activeConvId || !editingMessageId || !inputVal.trim()) return;
    setSendError(null);
    try {
      await import('../../lib/chat').then(({ editMatchMessage }) =>
        editMatchMessage(activeConvId, editingMessageId, inputVal)
      );
      setEditingMessageId(null);
      setInputVal('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to edit this message.');
    }
  };

  const handleStartEditing = (message: Message) => {
    if (message.senderId !== myId || message.kind !== 'text') return;
    const createdAt = new Date(message.createdAt).getTime();
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) {
      setSendError('Messages can only be edited within 10 minutes.');
      setMessageMenuId(null);
      return;
    }
    setEditingMessageId(message.id);
    setInputVal(message.content || '');
    setReplyTarget(null);
    setMessageMenuId(null);
  };

  const handleCancelEditing = () => {
    setEditingMessageId(null);
    setInputVal('');
  };

  const handleUnsendMessage = async () => {
    if (!activeConvId || !unsendMessageId || unsending) return;
    setUnsending(true);
    setSendError(null);
    try {
      await unsendMatchMessage(activeConvId, unsendMessageId);
      setUnsendMessageId(null);
      setMessageMenuId(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to delete this message.');
    } finally {
      setUnsending(false);
    }
  };

  const visibleMessages = currentMessages.filter((message) => {
    if (showStarredOnly && !starredMessageIds.has(message.id)) return false;
    const query = messageSearch.trim().toLowerCase();
    if (!query) return true;
    const text = `${message.content || ''} ${message.replyToPreview || ''}`.toLowerCase();
    return text.includes(query);
  });

  const scrollToMessage = (messageId: string) => {
    const node = messageRefs.current[messageId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('ring-2', 'ring-amber-300');
    window.setTimeout(() => node.classList.remove('ring-2', 'ring-amber-300'), 900);
  };

  const handleReact = async (message: Message, emoji: string) => {
    if (!activeConvId) return;
    setReactionMenuId(null);
    try {
      await toggleMessageReaction(activeConvId, message.id, emoji);
    } catch {
      setSendError('Could not update reaction.');
    }
  };

  const handleStar = async (message: Message) => {
    if (!activeConvId) return;
    try {
      const starred = await toggleMessageStar(activeConvId, message.id);
      setStarredMessageIds((prev) => {
        const next = new Set(prev);
        if (starred) next.add(message.id); else next.delete(message.id);
        return next;
      });
      setMessageMenuId(null);
    } catch {
      setSendError('Could not update starred message.');
    }
  };

  const handleInputChange = (value: string) => {
    setInputVal(value);
    if (!activeConvId || !myId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    if (!value.trim()) {
      if (typingStateRef.current) {
        typingStateRef.current = false;
        void setChatTyping(activeConvId, myId, false);
      }
      return;
    }

    if (!typingStateRef.current) {
      typingStateRef.current = true;
      void setChatTyping(activeConvId, myId, true);
    }

    typingTimerRef.current = setTimeout(() => {
      typingStateRef.current = false;
      void setChatTyping(activeConvId, myId, false);
    }, 1400);
  };

  const handleSetDisappearingMode = async (mode: 'off' | '24h' | '7d' | '30d') => {
    if (!activeConvId || savingDisappearing) return;
    setSavingDisappearing(true);
    try {
      await setDisappearingMessages(activeConvId, mode);
      setDisappearingMode(mode);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not update disappearing messages.');
    } finally {
      setSavingDisappearing(false);
    }
  };

  const disappearingLabel = disappearingMode === 'off' ? 'Off' : disappearingMode === '24h' ? '24 hours' : disappearingMode === '7d' ? '7 days' : '30 days';
  const themeStyle = CHAT_THEME_STYLE[chatTheme] || CHAT_THEME_STYLE.classic;

  const handleSetChatTheme = async (theme: ChatThemeId) => {
    if (!activeConvId) return;
    setChatThemeState(theme);
    try {
      await setChatTheme(activeConvId, theme);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not save chat theme.');
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || !activeConvId) return;
    if (editingMessageId) {
      await handleEditMessage();
      return;
    }
    setInputVal('');
    setReplyTarget(null);
    setSendError(null);
    try {
      await sendMatchMessage(activeConvId, text, replyTarget ? { id: replyTarget.id, preview: replyTarget.content || (replyTarget.kind === 'image' ? 'Photo' : replyTarget.kind === 'audio' ? 'Voice message' : 'Message') } : undefined);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartRecording = async () => {
    if (!activeConvId || isRecording) return;
    setRecordingError(null);
    handleDiscardPreview();
    try {
      const session = await startAudioRecording();
      recordingSessionRef.current = session;
      setRecordingSession(session);
      recordingStartedAtRef.current = Date.now();
      setRecordingDuration(0);
      setIsRecording(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone is currently unavailable.';
      setRecordingError(message);
    }
  };

  // Keep the recording clock alive while the recording UI is mounted.
  // This is intentionally separate from recordingSession state so a state
  // update cannot accidentally clear the timer.
  useEffect(() => {
    if (!isRecording) return;
    const tick = () => {
      const startedAt = recordingStartedAtRef.current;
      if (startedAt === null) return;
      setRecordingDuration(Math.floor((Date.now() - startedAt) / 1000));
    };
    tick();
    const timer = setInterval(tick, 250);
    recordingTimerRef.current = timer;
    return () => {
      clearInterval(timer);
      if (recordingTimerRef.current === timer) recordingTimerRef.current = null;
    };
  }, [isRecording]);

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingSessionRef.current?.cancel();
    recordingSessionRef.current = null;
    recordingStartedAtRef.current = null;
    setRecordingSession(null);
    setIsRecording(false);
    setRecordingDuration(0);
    setRecordingError(null);
  };

  const handleStopRecordingForPreview = async () => {
    if (!recordingSession) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    try {
      const result = await recordingSession.stop();
      const url = URL.createObjectURL(result.blob);
      recordingPreviewUrlRef.current = url;
      setRecordingPreview({
        blob: result.blob,
        duration: Math.max(0.01, result.duration),
        url
      });
      recordingSessionRef.current = null;
      setRecordingSession(null);
      setIsRecording(false);
      setRecordingDuration(0);
      recordingStartedAtRef.current = null;
      setPreviewPlaying(false);
      setRecordingError(null);
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : 'Could not finish recording.');
      recordingSessionRef.current = null;
      setRecordingSession(null);
      setIsRecording(false);
      recordingStartedAtRef.current = null;
    }
  };

  const handleDiscardPreview = () => {
    if (recordingPreview) URL.revokeObjectURL(recordingPreview.url);
    recordingPreviewUrlRef.current = null;
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    setRecordingPreview(null);
    setPreviewPlaying(false);
  };

  const handleSendVoiceNote = async () => {
    if (!activeConvId || !recordingPreview) return;
    try {
      await sendMatchAudio(activeConvId, recordingPreview.blob, recordingPreview.duration * 1000);
        handleDiscardPreview();
      setRecordingError(null);
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : 'Could not send voice note.');
    }
  };

  const formatRecordTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingSessionRef.current?.cancel();
      recordingSessionRef.current = null;
      recordingStartedAtRef.current = null;
      if (recordingPreviewUrlRef.current) URL.revokeObjectURL(recordingPreviewUrlRef.current);
      recordingPreviewUrlRef.current = null;
      previewAudioRef.current?.pause();
    };
  }, []);

  // Contact Exchange Trigger
  const handleRequestExchange = () => {
    const match = activeConvId ? matchRecords[activeConvId] : undefined;
    if (!match || !user) return;
    void requestOrApproveContact({
      matchId: match.id,
      user1Id: match.user1Id,
      user2Id: match.user2Id,
      myContact: {
        phone: currentProfile?.phone || currentProfile?.whatsapp || user.phone || '',
        email: user.email,
        whatsapp: currentProfile?.whatsapp || currentProfile?.phone || user.phone || ''
      }
    }).then(() => {
    });
  };

  const handleDeclineExchange = () => {
    const match = activeConvId ? matchRecords[activeConvId] : undefined;
    if (!match) return;
    void declineContactExchange({
      matchId: match.id,
      user1Id: match.user1Id,
      user2Id: match.user2Id
    });
  };

  // End match / Unmatch
  const handleConfirmUnmatch = () => {
    if (!activeConvId) return;
    const record = matchRecords[activeConvId];
    if (record) {
      void endMatch(activeConvId, record);
    }
    setConversations((prev) => prev.filter((c) => c.id !== activeConvId && c.matchId !== activeConvId));
    setActiveConvId(null);
    setShowUnmatchConfirm(false);
    setShowOptionsModal(false);
  };

  const openBlockedUsers = async () => {
    setShowBlockedUsers(true);
    setLoadingBlockedUsers(true);
    try {
      const rows = await listBlockedProfiles();
      setBlockedProfiles(rows);
      setBlockedUserIds(rows.map((row) => row.userId));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to load blocked users.');
    } finally {
      setLoadingBlockedUsers(false);
    }
  };

  const handleUnblock = async (targetUserId: string) => {
    if (!targetUserId || unblockingUserId) return;
    setUnblockingUserId(targetUserId);
    setSendError(null);
    try {
      await unblockUser(targetUserId);
      setBlockedUserIds((prev) => prev.filter((id) => id !== targetUserId));
      setBlockedProfiles((prev) => prev.filter((row) => row.userId !== targetUserId));

      const restored = Object.values(matchRecords).find(
        (m) => m.status !== 'ended' && (m.user1Id === targetUserId || m.user2Id === targetUserId)
      );
      if (restored) {
        setConversations((prev) => {
          if (prev.some((c) => c.matchId === restored.id)) return prev;
          return [
            ...prev,
            {
              id: restored.id,
              matchId: restored.id,
              participantIds: [restored.user1Id, restored.user2Id],
              otherUser: restored.otherProfile,
              lastMessageText: 'Start a thoughtful conversation',
              lastMessageAt: '',
              unreadCount: 0,
              expiresAt: restored.expiresAt,
              exchangeState: 'none'
            } satisfies ConversationWithMeta
          ];
        });
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to unblock this person.');
    } finally {
      setUnblockingUserId(null);
    }
  };

  const handleReport = async () => {
    if (!activeConv?.otherUser?.userId || reportSubmitting) return;
    const reason = reportReason.trim();
    if (!reason) return;
    setReportSubmitting(true);
    try {
      if (reportMessageTarget) {
        await reportMessage(
          activeConv.otherUser.userId,
          reason,
          activeConv.matchId,
          reportMessageTarget.id,
          reportMessageTarget.content || reportMessageTarget.kind || 'Message'
        );
      } else {
        await reportUser(activeConv.otherUser.userId, reason, activeConv.matchId);
      }
      setReportReason('');
      setReportMessageTarget(null);
      setShowReportModal(false);
      setSendError('Report submitted. Thank you for helping keep Lifebencher safe.');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleBlock = async () => {
    if (!activeConv?.otherUser?.userId || blockSubmitting) return;
    setBlockSubmitting(true);
    try {
      await blockUser(activeConv.otherUser.userId, {
        displayName: activeConv.otherUser.displayName,
        photoUrl: activeConv.otherUser.photos?.[0] || ''
      });
      setConversations((prev) => prev.filter((c) => c.matchId !== activeConv.matchId));
      setActiveConvId(null);
      setShowOptionsModal(false);
      setShowReportModal(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Unable to block this person.');
    } finally {
      setBlockSubmitting(false);
    }
  };

  // Copy phone number helper
  const handleCopyPhone = (phoneNum: string) => {
    navigator.clipboard.writeText(phoneNum);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Helper for remaining window text
  const formatRemainingTime = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (
    <div className="h-full min-w-0 overflow-x-hidden">
      <AnimatePresence mode="wait">
        {!activeConv ? (
          /* CONVERSATION LIST VIEW */
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div>
              <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
                Messages
              </h1>
              <p className="text-xs text-stone-500">
                Encrypted private dialogues with your intentional matches
              </p>
              <button
                type="button"
                onClick={() => void openBlockedUsers()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] font-semibold text-stone-700 hover:border-rose-300 hover:text-rose-800 transition"
              >
                <Shield className="w-3.5 h-3.5" />
                Blocked users
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-6 space-y-2">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto" />
                <h3 className="font-serif font-bold text-stone-800 text-base">
                  No Active Chats
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  When you match with an intentional candidate, your private conversation window will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveConvId(c.id);
                      // Clear unread badge on click
                      setConversations((prev) =>
                        prev.map((conv) => (conv.id === c.id ? { ...conv, unreadCount: 0 } : conv))
                      );
                    }}
                    className="w-full bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs hover:border-rose-300 text-left flex items-center gap-3.5 transition active:scale-98 cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={c.otherUser?.photos?.[0] || PLACEHOLDER_PHOTO}
                        alt={c.otherUser?.displayName}
                        className="w-13 h-13 rounded-full object-cover border border-stone-200"
                      />
                      {c.unreadCount > 0 && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif font-bold text-base text-stone-900 truncate">
                          {c.otherUser?.displayName}
                        </h3>
                        <span className="text-[11px] text-stone-400 shrink-0">
                          {c.lastMessageAt}
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 truncate mt-0.5">
                        {c.lastMessageText}
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-50 text-amber-900 border border-amber-200/60 font-medium flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRemainingTime(c.expiresAt)}
                        </span>
                        {c.exchangeState === 'unlocked' && (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                            🤝 Contacts Shared
                          </span>
                        )}
                      </div>
                    </div>

                    {c.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-rose-900 text-amber-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Privacy notice banner */}
            <div className="p-3 rounded-2xl bg-stone-100 border border-stone-200/80 flex items-start gap-2.5 text-xs text-stone-600">
              <Shield className="w-4 h-4 text-rose-800 shrink-0 mt-0.5" />
              <p>
                Phone numbers and personal emails remain protected. You may request a mutual contact exchange when you both feel ready.
              </p>
            </div>
          </motion.div>
        ) : (
          /* ACTIVE CHAT THREAD VIEW */
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`flex flex-col min-h-0 h-[calc(100dvh-11rem)] overflow-x-hidden ${themeStyle.shell}`}
          >
            {/* Thread Header */}
            <div className={`flex items-center justify-between gap-2 pb-2.5 border-b mb-2 ${themeStyle.header}`}>
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setActiveConvId(null)}
                  className={`p-1.5 rounded-full hover:bg-black/5 transition cursor-pointer shrink-0 ${themeStyle.icon}`}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activeConv.otherUser?.photos?.[0] || PLACEHOLDER_PHOTO}
                  alt={activeConv.otherUser?.displayName}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
                <div className="min-w-0">
                  <h3 className={`font-serif font-bold text-sm truncate ${themeStyle.title}`}>
                    {activeConv.otherUser?.displayName}
                  </h3>
                  <div className={`flex flex-wrap items-center gap-1.5 text-[9px] leading-tight mt-0.5 ${themeStyle.meta}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${otherOnline ? 'bg-emerald-500' : 'bg-stone-300'}`}></span>
                    <span className={otherTyping ? 'text-rose-700 font-semibold' : otherOnline ? 'text-emerald-700' : 'text-stone-500'}>
                      {otherTyping
                      ? `${activeConv.otherUser?.displayName || 'Match'} is typing…`
                      : otherOnline ? 'Active now' : 'Offline'}
                    </span>
                    <span className="text-stone-300">•</span>
                    <span>{formatRemainingTime(activeConv.expiresAt)}</span>
                    {disappearingMode !== 'off' && (
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap ${themeStyle.badge}`}>
                        Disappearing {disappearingLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Header Action Menu */}
              <div className="flex items-center gap-0.5 shrink-0">
                {activeConv.otherUser?.id && (
                  <CallOverlay
                    matchId={activeConv.matchId || activeConv.id}
                    myId={myId}
                    peerId={activeConv.otherUser.id}
                    peerName={activeConv.otherUser.displayName || 'Match'}
                  />
                )}
                <button
                  type="button"
                  onClick={() => { setShowMessageSearch((v) => !v); setShowStarredOnly(false); }}
                  className={`p-1.5 rounded-full transition cursor-pointer ${showMessageSearch ? 'bg-black/10' : 'hover:bg-black/5'} ${themeStyle.icon}`}
                  aria-label="Search messages"
                  title="Search messages"
                >
                  <Search className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setShowStarredOnly((v) => !v); setShowMessageSearch(false); }}
                  className={`p-1.5 rounded-full transition cursor-pointer ${showStarredOnly ? 'bg-black/10' : 'hover:bg-black/5'} ${themeStyle.icon}`}
                  aria-label="Show starred messages"
                  title="Show starred messages"
                >
                  <Star className={`w-4 h-4 ${showStarredOnly ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  onClick={() => setShowOptionsModal(true)}
                  className={`p-1.5 rounded-full hover:bg-black/5 transition cursor-pointer ${themeStyle.icon}`}
                  aria-label="Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

              </div>
            </div>

            {/* MUTUAL CONTACT EXCHANGE UNLOCKED CARD */}
            {liveUi === 'declined' && (
              <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-600 mb-2">
                Contact request declined. You may request again when you both feel ready.
              </div>
            )}

            {showContactExchange && activeConv.exchangeState === 'unlocked' && activeConv.otherUserContact && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative p-3.5 bg-[#2a2422] border border-white/10 rounded-2xl shadow-xs text-xs text-[#f3ece6] space-y-2 mb-2 min-w-0"
              >
                <button
                  type="button"
                  onClick={() => setShowContactExchange(false)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center transition cursor-pointer"
                  aria-label="Close contact exchange"
                  title="Close contact exchange"
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>
                <div className="flex items-center justify-between text-amber-100 font-bold gap-2 min-w-0 pr-11">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                    <span className="truncate">Mutual Contact Exchange Unlocked!</span>
                  </div>
                  <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-md font-semibold shrink-0">
                    Verified
                  </span>
                </div>
                <p className="text-[11px] text-stone-300">
                  You and {activeConv.otherUser?.displayName} have both mutually agreed to move beyond the platform:
                </p>
                <p className="text-[11px] text-amber-200/90">
                  Only share your contact details when you're comfortable with this person.
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 min-w-0">
                  <div className="p-2.5 bg-[#1c1917] rounded-xl border border-white/10 flex flex-col justify-between min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-stone-400">
                      <Phone className="w-3 h-3 text-rose-400" />
                      <span>Phone / WhatsApp</span>
                    </div>
                    <a
                      href={phoneShown ? `tel:${phoneShown}` : undefined}
                      className="font-bold text-[#f3ece6] text-xs mt-1 break-all"
                    >
                      {phoneShown || activeConv.otherUserContact.phone || 'No phone on file'}
                    </a>
                    <button
                      onClick={() => phoneShown && handleCopyPhone(phoneShown)}
                      disabled={!phoneShown}
                      className="mt-1 text-[10px] font-semibold text-amber-300 flex items-center gap-1 disabled:opacity-40"
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied ? 'Copied' : 'Copy Number'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 bg-[#1c1917] rounded-xl border border-white/10 flex flex-col justify-between min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-stone-400">
                      <Mail className="w-3 h-3 text-rose-400" />
                      <span>Verified Email</span>
                    </div>
                    <span className="font-bold text-[#f3ece6] text-xs mt-1 truncate">
                      {activeConv.otherUserContact.email}
                    </span>
                    <a
                      href={`mailto:${activeConv.otherUserContact.email}`}
                      className="mt-1 text-[10px] font-semibold text-amber-300 flex items-center gap-1"
                    >
                      <span>Send Email</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* PENDING NOTIFICATION BANNER */}
            {activeConv.exchangeState === 'pending_me' && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-800" />
                  <span>
                    Exchange request sent. Waiting for {activeConv.otherUser?.displayName} to consent.
                  </span>
                </div>
              </div>
            )}

            {activeConv.exchangeState === 'pending_them' && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-stone-900 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>
                    {activeConv.otherUser?.displayName} requested to exchange contacts!
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDeclineExchange}
                    className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white text-stone-700 font-bold text-[11px] cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    onClick={handleRequestExchange}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 text-stone-950 font-bold text-[11px] shadow-2xs hover:bg-amber-300 cursor-pointer"
                  >
                    Approve
                  </button>
                </div>
              </div>
            )}

            {showMessageSearch && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-stone-100 border border-stone-200 px-3 py-2">
                <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Search messages"
                  className="flex-1 min-w-0 bg-transparent outline-none text-xs text-stone-800 placeholder:text-stone-400"
                  autoFocus
                />
                {messageSearch && (
                  <button type="button" onClick={() => setMessageSearch('')} className="text-stone-400 hover:text-stone-700" aria-label="Clear search">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {showStarredOnly && (
              <div className="mb-2 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900">
                <span className="font-semibold">Starred messages</span>
                <button type="button" onClick={() => setShowStarredOnly(false)} className="font-semibold">Show all</button>
              </div>
            )}

            {/* Message Stream */}
            <div className="relative flex-1 min-h-0">
            <div ref={messagesContainerRef} className="h-full overflow-y-auto space-y-3 pr-1 py-1">
              {visibleMessages.map((m, index) => {
                const isMine = m.senderId === myId;
                const previous = currentMessages[index - 1];
                const currentDay = new Date(m.createdAt);
                const previousDay = previous ? new Date(previous.createdAt) : null;
                const showDateSeparator = !previous ||
                  currentDay.toDateString() !== previousDay?.toDateString();
                const dateLabel = currentDay.toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                });
                return (
                  <React.Fragment key={`message-group-${m.id}`}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center py-1">
                      <span className={`px-3 py-1 rounded-full border text-[10px] font-semibold ${themeStyle.dateChip}`}>
                        {dateLabel}
                      </span>
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1 max-w-[92%]">
                      <SwipeToReply
                        mine={isMine}
                        onReply={() => {
                          setReplyTarget(m);
                          setMessageMenuId(null);
                        }}
                      >
                      <div
                        ref={(node) => { messageRefs.current[m.id] = node; }}
                        className="relative max-w-full min-w-0"
                        onContextMenu={(e) => { e.preventDefault(); setMessageMenuId(m.id); }}
                      >
                        <div
                          onClick={() => setMessageMenuId((current) => current === m.id ? null : m.id)}
                          className={`max-w-full min-w-0 px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words cursor-pointer ${
                            isMine ? themeStyle.mine : themeStyle.theirs
                          }`}
                        >
                        {m.replyToPreview && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); if (m.replyToId && currentMessages.some((item) => item.id === m.replyToId)) scrollToMessage(m.replyToId); }} className={`mb-2 w-full text-left rounded-lg border-l-2 px-2 py-1 text-[10px] ${isMine ? 'border-amber-300 bg-white/10 text-white/80' : 'border-rose-300 bg-stone-100 text-stone-500'}`}>
                            <span className="block opacity-70">Replying to</span>
                            {m.replyToId && !currentMessages.some((item) => item.id === m.replyToId) ? 'Message unavailable' : m.replyToPreview}
                          </button>
                        )}
                        {m.kind === 'image' ? (
                          <ImageMessageBubble message={m} matchId={activeConvId || ''} />
                        ) : m.kind === 'audio' ? (
                          <VoiceMessageBubble message={m} matchId={activeConvId || ''} mine={isMine} />
                        ) : m.kind === 'viewOnce' || m.viewOnce ? (
                          <ViewOnceButton message={m} matchId={activeConvId || ''} mine={isMine} />
                        ) : (
                          m.content
                        )}
                        </div>

                        {messageMenuId === m.id && (
                          <div className={`mt-1 flex flex-wrap gap-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setReplyTarget(m); setMessageMenuId(null); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 shadow-sm px-3 py-2 text-[11px] font-bold text-stone-700">
                              <Reply className="w-3.5 h-3.5" /> Reply
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); setReactionMenuId((v) => v === m.id ? null : m.id); setMessageMenuId(null); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 shadow-sm px-3 py-2 text-[11px] font-bold text-stone-700">
                              <Smile className="w-3.5 h-3.5" /> React
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); void navigator.clipboard?.writeText(m.content || (m.kind === 'image' ? 'Photo' : m.kind === 'audio' ? 'Voice message' : 'Message')); setMessageMenuId(null); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 shadow-sm px-3 py-2 text-[11px] font-bold text-stone-700">
                              <Copy className="w-3.5 h-3.5" /> Copy
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); void handleStar(m); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 shadow-sm px-3 py-2 text-[11px] font-bold text-stone-700">
                              <Star className={`w-3.5 h-3.5 ${starredMessageIds.has(m.id) ? 'fill-amber-400 text-amber-500' : ''}`} /> {starredMessageIds.has(m.id) ? 'Unstar' : 'Star'}
                            </button>
                            {isMine && m.kind === 'text' && Number.isFinite(new Date(m.createdAt).getTime()) && Date.now() - new Date(m.createdAt).getTime() <= 10 * 60 * 1000 && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleStartEditing(m); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-stone-200 shadow-sm px-3 py-2 text-[11px] font-bold text-stone-700">
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            {isMine && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setMessageMenuId(null); setUnsendMessageId(m.id); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-rose-200 shadow-sm px-3 py-2 text-[11px] font-bold text-rose-700 disabled:text-stone-400">
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            )}
                            {!isMine && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setReportMessageTarget(m); setShowReportModal(true); setMessageMenuId(null); }} className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-rose-200 shadow-sm px-3 py-2 text-[11px] font-bold text-rose-700">
                                <Flag className="w-3.5 h-3.5" /> Report message
                              </button>
                            )}
                          </div>
                        )}
                        {reactionMenuId === m.id && (
                          <div className={`mt-1 flex gap-1 rounded-full bg-white border border-stone-200 shadow-lg px-2 py-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {['❤️','😂','👍','😮','😢','🙏'].map((emoji) => (
                              <button key={emoji} type="button" onClick={(e) => { e.stopPropagation(); void handleReact(m, emoji); }} className="w-8 h-8 rounded-full hover:bg-stone-100 text-base active:scale-90" aria-label={`React ${emoji}`}>{emoji}</button>
                            ))}
                          </div>
                        )}
                        {Object.entries(m.reactions || {}).flatMap(([emoji, users]) => users.includes(myId) || users.length ? [[emoji, users.length]] : []).map(([emoji, count]) => (
                          <span key={emoji as string} className="inline-flex items-center gap-1 mt-1 mr-1 px-2 py-0.5 rounded-full bg-white border border-stone-200 text-[10px] shadow-sm">{emoji as string} {count as number}</span>
                        ))}
                      </div>
                      </SwipeToReply>
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] mt-1 px-1 ${themeStyle.stamp}`}>
                      <span>{formatMessageTime(m.createdAt)}</span>
                      {(m as Message & { editedAt?: string }).editedAt && <span className="text-stone-400">· edited</span>}
                      {isMine && (m.readAt ? <CheckCheck className="w-3 h-3 text-sky-600" aria-label="Read" /> : <Check className="w-3 h-3 text-stone-400" aria-label="Sent" />)}
                    </div>
                  </motion.div>
                  </React.Fragment>
                );
              })}
              {visibleMessages.length === 0 && (
                <div className="py-12 text-center text-xs text-stone-400">
                  {showStarredOnly ? 'No starred messages yet.' : 'No messages found.'}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
              {showJumpToLatest && (
                <button
                  type="button"
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                    setShowJumpToLatest(false);
                    setNewMessagesWhileAway(0);
                  }}
                      className={`absolute bottom-3 right-3 z-[80] flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-2xl active:scale-95 pointer-events-auto ${themeStyle.jump}`}
                  aria-label="Jump to latest messages"
                  title="Jump to latest messages"
                >
                  <ArrowDown className="h-6 w-6" strokeWidth={3} />
                  {newMessagesWhileAway > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-white text-rose-900 text-[10px] font-bold flex items-center justify-center border border-rose-900">
                      {newMessagesWhileAway > 99 ? '99+' : newMessagesWhileAway}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Icebreaker Prompts for thoughtful communication */}
            {currentMessages.length < 5 && (
              <div className="py-1.5 overflow-x-auto max-w-full no-scrollbar flex gap-1.5 shrink-0">
                {getSmartIcebreakers(activeConv.otherUser).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="shrink-0 max-w-[85%] whitespace-nowrap overflow-hidden text-ellipsis px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] rounded-full border border-stone-200/70 transition cursor-pointer"
                  >
                    💡 {prompt}
                  </button>
                ))}
              </div>
            )}

            {sendError && (
              <p className="text-[11px] text-rose-700 px-1">{sendError}</p>
            )}

            {recordingError && (
              <div className="p-2.5 mb-1 bg-amber-50 text-amber-950 text-[11px] rounded-xl border border-amber-200 flex items-start gap-2">
                <MicOff className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{recordingError}</p>
                  <button
                    type="button"
                    onClick={() => setRecordingError(null)}
                    className="mt-1 font-semibold text-amber-900"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            <div className={`pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] shrink-0 ${themeStyle.composer}`}>
              {editingMessageId && !isRecording && !recordingPreview && (
                <div className="mb-1.5 flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-amber-900">Editing message</p>
                    <p className="text-[10px] text-stone-500 truncate">Change the text, then tap ✓</p>
                  </div>
                  <button type="button" onClick={handleCancelEditing} className="w-7 h-7 rounded-full hover:bg-amber-100 text-stone-500 flex items-center justify-center" aria-label="Cancel editing">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {replyTarget && !isRecording && !recordingPreview && !editingMessageId && (
                <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-stone-100 border border-stone-200 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-rose-900">Replying to {replyTarget.senderId === myId ? 'your message' : activeConv.otherUser?.displayName}</p>
                    <p className="text-[10px] text-stone-500 truncate">{replyTarget.content || (replyTarget.kind === 'image' ? 'Photo' : replyTarget.kind === 'audio' ? 'Voice message' : 'Message')}</p>
                  </div>
                  <button type="button" onClick={() => setReplyTarget(null)} className="w-7 h-7 rounded-full hover:bg-stone-200 text-stone-500 flex items-center justify-center" aria-label="Cancel reply">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {isRecording ? (
                <div className="flex items-center justify-between gap-2 bg-rose-50 rounded-2xl border border-rose-300 px-2.5 py-2 shadow-xs">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="h-9 px-2 rounded-full text-stone-600 hover:text-rose-900 hover:bg-rose-100 flex items-center justify-center gap-1.5 text-[11px] font-semibold shrink-0"
                    aria-label="Discard recording"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Discard</span>
                  </button>
                  <div className="flex items-center gap-2 text-rose-900 text-xs font-semibold min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                    <span>Recording {formatRecordTime(recordingDuration)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStopRecordingForPreview()}
                    className="px-3 py-2 rounded-full bg-rose-900 text-amber-200 text-xs font-semibold shrink-0"
                  >
                    Done
                  </button>
                </div>
              ) : recordingPreview ? (
                <div className="bg-stone-50 rounded-2xl border border-emerald-300 px-3 py-2.5 shadow-xs space-y-2">
                  <audio
                    ref={previewAudioRef}
                    src={recordingPreview.url}
                    preload="metadata"
                    onPlay={() => {
                      if (activeVoiceAudio && activeVoiceAudio !== previewAudioRef.current) {
                        activeVoiceAudio.pause();
                        activeVoiceAudio.currentTime = 0;
                      }
                      activeVoiceAudio = previewAudioRef.current;
                      setPreviewPlaying(true);
                    }}
                    onPause={() => {
                      if (activeVoiceAudio === previewAudioRef.current) activeVoiceAudio = null;
                      setPreviewPlaying(false);
                    }}
                    onEnded={() => {
                      if (activeVoiceAudio === previewAudioRef.current) activeVoiceAudio = null;
                      setPreviewPlaying(false);
                    }}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const audio = previewAudioRef.current;
                        if (!audio) return;
                        if (audio.paused) void audio.play();
                        else audio.pause();
                      }}
                      className="w-9 h-9 rounded-full bg-rose-900 text-white flex items-center justify-center shrink-0"
                      aria-label={previewPlaying ? 'Pause recording preview' : 'Play recording preview'}
                    >
                      {previewPlaying ? '❚❚' : '▶'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800">Review your recording</p>
                      <p className="text-[10px] text-stone-500">{formatRecordTime(Math.round(recordingPreview.duration))} · Not sent yet</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleDiscardPreview} className="flex-1 py-2 rounded-full border border-stone-300 text-stone-700 text-xs font-semibold">Discard</button>
                    <button type="button" onClick={() => void handleSendVoiceNote()} className="flex-1 py-2 rounded-full bg-rose-900 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5"><Send className="w-3.5 h-3.5" />Send</button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-end gap-1.5 rounded-2xl border px-2.5 py-1.5 shadow-xs focus-within:border-rose-800 min-w-0 ${themeStyle.input}`}>
                  <button
                    type="button"
                    onClick={() => void handleStartRecording()}
                    className="w-8 h-8 rounded-full text-stone-600 hover:text-rose-900 hover:bg-stone-100 flex items-center justify-center shrink-0"
                    aria-label="Record voice message"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file || !activeConvId) return;
                      void sendMatchImage(activeConvId, file, viewOnce).catch((err) =>
                        setSendError(err instanceof Error ? err.message : 'Could not send photo')
                      );
                      setViewOnce(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowMediaOptions(true)}
                    className="w-8 h-8 rounded-full p-1.5 text-stone-500 shrink-0 hover:bg-stone-100"
                    aria-label="Send photo"
                  >
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  <textarea
                    rows={1}
                    value={inputVal}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activeConv.otherUser?.displayName}...`}
                    className="flex-1 min-w-0 text-xs text-stone-800 bg-transparent outline-hidden px-1 py-1.5 resize-none break-words"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={!inputVal.trim()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 ${themeStyle.send}`}
                    aria-label={editingMessageId ? 'Save edited message' : 'Send message'}
                  >
                    {editingMessageId ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MEDIA SHARING OPTIONS */}
      <AnimatePresence>
        {showMediaOptions && (
          <div
            className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4"
            onClick={() => setShowMediaOptions(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base">Share a photo</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">Choose how the photo should be shared.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMediaOptions(false)}
                  className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-500 flex items-center justify-center"
                  aria-label="Close media options"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setViewOnce(false);
                  setShowMediaOptions(false);
                  photoInputRef.current?.click();
                }}
                className="w-full p-3 rounded-2xl border border-stone-200 hover:bg-stone-50 text-left flex items-center gap-3"
              >
                <span className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center">📷</span>
                <span>
                  <span className="block text-sm font-semibold">Send normally</span>
                  <span className="block text-[11px] text-stone-500">The photo remains in the conversation.</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewOnce(true);
                  setShowMediaOptions(false);
                  photoInputRef.current?.click();
                }}
                className="w-full p-3 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-left flex items-center gap-3"
              >
                <span className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">👁️</span>
                <span>
                  <span className="block text-sm font-semibold text-stone-900">View once</span>
                  <span className="block text-[11px] text-stone-600">The recipient can open it once.</span>
                </span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UNSEND CONFIRMATION */}
      <AnimatePresence>
        {unsendMessageId && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3"
            >
              <h3 className="font-serif font-bold text-base">Delete this message?</h3>
              <p className="text-xs text-stone-600 leading-relaxed">This removes the message for both you and the recipient. Voice notes and photos attached to it will also be removed.</p>
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={unsending} onClick={() => setUnsendMessageId(null)} className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold">Cancel</button>
                <button type="button" disabled={unsending} onClick={() => void handleUnsendMessage()} className="flex-1 py-2.5 rounded-xl bg-rose-900 text-white text-xs font-semibold disabled:opacity-50">
                  {unsending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BLOCKED USERS MODAL */}
      <AnimatePresence>
        {showBlockedUsers && (
          <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3 max-h-[80dvh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div>
                  <h3 className="font-serif font-bold text-base">Blocked users</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">Manage people you have blocked.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBlockedUsers(false)}
                  className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-500 flex items-center justify-center"
                  aria-label="Close blocked users"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto space-y-2 pr-1">
                {loadingBlockedUsers ? (
                  <div className="py-8 text-center text-xs text-stone-500">Loading blocked users…</div>
                ) : blockedUserIds.length === 0 ? (
                  <div className="py-8 text-center">
                    <Shield className="w-7 h-7 text-stone-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-stone-700">No blocked users</p>
                    <p className="text-[11px] text-stone-500 mt-1">People you block will appear here.</p>
                  </div>
                ) : (
                  blockedUserIds.map((blockedId) => {
                    const stored = blockedProfiles.find((row) => row.userId === blockedId);
                    const match = Object.values(matchRecords).find(
                      (m) => m.user1Id === blockedId || m.user2Id === blockedId
                    );
                    const profile = match?.otherProfile;
                    const name = stored?.displayName || profile?.displayName || 'Blocked member';
                    const photo = stored?.photoUrl || profile?.photos?.[0] || PLACEHOLDER_PHOTO;
                    const isUnblocking = unblockingUserId === blockedId;

                    return (
                      <div key={blockedId} className="flex items-center gap-3 rounded-2xl border border-stone-200 p-3">
                        <img src={photo} alt="" className="w-11 h-11 rounded-full object-cover border border-stone-200 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-800 truncate">{name}</p>
                          <p className="text-[10px] text-stone-400 truncate">Blocked</p>
                        </div>
                        <button
                          type="button"
                          disabled={!!unblockingUserId}
                          onClick={() => void handleUnblock(blockedId)}
                          className="shrink-0 rounded-xl bg-stone-900 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                        >
                          {isUnblocking ? 'Unblocking…' : 'Unblock'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OPTIONS MENU MODAL */}
      <AnimatePresence>
        {showOptionsModal && activeConv && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <h3 className="font-serif font-bold text-base text-stone-900">
                  Connection Options
                </h3>
                <button
                  onClick={() => setShowOptionsModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-stone-900">Disappearing messages</p>
                    <p className="text-[10px] text-stone-500 mt-0.5">New messages disappear after the selected time.</p>
                  </div>
                  <span className="text-[10px] font-semibold text-rose-900">{disappearingLabel}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    ['off', 'Off'],
                    ['24h', '24h'],
                    ['7d', '7d'],
                    ['30d', '30d']
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={savingDisappearing}
                      onClick={() => void handleSetDisappearingMode(mode)}
                      className={`py-2 rounded-xl text-[10px] font-bold border transition ${disappearingMode === mode ? 'bg-rose-900 text-white border-rose-900' : 'bg-white text-stone-600 border-stone-200 hover:border-rose-300'} disabled:opacity-50`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  setShowThemePicker(true);
                }}
                className="w-full p-3 rounded-2xl hover:bg-stone-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
              >
                <Palette className="w-4 h-4 text-stone-600" />
                <span>Chat Theme</span>
              </button>

              <div className="space-y-1.5 text-xs">
                {activeConv.exchangeState === 'unlocked' && activeConv.otherUserContact && (
                  <button
                    onClick={() => {
                      setShowOptionsModal(false);
                      setShowContactExchange(true);
                    }}
                    className="w-full p-3 rounded-2xl hover:bg-stone-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
                  >
                    <span className="text-base">🤝</span>
                    <span>View exchanged contacts</span>
                  </button>
                )}

                {activeConv.exchangeState !== 'unlocked' && (
                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    handleRequestExchange();
                  }}
                  className="w-full p-3 rounded-2xl hover:bg-stone-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
                >
                  <span className="text-base">🤝</span>
                  <span>Mutual Contact Exchange Request</span>
                </button>
                )}

                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setReportReason('');
                    setShowReportModal(true);
                  }}
                  className="w-full p-3 rounded-2xl hover:bg-amber-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>Report {activeConv.otherUser?.displayName}</span>
                </button>

                <button
                  onClick={() => void handleBlock()}
                  disabled={blockSubmitting}
                  className="w-full p-3 rounded-2xl hover:bg-rose-50 text-left flex items-center gap-3 transition cursor-pointer text-rose-800 font-medium disabled:opacity-50"
                >
                  <Shield className="w-4 h-4 text-rose-800" />
                  <span>{blockSubmitting ? 'Blocking…' : `Block ${activeConv.otherUser?.displayName}`}</span>
                </button>

                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setShowUnmatchConfirm(true);
                  }}
                  className="w-full p-3 rounded-2xl hover:bg-rose-50 text-left flex items-center gap-3 transition cursor-pointer text-rose-800 font-medium"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-800" />
                  <span>End Connection / Unmatch</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showThemePicker && activeConv && (
          <div className="fixed inset-0 z-[76] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-4" onClick={() => setShowThemePicker(false)}>
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3 max-h-[80dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base">Chat Theme</h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">Only changes how this conversation looks for you.</p>
                </div>
                <button type="button" onClick={() => setShowThemePicker(false)} className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-500 flex items-center justify-center" aria-label="Close themes">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5">
                {CHAT_THEME_OPTIONS.map((option) => {
                  const selected = chatTheme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void handleSetChatTheme(option.id)}
                      className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left ${selected ? 'border-rose-800 bg-rose-50' : 'border-stone-200 hover:bg-stone-50'}`}
                    >
                      <span className="flex h-8 w-12 overflow-hidden rounded-lg border border-black/10 shrink-0">
                        {option.swatch.map((color) => (
                          <span key={color} className="flex-1" style={{ background: color }} />
                        ))}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-stone-800">{option.label}</span>
                      {selected && <Check className="w-4 h-4 text-rose-800" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REPORT MODAL */}
      <AnimatePresence>
        {showReportModal && activeConv && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white text-stone-900 rounded-3xl p-5 shadow-2xl border border-stone-200 space-y-3"
            >
              <div>
                <h3 className="font-serif font-bold text-base">Report {reportMessageTarget ? 'message' : activeConv.otherUser?.displayName}</h3>
                <p className="text-xs text-stone-500 mt-1">Tell us what happened. Your report will be reviewed privately.</p>
              </div>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Briefly describe the issue…"
                className="w-full rounded-2xl border border-stone-200 px-3 py-2.5 text-xs outline-none focus:border-rose-700 resize-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold">Cancel</button>
                <button type="button" disabled={!reportReason.trim() || reportSubmitting} onClick={() => void handleReport()} className="flex-1 py-2.5 rounded-xl bg-rose-900 text-white text-xs font-semibold disabled:opacity-50">{reportSubmitting ? 'Submitting…' : 'Submit Report'}</button>
              </div>
              <button type="button" onClick={() => void handleBlock()} disabled={blockSubmitting} className="w-full py-2 text-xs font-semibold text-rose-800">{blockSubmitting ? 'Blocking…' : `Report and block ${activeConv.otherUser?.displayName}`}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* UNMATCH CONFIRMATION MODAL */}
      <AnimatePresence>
        {showUnmatchConfirm && activeConv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-white text-stone-900 rounded-3xl p-5 shadow-xl border border-stone-200 text-center space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-800 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-base text-stone-900">
                End Connection?
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                This will gracefully close this chat thread with {activeConv.otherUser?.displayName} and remove it from your active connections.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowUnmatchConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUnmatch}
                  className="flex-1 py-2.5 rounded-xl bg-rose-900 text-white text-xs font-semibold cursor-pointer"
                >
                  End Chat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
