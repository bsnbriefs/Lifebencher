import React, { useState, useEffect, useRef } from 'react';
import {
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
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Conversation, Message, Match } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../lib/sound';
import { endMatch, listenUserMatches } from '../../lib/matches';
import { formatMessageTime, listenLatestMessage, listenMatchMessages, sendMatchMessage } from '../../lib/chat';
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
          .filter((m) => m.status === 'active')
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

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
                  You and {activeConv.otherUser?.displayName} have both mutually agreed to move beyond the platform:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200 flex flex-col justify-between">
                    <div className="flex items-center gap-1 text-[11px] text-stone-500">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>Phone / WhatsApp</span>
                    </div>
                    <a
                      href={`tel:${activeConv.otherUserContact.phone}`}
                      className="font-bold text-stone-900 text-xs mt-1 truncate"
                    >
                      {activeConv.otherUserContact.phone}
                    </a>
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
              <div className="p-2.5 bg-amber-100 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-center justify-between mb-2">
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
                      className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? 'bg-rose-900 text-white rounded-br-xs'
                          : 'bg-white text-stone-800 border border-stone-200/90 rounded-bl-xs shadow-2xs'
                      }`}
                    >
                      {m.content}
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

            {sendError && (
              <p className="text-[11px] text-rose-700 px-1">{sendError}</p>
            )}

            {/* Touch Input Bar */}
            <div className="pt-2">
              <div className="flex items-center gap-2 bg-white rounded-full border border-stone-300 px-3 py-1.5 shadow-xs focus-within:border-rose-800 focus-within:ring-2 focus-within:ring-rose-800/10 transition">
                <input
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeConv.otherUser?.displayName}...`}
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
