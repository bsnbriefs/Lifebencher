import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  Users,
  Heart,
  Sparkles,
  Search,
  Check,
  X,
  Clock,
  ArrowRight,
  TrendingUp,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Send,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Profile } from '../../types';
import { listenAllProfiles, setProfileVerified } from '../../lib/admin';
import { adminGrantMatchmaking } from '../../lib/billing';
import { useAuth } from '../../context/AuthContext';
import { MonetizationPanel } from './MonetizationPanel';

interface AdminDashboardProps {
  onBackToApp: () => void;
}

interface VerificationCandidate {
  id: string;
  displayName: string;
  age: number;
  gender: string;
  location: string;
  profession: string;
  education: string;
  bio: string;
  submittedAt: string;
  idDocument: string;
  photoUrl: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToApp }) => {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'verifications' | 'clients' | 'curate' | 'matches' | 'billing'>('verifications');
  const [liveProfiles, setLiveProfiles] = useState<Profile[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    return listenAllProfiles(setLiveProfiles);
  }, []);

  const queue: VerificationCandidate[] = useMemo(
    () =>
      liveProfiles
        .filter((p) => !p.isVerified)
        .map((p) => ({
          id: p.id,
          displayName: p.displayName,
          age: p.age,
          gender: p.gender,
          location: p.location,
          profession: p.profession,
          education: p.education,
          bio: p.bio,
          submittedAt: p.updatedAt ? new Date(p.updatedAt).toLocaleString() : '',
          idDocument: 'Onboarding profile',
          photoUrl: p.photos[0] || '',
          status: 'pending' as const
        })),
    [liveProfiles]
  );

  const registeredClients = useMemo(
    () =>
      liveProfiles.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        age: p.age,
        profession: p.profession,
        location: p.location,
        isVerified: p.isVerified,
        status: p.isVisible ? 'Active' : 'Hidden'
      })),
    [liveProfiles]
  );

  // Manual Curation Matchmaker state
  const [clientA, setClientA] = useState('');
  const [clientB, setClientB] = useState('');
  const [curatorNote, setCuratorNote] = useState('');
  const [isIntroducing, setIsIntroducing] = useState(false);

  // Active matches overview state
  const [systemMatches, setSystemMatches] = useState<
    {
      id: string;
      partyA: string;
      partyB: string;
      daysLeft: number;
      extendedCount: number;
      totalExtensionRevenue: string;
    }[]
  >([]);

  const handleApprove = (id: string) => {
    const profile = liveProfiles.find((p) => p.id === id);
    if (!profile) return;
    void setProfileVerified(profile, true)
      .then(() => {
        setNotification(`${profile.displayName} is now verified.`);
        setTimeout(() => setNotification(null), 3000);
      })
      .catch((err) => {
        setNotification(err instanceof Error ? err.message : 'Could not verify this member.');
        setTimeout(() => setNotification(null), 4000);
      });
  };

  const handleReject = (id: string) => {
    const profile = liveProfiles.find((p) => p.id === id);
    if (!profile) return;
    void setProfileVerified(profile, false)
      .then(() => {
        setNotification(`${profile.displayName} remains unverified.`);
        setTimeout(() => setNotification(null), 3000);
      })
      .catch((err) => {
        setNotification(err instanceof Error ? err.message : 'Could not update verification.');
        setTimeout(() => setNotification(null), 4000);
      });
  };

  const handleDispatchIntroduction = () => {
    if (!clientA || !clientB || clientA === clientB) return;
    setIsIntroducing(true);
    setTimeout(() => {
      setIsIntroducing(false);
      const nameA = registeredClients.find((c) => c.id === clientA)?.displayName;
      const nameB = registeredClients.find((c) => c.id === clientB)?.displayName;
      if (!nameA || !nameB) return;

      setSystemMatches((prev) => [
        {
          id: 'sm_' + Date.now(),
          partyA: `${nameA}`,
          partyB: `${nameB}`,
          daysLeft: 7,
          extendedCount: 0,
          totalExtensionRevenue: '₦0'
        },
        ...prev
      ]);

      setNotification(`Curated Introduction Dispatched! Both ${nameA} and ${nameB} have received private match invitations with your editorial note.`);
      setTimeout(() => setNotification(null), 4000);
    }, 900);
  };

  const handleAdminExtend = (matchId: string) => {
    setSystemMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, daysLeft: m.daysLeft + 7, extendedCount: m.extendedCount + 1 } : m
      )
    );
    setNotification('Admin courtesy extension applied (+7 days added).');
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 pb-16 safe-area-top">
      {/* Top Admin Header Bar */}
      <header className="bg-stone-900 text-white px-4 py-3.5 sticky top-0 z-40 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBackToApp}
              className="p-1 rounded-full hover:bg-stone-800 text-stone-300 transition cursor-pointer"
              title="Return to Client App"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                  Admin Portal
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h1 className="font-serif font-bold text-base text-white leading-tight">
                Lifebencher Match Concierge
              </h1>
            </div>
          </div>

          <button
            onClick={onBackToApp}
            className="px-2.5 py-1 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition cursor-pointer"
          >
            Exit Admin
          </button>
        </div>
      </header>

      {!isAdmin && (
        <div className="max-w-md mx-auto px-4 pt-4">
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            Sign in as admin@barristerstreet.org (verified email) to approve members. This session is not an admin account.
          </p>
        </div>
      )}
      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Metric Overview Pills */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Pending IDs</span>
            <span className="font-serif text-xl font-bold text-rose-900">
              {queue.filter((c) => c.status === 'pending').length}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Active Matches</span>
            <span className="font-serif text-xl font-bold text-amber-700">
              {systemMatches.length}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-stone-400 block">Verified</span>
            <span className="font-serif text-xl font-bold text-emerald-800">
              {liveProfiles.filter((p) => p.isVerified).length}
            </span>
          </div>
        </div>

        {/* Global Toast Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-3 bg-stone-900 text-amber-200 rounded-2xl text-xs flex items-center gap-2 shadow-md border border-amber-400/40"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{notification}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Admin Tab Switcher */}
        <div className="flex bg-stone-200/80 p-1 rounded-2xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('verifications')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'verifications'
                ? 'bg-white text-rose-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <span>Verification</span>
            {queue.filter((c) => c.status === 'pending').length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-900 text-amber-200 text-[10px] font-bold flex items-center justify-center">
                {queue.filter((c) => c.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('curate')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'curate'
                ? 'bg-white text-rose-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Matchmaker
          </button>

          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'matches'
                ? 'bg-white text-rose-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Matches ({systemMatches.length})
          </button>

          <button
            onClick={() => setActiveTab('clients')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'clients'
                ? 'bg-white text-rose-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Clients
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer ${
              activeTab === 'billing'
                ? 'bg-white text-rose-950 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Billing
          </button>
        </div>

        {/* TAB 1: VERIFICATION QUEUE */}
        {activeTab === 'verifications' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500 px-1">
              <span>Clients Awaiting Background & ID Review</span>
              <span>{queue.filter((c) => c.status === 'pending').length} remaining</span>
            </div>

            {queue.length === 0 && (
              <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 text-xs text-stone-500">
                No verification submissions yet.
              </div>
            )}
            {queue.map((cand) => (
              <div
                key={cand.id}
                className="bg-white rounded-3xl p-4 border border-stone-200 shadow-2xs space-y-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={cand.photoUrl}
                    alt={cand.displayName}
                    className="w-14 h-14 rounded-2xl object-cover border border-stone-200"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif font-bold text-base text-stone-900 truncate">
                        {cand.displayName}, {cand.age}
                      </h3>
                      <span className="text-[10px] text-stone-400">{cand.submittedAt}</span>
                    </div>
                    <p className="text-xs text-stone-600 truncate">{cand.profession}</p>
                    <p className="text-[11px] text-stone-400 truncate">{cand.location}</p>
                  </div>
                </div>

                {/* ID & Bio Preview */}
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-150 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-stone-800 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-800" />
                    <span>Credentials: {cand.idDocument}</span>
                  </div>
                  <p className="text-stone-600 text-[11px] italic">"{cand.bio}"</p>
                </div>

                {/* Status or Actions */}
                {cand.status === 'pending' ? (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleReject(cand.id)}
                      className="flex-1 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-semibold transition cursor-pointer"
                    >
                      Decline
                    </button>

                    <button
                      onClick={() => handleApprove(cand.id)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold transition shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve & Verify</span>
                    </button>
                  </div>
                ) : (
                  <div
                    className={`py-2 text-center rounded-xl text-xs font-semibold ${
                      cand.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {cand.status === 'approved' ? '✓ Verified Member' : 'Declined'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 2: MANUAL CURATION MATCHMAKER */}
        {activeTab === 'curate' && (
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <div>
              <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Concierge Matchmaking Tool</span>
              </div>
              <h2 className="font-serif text-lg font-bold text-stone-900 mt-0.5">
                Curate Intentional Introduction
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Directly connect two eligible candidates with a personalized admin recommendation.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">First Candidate</label>
                <select
                  value={clientA}
                  onChange={(e) => setClientA(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 border border-stone-300 outline-hidden font-medium"
                >
                  <option value="">Select member</option>
                  {registeredClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.profession.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Second Candidate</label>
                <select
                  value={clientB}
                  onChange={(e) => setClientB(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 border border-stone-300 outline-hidden font-medium"
                >
                  <option value="">Select member</option>
                  {registeredClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName} ({c.profession.split(' ')[0]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-stone-700 text-xs block mb-1">
                Admin Curated Endorsement Note
              </label>
              <textarea
                rows={3}
                value={curatorNote}
                onChange={(e) => setCuratorNote(e.target.value)}
                placeholder="Explain why these two members are thoughtfully aligned..."
                className="w-full text-xs p-3 rounded-2xl bg-stone-50 border border-stone-300 outline-hidden leading-relaxed"
              />
            </div>

            <button
              onClick={handleDispatchIntroduction}
              disabled={isIntroducing || !clientA || !clientB || clientA === clientB}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-rose-900 via-rose-800 to-amber-700 text-white font-bold text-xs shadow-md hover:from-rose-950 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isIntroducing ? (
                <span>Dispatching Connection...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Introduce & Open 7-Day Window</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* TAB 3: SYSTEM MATCHES & EXPIRATION MONITOR */}
        {activeTab === 'matches' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-500 px-1">
              <span>All Active Matches in System</span>
              <span>7-Day Window Tracking</span>
            </div>

            {systemMatches.length === 0 && (
              <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 text-xs text-stone-500">
                No live matches in the system yet.
              </div>
            )}
            {systemMatches.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-3xl p-4 border border-stone-200 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-serif font-bold text-sm text-stone-900">
                      {m.partyA}
                    </h3>
                    <p className="text-xs text-stone-500 font-medium">connected with</p>
                    <h3 className="font-serif font-bold text-sm text-stone-900">
                      {m.partyB}
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      m.daysLeft <= 1
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {m.daysLeft}d remaining
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                  <div className="text-stone-500 text-[11px]">
                    <span>Extensions: {m.extendedCount}x · Revenue: </span>
                    <span className="font-semibold text-emerald-700">{m.totalExtensionRevenue}</span>
                  </div>

                  <button
                    onClick={() => handleAdminExtend(m.id)}
                    className="text-[11px] font-semibold text-rose-900 hover:underline cursor-pointer"
                  >
                    + Grant +7 Days
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: CLIENT DIRECTORY */}
        {activeTab === 'clients' && (
          <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-2xs space-y-3">
            <h3 className="font-serif font-bold text-base text-stone-900">
              Registered Clients Directory
            </h3>

            <div className="space-y-2">
              {registeredClients.length === 0 && (
                <p className="text-xs text-stone-500 py-8 text-center">
                  No registered clients loaded. Directory will list live members when connected to Firestore.
                </p>
              )}
              {registeredClients.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      <span>{c.displayName}, {c.age}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-stone-500 text-[11px]">{c.profession} · {c.location}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      {c.status}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-rose-900"
                      onClick={() =>
                        void adminGrantMatchmaking(c.id, 'local')
                          .then(() => setNotification(`${c.displayName}: Nigeria package granted (no new payment)`))
                          .catch((e) => setNotification(e instanceof Error ? e.message : 'Grant failed'))
                      }
                    >
                      Grant Nigeria
                    </button>
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-rose-900"
                      onClick={() =>
                        void adminGrantMatchmaking(c.id, 'international')
                          .then(() => setNotification(`${c.displayName}: Abroad package granted (no new payment)`))
                          .catch((e) => setNotification(e instanceof Error ? e.message : 'Grant failed'))
                      }
                    >
                      Grant Abroad
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'billing' && <MonetizationPanel onNotice={setNotification} />}
      </div>
    </div>
  );
};
