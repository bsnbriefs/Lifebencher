import React, { useState, useEffect, useRef } from 'react';
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
  MoreVertical,
  AlertTriangle,
  Sparkles,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, Match } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../lib/sound';
import { endMatch, listenUserMatches } from '../../lib/matches';
import { formatMessageTime, listenLatestMessage, listenMatchMessages, resolveChatMediaUrl, sendMatchAudio, sendMatchImage, sendMatchMessage } from '../../lib/chat';
import { RecordingSession, startAudioRecording } from '../../lib/audioRecorder';
import {
  declineContactExchange,
  exchangeUiState,
  listenContactExchange,
  requestOrApproveContact
} from '../../lib/contactExchange';
import { ContactExchangeRequest } from '../../types';

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

const PLACEHOLDER_PHOTO =
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80';

const ICEBREAKER_PROMPTS = [
  'What are your non-negotiables for family life and mutual growth?',
  'How do you like to rest and unwind on quiet weekends?',
  'What does emotional safety mean to you in a long-term partnership?'
];

const VoiceMessageBubble: React.FC<{ message: Message; matchId: string; mine: boolean }> = ({ message, matchId, mine }) => {
  const [url, setUrl] = useState<string | null>((message as Message & { audioUrl?: string }).audioUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioPath = (message as Message & { audioPath?: string }).audioPath || '';

  const loadAudio = async () => {
    if (url || !audioPath || loading) return;
    setLoading(true);
    setError(null);
    try {
      const resolved = await resolveChatMediaUrl(matchId, audioPath);
      setUrl(resolved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to play this voice message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-[190px] max-w-[240px]">
      {!url ? (
        <button
          type="button"
          onClick={() => void loadAudio()}
          disabled={loading || !audioPath}
          className={`w-full rounded-xl px-3 py-2 text-left font-medium transition ${
            mine ? 'bg-white/10 text-white' : 'bg-stone-100 text-stone-800'
          } ${loading ? 'opacity-60' : ''}`}
        >
          {loading ? 'Loading voice note…' : '▶ Play voice note'}
        </button>
      ) : (
        <audio
          controls
          preload="metadata"
          src={url}
          onError={() => {
            setUrl(null);
            setError('Unable to play this voice message. Please try again.');
          }}
          className="w-full h-9"
        />
      )}
      {error && <p className="text-[10px] mt-1 opacity-80">{error}</p>}
    </div>
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

  useEffect(() => {
    const hide = () => {
      if (open) {
        setOpen(false);
        clearUrl();
      }
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('blur', hide);
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
        setError(res.status === 410 ? '✓ Photo viewed' : 'Unable to load this photo. Please try again.');
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
    clearUrl();
  };

  return (
    <>
      <button type="button" onClick={() => void requestOpen()} className="text-left" disabled={consumed}>
        {consumed ? '✓ Photo viewed' : status === 'loading' ? 'Opening photo...' : '📷 View once photo'}
      </button>
      {error && !consumed && <p className="text-[10px] mt-1 opacity-80">{error}</p>}
      {open && url && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center p-4 overflow-hidden">
          <button type="button" onClick={close} className="absolute top-4 right-4 text-[#f3ece6] text-xs font-semibold">
            Close
          </button>
          <img
            src={url}
            alt=""
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onLoad={() => void onLoaded()}
            onError={() => {
              setOpen(false);
              setUrl(null);
              setStatus('error');
              setError('Unable to load this photo. Please try again.');
            }}
            className="max-w-full max-h-[80dvh] object-contain rounded-xl select-none"
          />
        </div>
      )}
    </>
  );
};

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ initialConversationId }) => {
  const { user } = useAuth();
  const myId = user?.id || '';
  const [matchRecords, setMatchRecords] = useState<Record<string, Match>>({});
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(initialConversationId || null);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [contactState, setContactState] = useState<ContactExchangeRequest | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        otherUserContact: otherContact
          ? { phone: otherContact.phone || '', email: otherContact.email || '' }
          : undefined
      }
    : null;

  useEffect(() => {
    if (!myId) return;
    return listenUserMatches(myId, (matches) => {
      const record: Record<string, Match> = {};
      matches.forEach((m) => {
        record[m.id] = m;
      });
      setMatchRecords(record);
      setConversations((prev) => {
        const prevById = new Map(prev.map((c) => [c.matchId, c]));
        return matches
          .filter((m) => m.status !== 'ended')
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
  }, [myId]);

  useEffect(() => {
    if (initialConversationId) setActiveConvId(initialConversationId);
  }, [initialConversationId]);

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
      return;
    }
    return listenMatchMessages(activeConvId, setCurrentMessages);
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeConvId]);

  useEffect(() => {
    if (!activeConvId) {
      setContactState(null);
      return;
    }
    const match = matchRecords[activeConvId];
    if (!match) return;
    return listenContactExchange(match.id, match.user1Id, match.user2Id, setContactState);
  }, [activeConvId, matchRecords]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || !activeConvId) return;
    setInputVal('');
    setSendError(null);
    sounds.playSend();
    try {
      await sendMatchMessage(activeConvId, text);
      void import('../../lib/aiClient').then(({ scanText }) =>
        scanText({ text, kind: 'message', targetId: activeConvId }).catch(() => undefined)
      );
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
    try {
      const session = await startAudioRecording();
      setRecordingSession(session);
      setIsRecording(true);
      setRecordingDuration(0);
      sounds.playTap();
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone is currently unavailable.';
      setRecordingError(message);
    }
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingSession?.cancel();
    setRecordingSession(null);
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handleSendVoiceNote = async () => {
    if (!activeConvId || !recordingSession) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      const result = await recordingSession.stop();
      await sendMatchAudio(activeConvId, result.blob, result.duration * 1000);
      sounds.playSend();
      setRecordingSession(null);
      setIsRecording(false);
      setRecordingDuration(0);
      setRecordingError(null);
    } catch (err) {
      setRecordingError(err instanceof Error ? err.message : 'Could not send voice note.');
      setRecordingSession(null);
      setIsRecording(false);
      setRecordingDuration(0);
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
      recordingSession?.cancel();
    };
  }, [recordingSession]);

  // Contact Exchange Trigger
  const handleRequestExchange = () => {
    const match = activeConvId ? matchRecords[activeConvId] : undefined;
    if (!match || !user) return;
    sounds.playSend();
    void requestOrApproveContact({
      matchId: match.id,
      user1Id: match.user1Id,
      user2Id: match.user2Id,
      myContact: {
        phone: user.phone || '',
        email: user.email,
        whatsapp: user.phone
      }
    }).then(() => {
      if (liveUi === 'pending_them') sounds.playMatchCelebration();
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
            className="flex flex-col min-h-0 h-[calc(100dvh-11rem)] overflow-x-hidden"
          >
            {/* Thread Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-stone-200 mb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="p-1.5 rounded-full hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <img
                  src={activeConv.otherUser?.photos?.[0] || PLACEHOLDER_PHOTO}
                  alt={activeConv.otherUser?.displayName}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-serif font-bold text-sm text-stone-900">
                    {activeConv.otherUser?.displayName}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Active in window</span>
                  </div>
                </div>
              </div>

              {/* Header Action Menu */}
              <div className="flex items-center gap-1.5">
                {activeConv.exchangeState === 'none' && (
                  <button
                    onClick={handleRequestExchange}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-900 border border-rose-200"
                  >
                    Exchange Contacts
                  </button>
                )}
                {activeConv.exchangeState === 'pending_me' && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-stone-100 text-stone-500 border border-stone-200">
                    Request Sent
                  </span>
                )}

                <button
                  onClick={() => setShowOptionsModal(true)}
                  className="p-1.5 rounded-full hover:bg-stone-200 text-stone-600 transition cursor-pointer"
                  aria-label="Options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expiration Countdown Reminder Banner */}
            <div className="py-1 px-3 bg-amber-50/90 border border-amber-200 rounded-xl text-center text-[11px] text-amber-900 flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold">
                  {formatRemainingTime(activeConv.expiresAt)} in this connection window
                </span>
              </div>
              <span className="text-[10px] text-stone-500">Extends on mutual agreement</span>
            </div>

            {/* MUTUAL CONTACT EXCHANGE UNLOCKED CARD */}
            {liveUi === 'declined' && (
              <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-600 mb-2">
                Contact request declined. You may request again when you both feel ready.
              </div>
            )}

            {activeConv.exchangeState === 'unlocked' && activeConv.otherUserContact && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 bg-[#2a2422] border border-white/10 rounded-2xl shadow-xs text-xs text-[#f3ece6] space-y-2 mb-2 min-w-0"
              >
                <div className="flex items-center justify-between text-amber-100 font-bold gap-2 min-w-0">
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

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 min-w-0">
                  <div className="p-2.5 bg-[#1c1917] rounded-xl border border-white/10 flex flex-col justify-between min-w-0">
                    <div className="flex items-center gap-1 text-[11px] text-stone-400">
                      <Phone className="w-3 h-3 text-rose-400" />
                      <span>Phone / WhatsApp</span>
                    </div>
                    <a
                      href={`tel:${activeConv.otherUserContact.phone}`}
                      className="font-bold text-[#f3ece6] text-xs mt-1 truncate"
                    >
                      {activeConv.otherUserContact.phone}
                    </a>
                    <button
                      onClick={() => handleCopyPhone(activeConv.otherUserContact!.phone)}
                      className="mt-1 text-[10px] font-semibold text-amber-300 flex items-center gap-1"
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

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
              {currentMessages.map((m) => {
                const isMine = m.senderId === myId;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] min-w-0 px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                        isMine
                          ? 'bg-rose-900 text-white rounded-br-xs'
                          : 'bg-white text-stone-800 border border-stone-200/90 rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {m.kind === 'image' && m.imageUrl ? (
                        <img src={m.imageUrl} alt="" className="max-w-full rounded-xl mb-1" />
                      ) : m.kind === 'audio' ? (
                        <VoiceMessageBubble message={m} matchId={activeConvId || ''} mine={isMine} />
                      ) : m.kind === 'viewOnce' || m.viewOnce ? (
                        <ViewOnceButton message={m} matchId={activeConvId || ''} mine={isMine} />
                      ) : (
                        m.content
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-stone-400 mt-1 px-1">
                      <span>{formatMessageTime(m.createdAt)}</span>
                      {isMine && <CheckCheck className="w-3 h-3 text-rose-700" />}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Icebreaker Prompts for thoughtful communication */}
            {currentMessages.length < 5 && (
              <div className="py-1.5 overflow-x-auto max-w-full no-scrollbar flex gap-1.5 shrink-0">
                {ICEBREAKER_PROMPTS.map((prompt, idx) => (
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

            <label className="flex items-center gap-1.5 text-[10px] text-stone-500 px-1">
              <input type="checkbox" checked={viewOnce} onChange={(e) => setViewOnce(e.target.checked)} />
              View once (one tap for the recipient; does not stop screenshots)
            </label>

            <div className="pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] shrink-0">
              {isRecording ? (
                <div className="flex items-center justify-between gap-2 bg-rose-50 rounded-full border border-rose-300 px-2.5 py-1.5 shadow-xs">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="w-8 h-8 rounded-full text-stone-600 hover:text-rose-900 hover:bg-rose-100 flex items-center justify-center"
                    aria-label="Cancel recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 text-rose-900 text-xs font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
                    <span>Recording {formatRecordTime(recordingDuration)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSendVoiceNote()}
                    className="px-3 py-1.5 rounded-full bg-rose-900 text-amber-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-1.5 bg-white rounded-2xl border border-stone-300 px-2.5 py-1.5 shadow-xs focus-within:border-rose-800 min-w-0">
                  <button
                    type="button"
                    onClick={() => void handleStartRecording()}
                    className="w-8 h-8 rounded-full text-stone-600 hover:text-rose-900 hover:bg-stone-100 flex items-center justify-center shrink-0"
                    aria-label="Record voice note"
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
                    }}
                  />
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="w-8 h-8 rounded-full p-1.5 text-stone-500 shrink-0" aria-label="Send photo">
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  <textarea
                    rows={1}
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${activeConv.otherUser?.displayName}...`}
                    className="flex-1 min-w-0 text-xs text-stone-800 bg-transparent outline-hidden px-1 py-1.5 resize-none break-words"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={!inputVal.trim()}
                    className="w-8 h-8 rounded-full bg-rose-900 hover:bg-rose-950 text-amber-200 flex items-center justify-center transition active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    aria-label="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
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

              <div className="space-y-1.5 text-xs">
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
