import React, { useEffect, useRef, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import { acceptCall, ackRinging, addIce, CallState, cancelCall, declineCall, endCall, iceConfig, listenCall, markMissed, startCall } from '../../lib/calls';
import { sendMatchMessage } from '../../lib/chat';

const ICE: RTCConfiguration = iceConfig();

export const CallOverlay: React.FC<{
  matchId: string;
  myId: string;
  peerId: string;
  peerName: string;
}> = ({ matchId, myId, peerId, peerName }) => {
  const [call, setCall] = useState<CallState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [connected, setConnected] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const loggedRef = useRef<string | null>(null);
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

  useEffect(() => listenCall(matchId, setCall), [matchId]);
  useEffect(() => () => stopRing(), []);

  const attachPc = async (video: boolean) => {
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    pc.onconnectionstatechange = () => setConnected(pc.connectionState === 'connected');
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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false });
    streamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (localRef.current) localRef.current.srcObject = stream;
    return pc;
  };

  const begin = async (type: 'voice' | 'video') => {
    setNotice(null);
    stopRing();
    try {
      roleRef.current = 'caller';
      startRing(false);
      const pc = await attachPc(type === 'video');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await startCall(matchId, peerId, type, offer);
    } catch {
      stopRing();
      stopMedia();
      setNotice(type === 'video' ? 'Camera permission is required for video calls.' : 'Microphone permission is required for voice calls.');
    }
  };

  const accept = async () => {
    if (!call?.offer) return;
    stopRing();
    try {
      roleRef.current = 'callee';
      const pc = await attachPc(call.type === 'video');
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
    const label = call.type === 'video' ? 'Video call' : 'Voice call';
    const outcome = call.status === 'missed' ? 'No answer' : call.status === 'declined' ? 'Declined' : call.status === 'cancelled' ? 'Cancelled' : 'Ended';
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
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Voice call" title="Voice call" onClick={() => void begin('voice')}>
          <Phone className="w-4 h-4" />
        </button>
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Video call" title="Video call" onClick={() => void begin('video')}>
          <Video className="w-4 h-4" />
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
        <div className="fixed inset-0 z-[90] bg-[#2a1218] text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-xs uppercase tracking-wide">{call?.type === 'video' ? 'Incoming video call' : 'Incoming voice call'}</p>
          <p className="font-serif text-xl">{peerName} is calling</p>
          <div className="flex gap-2">
            <button type="button" className="px-4 py-2 rounded-full bg-stone-600" onClick={() => { stopRing(); void declineCall(matchId); }}>Decline</button>
            <button type="button" className="px-4 py-2 rounded-full bg-emerald-700" onClick={() => void accept()}>Answer</button>
          </div>
        </div>
      )}
      {outgoing && (
        <div className="fixed inset-0 z-[90] bg-[#2a1218] text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="font-serif text-xl">{call?.status === 'ringing' ? `Ringing ${peerName}…` : `Calling ${peerName}…`}</p>
          <button type="button" className="px-4 py-2 rounded-full bg-rose-800" onClick={() => { stopRing(); void cancelCall(matchId); }}>Cancel</button>
        </div>
      )}
      {call?.status === 'accepted' && (call.callerId === myId || call.calleeId === myId) && (
        <div className="fixed inset-0 z-[90] bg-[#1c1917] text-[#f3ece6] flex flex-col">
          <div className="flex-1 relative">
            <p className="absolute top-4 left-4 text-xs">{connected ? 'Connected' : 'Connecting…'}</p>
            <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
            <video ref={localRef} autoPlay muted playsInline className="absolute bottom-4 right-4 w-24 h-32 object-cover rounded-xl" />
          </div>
          <div className="p-3 flex justify-center gap-2">
            <button type="button" className="px-3 py-2 rounded-full bg-white/10 text-xs" onClick={() => {
              setMuted((m) => !m);
              streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; });
            }}>{muted ? 'Unmute' : 'Mute'}</button>
            {call.type === 'video' && (
              <button type="button" className="px-3 py-2 rounded-full bg-white/10 text-xs" onClick={() => {
                setCamOff((c) => !c);
                streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = camOff; });
              }}>{camOff ? 'Camera on' : 'Camera off'}</button>
            )}
            <button type="button" className="px-3 py-2 rounded-full bg-rose-800 text-xs" onClick={() => { stopRing(); stopMedia(); void endCall(matchId); }}>End</button>
          </div>
        </div>
      )}
    </>
  );
};
