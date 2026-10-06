import React, { useEffect, useRef, useState } from 'react';
import { Phone } from 'lucide-react';
import { acceptCall, ackRinging, addIce, CallState, cancelCall, declineCall, endCall, iceConfig, listenCall, markMissed, startCall } from '../../lib/calls';
import { sendMatchMessage } from '../../lib/chat';
import { fetchProfileSafe } from '../../lib/matches';

const ICE = iceConfig;

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const CallOverlay: React.FC<{
  matchId: string;
  myId: string;
  peerId: string;
  peerName: string;
}> = ({ matchId, myId, peerId, peerName }) => {
  const [call, setCall] = useState<CallState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const connectedAtRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const loggedRef = useRef<string | null>(null);
  const vibrateRef = useRef<number | null>(null);
  const roleRef = useRef<'caller' | 'callee'>('caller');
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);

  const stopRing = () => {
    try { oscRef.current?.stop(); } catch { /* already stopped */ }
    oscRef.current = null;
    try { void audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    if (vibrateRef.current) window.clearInterval(vibrateRef.current);
    vibrateRef.current = null;
    try { navigator.vibrate?.(0); } catch { /* ignore */ }
  };

  const startRing = (incoming: boolean) => {
    if (oscRef.current) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = incoming ? 480 : 440;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    audioCtxRef.current = ctx;
    oscRef.current = osc;
    if (incoming) {
      vibrateRef.current = window.setInterval(() => {
        try { navigator.vibrate?.(180); } catch { /* ignore */ }
      }, 1400);
    }
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteRef.current) remoteRef.current.srcObject = null;
    if (localRef.current) localRef.current.srcObject = null;
    setConnected(false);
  };

  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchProfileSafe(peerId).then((profile) => {
      if (!cancelled) setPhoto(profile?.photos?.[0] || null);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [peerId]);

  useEffect(() => listenCall(matchId, setCall), [matchId]);

  const portrait = (
    <div className="flex flex-col items-center px-6 pt-[max(24px,env(safe-area-inset-top))]">
      <div className="w-28 h-28 rounded-full overflow-hidden bg-stone-700 border border-white/10">
        {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{peerName.slice(0, 1)}</div>}
      </div>
      <p className="mt-4 font-serif text-2xl text-center">{peerName}</p>
    </div>
  );
  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      if (connectedAtRef.current) setElapsed(Date.now() - connectedAtRef.current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connected]);

  const attachPc = async (video: boolean) => {
    const pc = new RTCPeerConnection(await ICE());
    pcRef.current = pc;
    pc.onconnectionstatechange = () => {
      const ok = pc.connectionState === 'connected';
      setConnected(ok);
      if (ok && !connectedAtRef.current) connectedAtRef.current = Date.now();
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (remoteRef.current) remoteRef.current.srcObject = stream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) void addIce(matchId, roleRef.current, ev.candidate.toJSON());
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (localRef.current) localRef.current.srcObject = stream;
    return pc;
  };

  const begin = async () => {
    setNotice(null);
    stopRing();
    try {
      roleRef.current = 'caller';
      startRing(false);
      const pc = await attachPc(false);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await startCall(matchId, peerId, 'voice', offer);
    } catch {
      stopRing();
      stopMedia();
      setNotice('Microphone permission is required for voice calls.');
    }
  };

  const accept = async () => {
    if (!call?.offer) return;
    stopRing();
    try {
      roleRef.current = 'callee';
      const pc = await attachPc(false);
      await pc.setRemoteDescription(call.offer);
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => undefined);
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await acceptCall(matchId, answer);
    } catch {
      stopRing();
      stopMedia();
      setNotice('Unable to connect. Please try again.');
    }
  };

  useEffect(() => {
    if (!call?.answer || !pcRef.current || call.callerId !== myId) return;
    if (!pcRef.current.currentRemoteDescription) {
      void pcRef.current.setRemoteDescription(call.answer).then(async () => {
        for (const c of pendingIce.current) await pcRef.current?.addIceCandidate(c).catch(() => undefined);
        pendingIce.current = [];
      });
    }
  }, [call?.answer, call?.callerId, myId]);

  useEffect(() => {
    const pc = pcRef.current;
    if (!call) return;
    const list = call.callerId === myId ? call.calleeIce : call.callerIce;
    (list || []).forEach((c) => {
      if (!pc || !pc.currentRemoteDescription) pendingIce.current.push(c);
      else void pc.addIceCandidate(c).catch(() => undefined);
    });
  }, [call, myId]);

  useEffect(() => {
    if (!call || call.calleeId !== myId || call.status !== 'initiating') return;
    void ackRinging(matchId);
    startRing(true);
  }, [call?.status, call?.calleeId, matchId, myId]);

  useEffect(() => {
    if (!call) return;
    if (['accepted', 'declined', 'cancelled', 'missed', 'ended', 'failed'].includes(call.status)) stopRing();
    if (call.callerId !== myId) return;
    if (!['declined', 'cancelled', 'missed', 'ended'].includes(call.status)) return;
    if (loggedRef.current === call.status) return;
    loggedRef.current = call.status;
    const label = 'Voice call';
    const outcome = call.status === 'missed' ? 'No answer' : call.status === 'declined' ? 'Declined' : call.status === 'cancelled' ? 'Cancelled' : (connectedAtRef.current ? formatDuration(Date.now() - connectedAtRef.current) : 'Ended');
    void sendMatchMessage(matchId, `${label}\n${outcome}`).catch(() => undefined);
    const timer = window.setTimeout(() => setCall(null), 1200);
    return () => window.clearTimeout(timer);
  }, [call, matchId, myId]);

  useEffect(() => {
    if (!call || call.callerId !== myId) return;
    if (call.status !== 'initiating' && call.status !== 'ringing') return;
    const timer = window.setTimeout(() => void markMissed(matchId), 30000);
    return () => window.clearTimeout(timer);
  }, [call?.status, call?.callerId, matchId, myId]);

  const incoming = call && (call.status === 'initiating' || call.status === 'ringing') && call.calleeId === myId;
  const outgoing = call && call.callerId === myId && (call.status === 'initiating' || call.status === 'ringing');

  return (
    <>
      <div className="flex gap-1">
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Voice call" title="Voice call" onClick={() => void begin()}>
          <Phone className="w-4 h-4" />
        </button>
      </div>
      <audio ref={remoteAudioRef} autoPlay />
      {notice && <p className="sr-only">{notice}</p>}
      {notice && (
        <div className="fixed inset-0 z-[90] bg-[#2a1218]/90 text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-center">{notice}</p>
          <button type="button" className="px-4 py-2 rounded-full bg-rose-800" onClick={() => setNotice(null)}>Close</button>
        </div>
      )}
      {incoming && (
        <div className="fixed inset-0 z-[90] bg-[#1c1416] text-[#f3ece6] flex flex-col">
          {portrait}
          <p className="mt-2 text-center text-sm text-white/70">Incoming voice call</p>
          <div className="mt-auto pb-[max(24px,env(safe-area-inset-bottom))] flex justify-center gap-8">
            <button type="button" className="w-16 h-16 rounded-full bg-stone-600" onClick={() => { stopRing(); void declineCall(matchId); }} aria-label="Decline">Decline</button>
            <button type="button" className="w-16 h-16 rounded-full bg-emerald-700" onClick={() => void accept()} aria-label="Answer">Answer</button>
          </div>
        </div>
      )}
      {outgoing && (
        <div className="fixed inset-0 z-[90] bg-[#1c1416] text-[#f3ece6] flex flex-col">
          {portrait}
          <p className="mt-2 text-center text-sm text-white/70">{call?.status === 'ringing' ? 'Ringing...' : 'Calling...'}</p>
          <div className="mt-auto pb-[max(24px,env(safe-area-inset-bottom))] flex justify-center">
            <button type="button" className="w-16 h-16 rounded-full bg-rose-800" onClick={() => { stopRing(); void cancelCall(matchId); }} aria-label="Cancel">Cancel</button>
          </div>
        </div>
      )}
      {call?.status === 'accepted' && (call.callerId === myId || call.calleeId === myId) && (
        <div className="fixed inset-0 z-[90] bg-[#1c1416] text-[#f3ece6] flex flex-col">
          {portrait}
          <p className="mt-2 text-center text-sm text-white/70">{connected ? 'Voice call' : 'Connecting...'}</p>
          <p className="mt-1 text-center text-lg tabular-nums">{connected ? formatDuration(elapsed) : ''}</p>
          <div className="mt-auto pb-[max(24px,env(safe-area-inset-bottom))] flex justify-center gap-8">
            <button type="button" className="w-16 h-16 rounded-full bg-white/10 text-xs" onClick={() => {
              setMuted((m) => !m);
              streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
            }} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? 'Unmute' : 'Mute'}</button>
            <button type="button" className="w-16 h-16 rounded-full bg-rose-800 text-xs" onClick={() => { stopRing(); stopMedia(); void endCall(matchId); }} aria-label="End">End</button>
          </div>
        </div>
      )}
    </>
  );
};
