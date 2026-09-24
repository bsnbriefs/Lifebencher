import React, { useState, useEffect } from 'react';
import {
  Heart,
  Clock,
  MessageCircle,
  Sparkles,
  X,
  ShieldCheck,
  ChevronRight,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Calendar,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, MatchRequest } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { sounds } from '../../lib/sound';
import { endMatch, extendMatch, listenUserMatches } from '../../lib/matches';
import { acceptInterest, declineInterest, listenIncomingInterests } from '../../lib/interests';

interface MatchesScreenProps {
  onOpenChat: (matchId: string) => void;
}

interface ExtensionPlan {
  id: string;
  days: number;
  label: string;
  sublabel: string;
  price: number;
  priceFormatted: string;
  badge?: string;
}

const EXTENSION_PLANS: ExtensionPlan[] = [
  {
    id: 'ext_7',
    days: 7,
    label: '7 Days Extension',
    sublabel: 'Standard connection window',
    price: 5000,
    priceFormatted: '₦5,000'
  },
  {
    id: 'ext_14',
    days: 14,
    label: '14 Days Extension',
    sublabel: 'Ideal for thoughtful courtship',
    price: 9000,
    priceFormatted: '₦9,000',
    badge: 'Recommended'
  },
  {
    id: 'ext_30',
    days: 30,
    label: '30 Days Courtship Extension',
    sublabel: 'Extended time to align deeply',
    price: 16000,
    priceFormatted: '₦16,000'
  }
];

export const MatchesScreen: React.FC<MatchesScreenProps> = ({ onOpenChat }) => {
  const { user, currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'matches' | 'requests'>('matches');

  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<MatchRequest[]>([]);

  // Celebration modal state
  const [celebrationMatch, setCelebrationMatch] = useState<{
    displayName: string;
    photo: string;
    matchId: string;
  } | null>(null);

  // Paystack extension modal state
  const [showExtendSheet, setShowExtendSheet] = useState<Match | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ExtensionPlan>(EXTENSION_PLANS[1]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [extensionSuccessMsg, setExtensionSuccessMsg] = useState<string | null>(null);

  // Unmatch confirmation state
  const [unmatchTarget, setUnmatchTarget] = useState<Match | null>(null);

  // Real-time countdown helper
  const calculateRemaining = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    if (diff <= 0) {
      return { text: 'Connection Expired', isExpired: true, isUrgent: true };
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return {
        text: `${days}d ${hours}h remaining`,
        isExpired: false,
        isUrgent: days <= 1
      };
    }
    return {
      text: `${hours}h ${minutes}m remaining`,
      isExpired: false,
      isUrgent: true
    };
  };

  // Re-render countdown every 60 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const unsubMatches = listenUserMatches(user.id, (matches) => {
      setActiveMatches(matches.filter((m) => m.status !== 'ended'));
    });
    const unsubRequests = listenIncomingInterests(user.id, setRequests);
    return () => {
      unsubMatches();
      unsubRequests();
    };
  }, [user?.id]);

  const handleAcceptRequest = (req: MatchRequest) => {
    void acceptInterest(req.id, req.senderId)
      .then((matchId) => {
        sounds.playMatchCelebration();
        setCelebrationMatch({
          displayName: req.senderProfile?.displayName || 'Member',
          photo: req.senderProfile?.photos[0] || '',
          matchId
        });
      })
      .catch((err) => {
        setExtensionSuccessMsg(err instanceof Error ? err.message : 'Could not accept this request.');
        setTimeout(() => setExtensionSuccessMsg(null), 4000);
      });
  };

  const handleDeclineRequest = (reqId: string) => {
    void declineInterest(reqId).catch((err) => {
      setExtensionSuccessMsg(err instanceof Error ? err.message : 'Could not decline this request.');
      setTimeout(() => setExtensionSuccessMsg(null), 4000);
    });
  };

  // Handle Unmatch / End match
  const handleConfirmUnmatch = () => {
    if (!unmatchTarget) return;
    void endMatch(unmatchTarget.id, unmatchTarget);
    setUnmatchTarget(null);
  };

  // Handle Paystack Payment Execution
  const handleExecutePayment = () => {
    if (!showExtendSheet) return;
    setIsProcessingPayment(true);

    // Simulate Paystack checkout verification
    setTimeout(() => {
      setIsProcessingPayment(false);

      // Extend match expiration by selected plan days
      const daysToAdd = selectedPlan.days;
      void extendMatch(showExtendSheet.id, showExtendSheet, daysToAdd);

      setShowExtendSheet(null);
      setExtensionSuccessMsg(
        `Connection extended by ${selectedPlan.days} days! Receipt delivered to your email.`
      );
      setTimeout(() => setExtensionSuccessMsg(null), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900 tracking-tight">
            Matches & Connections
          </h1>
          <p className="text-xs text-stone-500">
            Private 7-day intentional connection windows
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      <AnimatePresence>
        {extensionSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-emerald-800 text-emerald-50 rounded-2xl text-xs flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{extensionSuccessMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segmented Tab Switcher */}
      <div className="flex bg-stone-200/80 p-1 rounded-2xl text-xs font-semibold">
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-white text-rose-950 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span>Active Connections</span>
          <span className="px-1.5 py-0.2 rounded-full bg-rose-900 text-amber-200 text-[10px] font-bold">
            {activeMatches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-white text-rose-950 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span>Incoming Requests</span>
          {requests.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[10px] font-bold">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* VIEW: INCOMING REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 p-6 space-y-2">
              <Heart className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="font-serif font-bold text-stone-800 text-base">
                No Pending Interest Requests
              </h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                When an eligible member sends you a connection request, you can review and accept it here.
              </p>
            </div>
          ) : (
            requests.map((req) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-4 border border-rose-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={req.senderProfile?.photos[0]}
                    alt={req.senderProfile?.displayName}
                    className="w-14 h-14 rounded-2xl object-cover border border-stone-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-serif font-bold text-base text-stone-900 truncate">
                        {req.senderProfile?.displayName}, {req.senderProfile?.age}
                      </h3>
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                    <p className="text-xs text-stone-600 truncate">
                      {req.senderProfile?.profession} · {req.senderProfile?.location.split(',')[0]}
                    </p>
                    <p className="text-[11px] text-rose-800 font-medium mt-0.5">
                      Interested in exploring a connection
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2 border-t border-stone-100">
                  <button
                    onClick={() => handleDeclineRequest(req.id)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-600 hover:bg-stone-50 text-xs font-semibold transition cursor-pointer"
                  >
                    Decline
                  </button>

                  <button
                    onClick={() => handleAcceptRequest(req)}
                    className="flex-1 py-2.5 rounded-xl bg-rose-900 text-amber-100 font-bold text-xs shadow-xs hover:bg-rose-950 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>Accept Match</span>
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* VIEW: ACTIVE CONNECTIONS */}
      {activeTab === 'matches' && (
        <div className="space-y-3">
          {activeMatches.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 p-6 space-y-2">
              <Clock className="w-8 h-8 text-stone-300 mx-auto" />
              <h3 className="font-serif font-bold text-stone-800 text-base">
                No Active Matches Yet
              </h3>
              <p className="text-xs text-stone-500 max-w-xs mx-auto">
                Explore profiles on Discover or respond to incoming interest to start a connection.
              </p>
            </div>
          ) : (
            activeMatches.map((match) => {
              const remaining = calculateRemaining(match.expiresAt);

              return (
                <div
                  key={match.id}
                  className={`bg-white rounded-3xl p-4 border transition shadow-2xs space-y-3.5 ${
                    remaining.isUrgent ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200/90'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={match.otherProfile?.photos[0]}
                        alt={match.otherProfile?.displayName}
                        className="w-14 h-14 rounded-2xl object-cover border border-stone-200 shadow-2xs"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-serif font-bold text-lg text-stone-900">
                            {match.otherProfile?.displayName}, {match.otherProfile?.age}
                          </h3>
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        </div>
                        <p className="text-xs text-stone-600">
                          {match.otherProfile?.profession}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          {match.otherProfile?.location}
                        </p>
                      </div>
                    </div>

                    {/* Expiration badge */}
                    <div
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 ${
                        remaining.isUrgent
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {remaining.isUrgent ? (
                        <Flame className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-stone-500" />
                      )}
                      <span>{remaining.text}</span>
                    </div>
                  </div>

                  {/* Extension notice if already extended */}
                  {match.extendedCount > 0 && (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>Connection extended ({match.extendedCount}x)</span>
                    </div>
                  )}

                  {/* Match Action Bar */}
                  <div className="pt-2 flex items-center gap-2 border-t border-stone-100">
                    <button
                      onClick={() => onOpenChat(match.id)}
                      className="flex-1 py-2.5 rounded-2xl bg-rose-900 hover:bg-rose-950 text-amber-100 text-xs font-bold transition active:scale-98 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-amber-300" />
                      <span>Open Chat</span>
                    </button>

                    <button
                      onClick={() => setShowExtendSheet(match)}
                      className="py-2.5 px-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition active:scale-98 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Extend</span>
                      <ChevronRight className="w-3 h-3 text-amber-700" />
                    </button>

                    <button
                      onClick={() => setUnmatchTarget(match)}
                      className="p-2.5 rounded-2xl hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                      title="End match"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MUTUAL MATCH CELEBRATION MODAL */}
      <AnimatePresence>
        {celebrationMatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 25 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-gradient-to-b from-stone-950 via-rose-950 to-stone-950 text-white rounded-3xl p-6 text-center shadow-2xl border border-amber-400/30 relative overflow-hidden"
            >
              {/* Overlapping profile avatars */}
              <div className="flex items-center justify-center -space-x-4 my-3">
                <img
                  src={
                    currentProfile?.photos[0] ||
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'
                  }
                  alt="You"
                  className="w-20 h-20 rounded-full object-cover border-4 border-rose-900 shadow-lg ring-2 ring-amber-300/60"
                />
                <img
                  src={celebrationMatch.photo}
                  alt={celebrationMatch.displayName}
                  className="w-20 h-20 rounded-full object-cover border-4 border-stone-900 shadow-lg ring-2 ring-amber-300/60"
                />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold tracking-widest uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mutual Alignment</span>
              </div>

              <h3 className="font-serif text-3xl font-bold text-amber-100">
                It's a Match!
              </h3>

              <p className="text-xs text-stone-200 mt-2 max-w-xs mx-auto leading-relaxed">
                You and {celebrationMatch.displayName} are mutually interested. You now have an intentional 7-day window to converse and align on shared goals.
              </p>

              <div className="mt-6 space-y-2.5">
                <button
                  onClick={() => {
                    const mId = celebrationMatch.matchId;
                    setCelebrationMatch(null);
                    onOpenChat(mId);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 font-bold text-xs shadow-lg hover:from-amber-300 hover:to-amber-400 active:scale-98 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4 fill-stone-950" />
                  <span>Start Private Conversation</span>
                </button>

                <button
                  onClick={() => setCelebrationMatch(null)}
                  className="w-full py-2.5 text-stone-400 hover:text-white text-xs transition cursor-pointer"
                >
                  Keep Exploring
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PAYSTACK MATCH EXTENSION MODAL / SHEET */}
      <AnimatePresence>
        {showExtendSheet && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs p-4">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-sm bg-[#FAF8F5] text-stone-900 rounded-3xl p-6 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div>
                  <h3 className="font-serif font-bold text-xl text-stone-900">
                    Extend Connection
                  </h3>
                  <p className="text-xs text-stone-500">
                    Keep your window open with {showExtendSheet.otherProfile?.displayName}
                  </p>
                </div>
                <button
                  onClick={() => setShowExtendSheet(null)}
                  className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Plans Selection */}
              <div className="space-y-2.5 my-4">
                {EXTENSION_PLANS.map((plan) => {
                  const isSelected = selectedPlan.id === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-rose-50/80 border-rose-900 ring-1 ring-rose-900 shadow-2xs'
                          : 'bg-white border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-stone-900 text-xs">
                            {plan.label}
                          </span>
                          {plan.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 font-bold">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-500 block mt-0.5">
                          {plan.sublabel}
                        </span>
                      </div>
                      <span className="font-bold text-rose-950 text-sm">
                        {plan.priceFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Paystack Trust badge */}
              <div className="p-3 bg-stone-100 rounded-2xl flex items-center gap-2 text-stone-600 text-[11px] mb-4">
                <Lock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span>Processed securely via Paystack · Instant activation</span>
              </div>

              {/* Action Button */}
              <button
                onClick={handleExecutePayment}
                disabled={isProcessingPayment}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-900 to-rose-800 text-amber-100 font-bold text-xs shadow-md hover:from-rose-950 hover:to-rose-900 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {isProcessingPayment ? (
                  <span>Processing with Paystack...</span>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-amber-300" />
                    <span>Pay {selectedPlan.priceFormatted} with Paystack</span>
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* END MATCH / UNMATCH CONFIRMATION DIALOG */}
      <AnimatePresence>
        {unmatchTarget && (
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
                This will gracefully close your chat with {unmatchTarget.otherProfile?.displayName} and remove it from your active connections.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setUnmatchTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUnmatch}
                  className="flex-1 py-2.5 rounded-xl bg-rose-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
