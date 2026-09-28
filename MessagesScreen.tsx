import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Shield,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Phone,
  Mail,
  Copy,
  MoreVertical,
  AlertTriangle,
  Sparkles,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Trash2,
  PhoneCall,
  Video,
  ShieldAlert,
  UserX,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../lib/sound';
import { VoiceBubble } from '../chat/VoiceBubble';
import { startAudioRecording, createDemoVoiceAudioUrl, RecordingSession } from '../../lib/audioRecorder';
import { resolveDisplayName } from '../../lib/userNames';

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

const ICEBREAKER_PROMPTS = [
  'What are your non-negotiables for family life and mutual growth?',
  'How do you like to rest and unwind on quiet weekends?',
  'What does emotional safety mean to you in a long-term partnership?'
];

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ initialConversationId }) => {
  const {
    currentProfile,
    allProfiles,
    activeMatches,
    messages,
    sendMessage,
    markMessagesAsRead,
    endMatch
  } = useAuth();

  // Exchange states tracked per match
  const [exchangeStates, setExchangeStates] = useState<Record<string, ContactExchangeState>>({
    match_chukwudi_amaka: 'none'
  });

  // Active chat conversation
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    if (!initialConversationId) return null;
    return initialConversationId;
  });

  // Mark received messages as read when opening conversation
  useEffect(() => {
    if (activeConvId) {
      markMessagesAsRead(activeConvId);
    }
  }, [activeConvId, markMessagesAsRead, messages]);

  // Build real conversation list from activeMatches involving currentProfile
  const conversations: ConversationWithMeta[] = useMemo(() => {
    if (!currentProfile) return [];

    return activeMatches
      .filter((m) => m.user1Id === currentProfile.userId || m.user2Id === currentProfile.userId)
      .map((m) => {
        const otherUserId = m.user1Id === currentProfile.userId ? m.user2Id : m.user1Id;
        const otherProfile = allProfiles.find((p) => p.userId === otherUserId);
        const matchMsgs = messages[m.id] || [];
        const lastMsg = matchMsgs[matchMsgs.length - 1];

        const exState = exchangeStates[m.id] || 'none';

        const resolvedName = resolveDisplayName(otherProfile);
        const safeEmail = otherProfile?.displayName
          ? `${resolvedName.toLowerCase().replace(/\s+/g, '')}@intentionalpartner.org`
          : 'partner@intentionalpartner.org';
        const safePhone = otherProfile?.phone || otherProfile?.whatsapp || '+234 803 762 9104';

        const lastText = lastMsg
          ? lastMsg.type === 'voice'
            ? '🎤 Voice note'
            : lastMsg.content
          : 'Connection started! Send an intentional greeting.';

        return {
          id: m.id,
          matchId: m.id,
          participantIds: [m.user1Id, m.user2Id],
          otherUser: otherProfile || {
            id: 'prof_unknown',
            userId: otherUserId,
            displayName: 'Match Candidate',
            age: 28,
            gender: 'female',
            location: 'Lagos, Nigeria',
            profession: 'Professional',
            education: 'University Degree',
            bio: '',
            photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800'],
            interests: [],
            values: [],
            relationshipGoal: '',
            lifestyle: { faith: 'Christian' },
            isVerified: true,
            isVisible: true,
            createdAt: '',
            updatedAt: ''
          },
          lastMessageText: lastText,
          lastMessageAt: lastMsg ? lastMsg.createdAt : 'Just now',
          unreadCount: 0,
          expiresAt: m.expiresAt,
          exchangeState: exState,
          otherUserContact: {
            phone: safePhone,
            email: safeEmail
          }
        };
      });
  }, [activeMatches, currentProfile, allProfiles, messages, exchangeStates]);

  // Keep activeConv in sync
  const activeConv = conversations.find((c) => c.id === activeConvId || c.matchId === activeConvId) || null;

  // Active message list
  const currentMessages = activeConv ? messages[activeConv.id] || [] : [];

  // Input state
  const [inputVal, setInputVal] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeConvId, isRecording]);

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recordingSession) {
        recordingSession.cancel();
      }
    };
  }, [recordingSession]);

  // Handle send text message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || !activeConv) return;

    sendMessage(activeConv.id, text);
    sounds.playSend();
    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Handle start audio recording
  const handleStartRecording = async () => {
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
    } catch (err: unknown) {
      console.warn('Microphone recording access unavailable:', err);
      const isPermissionDenied =
        err instanceof Error &&
        (err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError' ||
          err.message.toLowerCase().includes('permission') ||
          err.message.toLowerCase().includes('not allowed'));

      if (isPermissionDenied) {
        setRecordingError('Microphone permission blocked. Click "Allow" in browser bar or send sample voice note.');
      } else {
        const msg = err instanceof Error ? err.message : 'Microphone is currently unavailable.';
        setRecordingError(msg);
      }
    }
  };

  // Quick fallback to send sample voice note if mic permission is blocked in iframe/browser
  const handleSendSampleVoiceNote = () => {
    if (!activeConv) return;
    const sampleAudioUrl = createDemoVoiceAudioUrl();
    sendMessage(activeConv.id, {
      type: 'voice',
      audioUrl: sampleAudioUrl,
      audioDuration: 4,
      content: 'Voice note (0:04)'
    });
    sounds.playSend();
    setRecordingError(null);
  };

  // Handle cancel audio recording
  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingSession) {
      recordingSession.cancel();
      setRecordingSession(null);
    }
    setIsRecording(false);
    setRecordingDuration(0);
  };

  // Handle finish and send audio recording
  const handleSendVoiceNote = async () => {
    if (!activeConv || !recordingSession) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      const result = await recordingSession.stop();
      setRecordingSession(null);
      setIsRecording(false);
      setRecordingDuration(0);

      const mins = Math.floor(result.duration / 60);
      const secs = (result.duration % 60).toString().padStart(2, '0');

      sendMessage(activeConv.id, {
        type: 'voice',
        audioUrl: result.dataUrl,
        audioDuration: result.duration,
        content: `Voice note (${mins}:${secs})`
      });

      sounds.playSend();
    } catch (err) {
      console.error('Error stopping recording:', err);
      handleCancelRecording();
    }
  };

  // Format recording timer
  const formatRecordTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Contact Exchange Trigger
  const handleRequestExchange = () => {
    if (!activeConv) return;
    const currentState = exchangeStates[activeConv.id] || 'none';

    if (currentState === 'pending_them') {
      sounds.playMatchCelebration();
      setExchangeStates((prev) => ({ ...prev, [activeConv.id]: 'unlocked' }));
    } else {
      sounds.playSend();
      setExchangeStates((prev) => ({ ...prev, [activeConv.id]: 'pending_me' }));
    }
  };

  // End match / Unmatch
  const handleConfirmUnmatch = () => {
    if (!activeConv) return;
    endMatch(activeConv.id);
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
    <div className="h-full">
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
                Discreet, private dialogues with your intentional matches
              </p>
            </div>

            {conversations.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-6 space-y-2">
                <MessageSquare className="w-8 h-8 text-stone-300 mx-auto" />
                <h3 className="font-serif font-bold text-stone-800 text-base">
                  No Active Chats
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto">
                  When you match with an intentional candidate, your private 7-day conversation window will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {conversations.map((c) => {
                  const displayName = resolveDisplayName(c.otherUser);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveConvId(c.id)}
                      className="w-full bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-2xs hover:border-rose-300 text-left flex items-center gap-3.5 transition active:scale-98 cursor-pointer"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={c.otherUser?.photos[0]}
                          alt={displayName}
                          className="w-13 h-13 rounded-full object-cover border border-stone-200"
                        />
                        {c.unreadCount > 0 && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif font-bold text-base text-stone-900 truncate">
                            {displayName}
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
                    </button>
                  );
                })}
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
            className="flex flex-col h-[calc(100vh-13.5rem)]"
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
                  src={activeConv.otherUser?.photos[0]}
                  alt={resolveDisplayName(activeConv.otherUser)}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-serif font-bold text-sm text-stone-900">
                    {resolveDisplayName(activeConv.otherUser)}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Active in 7-day window</span>
                  </div>
                </div>
              </div>

              {/* Header Action Menu */}
              <div className="flex items-center gap-1.5">
                {activeConv.exchangeState !== 'unlocked' && (
                  <button
                    onClick={handleRequestExchange}
                    disabled={activeConv.exchangeState === 'pending_me'}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      activeConv.exchangeState === 'pending_me'
                        ? 'bg-stone-100 text-stone-500 border border-stone-200 cursor-default'
                        : activeConv.exchangeState === 'pending_them'
                        ? 'bg-amber-400 text-stone-950 font-bold border border-amber-500 shadow-2xs'
                        : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <span>🤝</span>
                    <span>
                      {activeConv.exchangeState === 'pending_me'
                        ? 'Request Sent'
                        : activeConv.exchangeState === 'pending_them'
                        ? 'Accept Contacts'
                        : 'Exchange Contacts'}
                    </span>
                  </button>
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

            {/* Notice Modal / Toast */}
            {infoNotice && (
              <div className="mb-2 p-2.5 rounded-xl bg-stone-900 text-amber-100 text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-300" />
                  {infoNotice}
                </span>
                <button
                  onClick={() => setInfoNotice(null)}
                  className="text-stone-400 hover:text-white text-[11px] underline ml-2 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Expiration Countdown Reminder Banner */}
            <div className="py-1 px-3 bg-amber-50/90 border border-amber-200 rounded-xl text-center text-[11px] text-amber-900 flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold">
                  {formatRemainingTime(activeConv.expiresAt)} in this connection window
                </span>
              </div>
              <span className="text-[10px] text-stone-500">7-day intentional window</span>
            </div>

            {/* MUTUAL CONTACT EXCHANGE UNLOCKED CARD */}
            {activeConv.exchangeState === 'unlocked' && activeConv.otherUserContact && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl shadow-xs text-xs text-stone-800 space-y-2 mb-2"
              >
                <div className="flex items-center justify-between text-emerald-950 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Mutual Contact Exchange Unlocked!</span>
                  </div>
                  <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md font-semibold">
                    Verified
                  </span>
                </div>
                <p className="text-[11px] text-stone-600">
                  You and {resolveDisplayName(activeConv.otherUser)} have both mutually agreed to share personal details:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-stone-500">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>Phone / WhatsApp</span>
                    </div>
                    <span className="font-bold text-stone-900 text-xs mt-1 truncate">
                      {activeConv.otherUserContact.phone}
                    </span>
                    <button
                      onClick={() => handleCopyPhone(activeConv.otherUserContact!.phone)}
                      className="mt-1 text-[10px] font-semibold text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{isCopied ? 'Copied' : 'Copy Number'}</span>
                    </button>
                  </div>

                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-stone-500">
                      <Mail className="w-3 h-3 text-emerald-600" />
                      <span>Verified Email</span>
                    </div>
                    <span className="font-bold text-stone-900 text-xs mt-1 truncate">
                      {activeConv.otherUserContact.email}
                    </span>
                    <a
                      href={`mailto:${activeConv.otherUserContact.email}`}
                      className="mt-1 text-[10px] font-semibold text-emerald-700 flex items-center gap-1 hover:underline"
                    >
                      <span>Send Email</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
              {currentMessages.map((m) => {
                const isMine = Boolean(currentProfile && m.senderId === currentProfile.userId);
                const isVoice = m.type === 'voice' && m.audioUrl;
                const isRead = m.status === 'read';

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-rose-900 text-white rounded-br-xs'
                          : 'bg-white text-stone-800 border border-stone-200/90 rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {isVoice ? (
                        <VoiceBubble
                          audioUrl={m.audioUrl}
                          duration={m.audioDuration}
                          isMine={isMine}
                        />
                      ) : (
                        <span>{m.content}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-stone-400 mt-1 px-1">
                      <span>{m.createdAt}</span>
                      {isMine && (
                        isRead ? (
                          <CheckCheck
                            className="w-3.5 h-3.5 text-sky-500"
                            aria-label={`Read at ${m.readAt || m.createdAt}`}
                          />
                        ) : (
                          <Check
                            className="w-3 h-3 text-stone-400"
                            aria-label="Sent"
                          />
                        )
                      )}
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Icebreaker Prompts for thoughtful communication */}
            {currentMessages.length < 5 && !isRecording && (
              <div className="py-1.5 overflow-x-auto no-scrollbar flex gap-1.5 shrink-0">
                {ICEBREAKER_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="whitespace-nowrap px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] rounded-full border border-stone-200/70 transition cursor-pointer"
                  >
                    💡 {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Recording error / Permission guidance banner */}
            {recordingError && (
              <div className="p-3 mb-2 bg-amber-50 text-amber-950 text-xs rounded-2xl border border-amber-200 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <MicOff className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Microphone Permission Required</span>
                  </div>
                  <button
                    onClick={() => setRecordingError(null)}
                    className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer p-0.5"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  Microphone access was denied or is blocked by your browser/iframe permissions. Click the lock/camera icon in your address bar to allow microphone access, or send a sample voice note below:
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={handleSendSampleVoiceNote}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-[11px] font-bold shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-stone-900" />
                    <span>Send Sample Voice Note (0:04)</span>
                  </button>
                  <button
                    onClick={() => setRecordingError(null)}
                    className="px-3 py-1.5 rounded-xl border border-stone-300 text-stone-700 text-[11px] font-semibold hover:bg-white cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Touch Input Bar with Voice Recording */}
            <div className="pt-2">
              {isRecording ? (
                /* ACTIVE RECORDING COMPOSER: [Cancel] 🔴 Recording 0:05 [Send] */
                <div className="flex items-center justify-between gap-3 bg-rose-50/90 rounded-full border border-rose-300 px-3 py-1.5 shadow-xs transition animate-pulse">
                  <button
                    onClick={handleCancelRecording}
                    className="p-2 rounded-full text-stone-500 hover:text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                    title="Cancel recording"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 text-rose-900 font-medium text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                    <span>Recording {formatRecordTime(recordingDuration)}</span>
                  </div>

                  <button
                    onClick={handleSendVoiceNote}
                    className="px-3 py-1.5 rounded-full bg-rose-900 hover:bg-rose-950 text-amber-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                    title="Send voice note"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              ) : (
                /* STANDARD CHAT COMPOSER: [Mic] [Message...] [Send] */
                <div className="flex items-center gap-2 bg-white rounded-full border border-stone-300 px-2 py-1 shadow-xs focus-within:border-rose-800 focus-within:ring-2 focus-within:ring-rose-800/10 transition">
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="w-8 h-8 rounded-full text-stone-600 hover:text-rose-900 hover:bg-stone-100 flex items-center justify-center transition active:scale-95 cursor-pointer"
                    title="Record voice note"
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${resolveDisplayName(activeConv.otherUser)}...`}
                    className="flex-1 text-xs text-stone-800 bg-transparent outline-hidden px-1 py-1.5"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!inputVal.trim()}
                    className="w-8 h-8 rounded-full bg-rose-900 hover:bg-rose-950 text-amber-200 flex items-center justify-center transition active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

      {/* SECONDARY OPTIONS MENU MODAL */}
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
                {/* Secondary Calls */}
                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setInfoNotice('Direct phone dialogue is available once contact exchange is mutually unlocked.');
                  }}
                  className="w-full p-2.5 rounded-2xl hover:bg-stone-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
                >
                  <PhoneCall className="w-4 h-4 text-emerald-700" />
                  <span>Request Voice Call</span>
                </button>

                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setInfoNotice('Video calling will be activated in the next verified release.');
                  }}
                  className="w-full p-2.5 rounded-2xl hover:bg-stone-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
                >
                  <Video className="w-4 h-4 text-blue-700" />
                  <span>Request Video Call</span>
                </button>

                {/* Contact Exchange */}
                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    handleRequestExchange();
                  }}
                  className="w-full p-2.5 rounded-2xl hover:bg-stone-50 text-left flex items-center gap-3 transition cursor-pointer text-stone-800 font-medium"
                >
                  <span className="text-base">🤝</span>
                  <span>Mutual Contact Exchange Request</span>
                </button>

                {/* Safety & Moderation */}
                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setInfoNotice('Report logged. Lifebencher concierge reviews all flagged interactions confidentially.');
                  }}
                  className="w-full p-2.5 rounded-2xl hover:bg-amber-50 text-left flex items-center gap-3 transition cursor-pointer text-amber-900 font-medium"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                  <span>Report Candidate</span>
                </button>

                <button
                  onClick={() => {
                    setShowOptionsModal(false);
                    setShowUnmatchConfirm(true);
                  }}
                  className="w-full p-2.5 rounded-2xl hover:bg-rose-50 text-left flex items-center gap-3 transition cursor-pointer text-rose-800 font-medium"
                >
                  <UserX className="w-4 h-4 text-rose-800" />
                  <span>Block & Unmatch</span>
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
                This will gracefully close this chat thread with {resolveDisplayName(activeConv.otherUser)} and remove it from your active connections.
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
