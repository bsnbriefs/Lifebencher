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
import { Conversation, Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../lib/sound';

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

const INITIAL_CONVERSATIONS: ConversationWithMeta[] = [
  {
    id: 'conv_1',
    matchId: 'match_1',
    participantIds: ['usr_me', 'usr_amaka'],
    otherUser: {
      id: 'prof_amaka',
      userId: 'usr_amaka',
      displayName: 'Amaka',
      age: 28,
      gender: 'female',
      location: 'Victoria Island, Lagos',
      profession: 'Senior Financial Analyst',
      education: 'B.Sc. Economics (Unilag)',
      bio: 'Warm, intentional, and family-oriented.',
      photos: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80'
      ],
      interests: ['Fine Art', 'Literature', 'Classical Jazz'],
      values: ['Faith & Family', 'Integrity'],
      relationshipGoal: 'Intentional courtship leading to marriage',
      lifestyle: { faith: 'Christian' },
      isVerified: true,
      isVisible: true,
      createdAt: '',
      updatedAt: ''
    },
    lastMessageText: 'I completely agree. Emotional safety and shared faith are non-negotiable for me.',
    lastMessageAt: '10:42 AM',
    unreadCount: 1,
    expiresAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    exchangeState: 'none',
    otherUserContact: {
      phone: '+234 803 555 0192',
      email: 'amaka.financial@gmail.com'
    }
  },
  {
    id: 'conv_2',
    matchId: 'match_2',
    participantIds: ['usr_me', 'usr_kemi'],
    otherUser: {
      id: 'prof_kemi',
      userId: 'usr_kemi',
      displayName: 'Kemi',
      age: 29,
      gender: 'female',
      location: 'Ikoyi, Lagos',
      profession: 'Pediatric Specialist',
      education: 'MBBS (King’s College London)',
      bio: 'Dedicated physician passionate about maternal health and quiet beach retreats.',
      photos: [
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80'
      ],
      interests: ['Medicine & Wellness', 'Jazz'],
      values: ['Integrity & Honesty', 'Family-Centered'],
      relationshipGoal: 'Long-term marriage with deep companionship',
      lifestyle: { faith: 'Christian' },
      isVerified: true,
      isVisible: true,
      createdAt: '',
      updatedAt: ''
    },
    lastMessageText: 'Have a wonderful shift at the clinic today!',
    lastMessageAt: 'Yesterday',
    unreadCount: 0,
    expiresAt: new Date(Date.now() + 0.8 * 86400000).toISOString(),
    exchangeState: 'pending_them', // Kemi has already requested an exchange!
    otherUserContact: {
      phone: '+234 812 444 8820',
      email: 'dr.kemi.pediatrics@gmail.com'
    }
  }
];

const INITIAL_MESSAGES: Record<string, Message[]> = {
  conv_1: [
    {
      id: 'm1',
      conversationId: 'conv_1',
      senderId: 'usr_amaka',
      content: 'Hello Chukwudi! It was wonderful reading your profile. I was particularly touched by your perspective on intentionality.',
      createdAt: '10:30 AM'
    },
    {
      id: 'm2',
      conversationId: 'conv_1',
      senderId: 'usr_me',
      content: 'Thank you Amaka. In a world full of superficiality, I believe building with depth and clarity of purpose makes all the difference.',
      createdAt: '10:35 AM'
    },
    {
      id: 'm3',
      conversationId: 'conv_1',
      senderId: 'usr_amaka',
      content: 'I completely agree. Emotional safety and shared faith are non-negotiable for me.',
      createdAt: '10:42 AM'
    }
  ],
  conv_2: [
    {
      id: 'm2_1',
      conversationId: 'conv_2',
      senderId: 'usr_me',
      content: 'Hello Dr. Kemi, wishing you a productive morning at the hospital.',
      createdAt: 'Yesterday 8:00 AM'
    },
    {
      id: 'm2_2',
      conversationId: 'conv_2',
      senderId: 'usr_kemi',
      content: 'Thank you Chukwudi! Rounds were quite intense, but saving little lives makes every minute worthwhile.',
      createdAt: 'Yesterday 4:15 PM'
    }
  ]
};

const ICEBREAKER_PROMPTS = [
  'What are your non-negotiables for family life and mutual growth?',
  'How do you like to rest and unwind on quiet weekends?',
  'What does emotional safety mean to you in a long-term partnership?'
];

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ initialConversationId }) => {
  const { currentProfile } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithMeta[]>(INITIAL_CONVERSATIONS);

  // Active chat conversation
  const [activeConvId, setActiveConvId] = useState<string | null>(() => {
    if (!initialConversationId) return null;
    const found = INITIAL_CONVERSATIONS.find(
      (c) => c.id === initialConversationId || c.matchId === initialConversationId
    );
    return found ? found.id : null;
  });

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  // Messages dictionary
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const currentMessages = activeConvId ? allMessages[activeConvId] || [] : [];

  // Input state
  const [inputVal, setInputVal] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);

  // Auto-scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages, activeConvId]);

  // Handle send message
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text || !activeConvId) return;

    const newMsg: Message = {
      id: 'm_' + Date.now(),
      conversationId: activeConvId,
      senderId: 'usr_me',
      content: text,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setAllMessages((prev) => ({
      ...prev,
      [activeConvId]: [...(prev[activeConvId] || []), newMsg]
    }));

    sounds.playSend();

    // Update conversation snippet
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              lastMessageText: text,
              lastMessageAt: 'Just now',
              unreadCount: 0
            }
          : c
      )
    );

    setInputVal('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // Contact Exchange Trigger
  const handleRequestExchange = () => {
    if (!activeConvId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          if (c.exchangeState === 'pending_them') {
            // Both have agreed -> UNLOCK!
            sounds.playMatchCelebration();
            return { ...c, exchangeState: 'unlocked' };
          }
          sounds.playSend();
          return { ...c, exchangeState: 'pending_me' };
        }
        return c;
      })
    );
  };

  // End match / Unmatch
  const handleConfirmUnmatch = () => {
    if (!activeConvId) return;
    setConversations((prev) => prev.filter((c) => c.id !== activeConvId));
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
                        src={c.otherUser?.photos[0]}
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
                  src={activeConv.otherUser?.photos[0]}
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
                <button
                  onClick={handleRequestExchange}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 text-stone-950 font-bold text-[11px] shadow-2xs hover:bg-amber-300 cursor-pointer"
                >
                  Accept & Reveal
                </button>
              </div>
            )}

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
              {currentMessages.map((m) => {
                const isMine = m.senderId === 'usr_me';
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
                      <span>{m.createdAt}</span>
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
