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
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringRef = useRef<OscillatorNode | null>(null);
  const loggedRef = useRef<string | null>(null);

  const stopRing = () => {
    try { ringRef.current?.stop(); } catch { /* already stopped */ }
    ringRef.current = null;
  };

  const startRing = () => {
    if (ringRef.current) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    ringRef.current = osc;
  };

  useEffect(() => listenCall(matchId, setCall), [matchId]);

  const cleanup = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    await endCall(matchId);
  };

  const attachPc = async (video: boolean) => {
    const pc = new RTCPeerConnection(ICE);
    pcRef.current = pc;
    pc.onconnectionstatechange = () => {
      setConnected(pc.connectionState === 'connected');
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
      if (ev.candidate) {
        const role = call?.callerId === myId ? 'caller' : 'callee';
        void addIce(matchId, role, ev.candidate.toJSON());
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    streamRef.current = stream;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (localRef.current) localRef.current.srcObject = stream;
    return pc;
  };

  const begin = async (type: 'voice' | 'video', peerId: string) => {
    setError(null);
    try {
      startRing();
      const pc = await attachPc(type === 'video');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await startCall(matchId, peerId, type, offer);
    } catch {
      setError(type === 'video' ? 'Camera access is required for video calls.' : 'Microphone access is required for voice calls.');
    }
  };

  const accept = async () => {
    if (!call?.offer) return;
    try {
      const pc = await attachPc(call.type === 'video');
      await pc.setRemoteDescription(call.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await acceptCall(matchId, answer);
    } catch {
      setError('Unable to connect. Please try again.');
    }
  };

  useEffect(() => {
    if (!call?.answer || !pcRef.current || call.callerId !== myId) return;
    if (!pcRef.current.currentRemoteDescription) {
      void pcRef.current.setRemoteDescription(call.answer);
    }
  }, [call?.answer, call?.callerId, myId]);

  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !call) return;
    const list = call.callerId === myId ? call.calleeIce : call.callerIce;
    (list || []).forEach((c) => {
      void pc.addIceCandidate(c).catch(() => undefined);
    });
  }, [call, myId]);

  useEffect(() => {
    if (!call) return;
    if (call.status === 'ringing' && call.calleeId === myId) startRing();
    if (['accepted', 'declined', 'cancelled', 'missed', 'ended', 'failed'].includes(call.status)) stopRing();
    if (call.callerId === myId && ['declined', 'cancelled', 'missed', 'ended'].includes(call.status) && loggedRef.current !== call.status) {
      loggedRef.current = call.status;
      const label = call.type === 'video' ? 'Video call' : 'Voice call';
      const outcome = call.status === 'missed' ? 'No answer' : call.status === 'declined' ? 'Declined' : call.status === 'cancelled' ? 'Cancelled' : 'Ended';
      void sendMatchMessage(matchId, `${label}\n${outcome}`).catch(() => undefined);
    }
  }, [call?.status, call?.callerId, call?.type, matchId, myId]);

  useEffect(() => {
    if (!call || call.calleeId !== myId) return;
    if (call.status !== 'initiating') return;
    void ackRinging(matchId);
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* optional */ }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Incoming Lifebencher call', { body: `${peerName} is calling` });
    }
  }, [call?.status, call?.calleeId, matchId, myId, peerName]);

  useEffect(() => {
    if (!call || call.callerId !== myId) return;
    if (call.status !== 'initiating' && call.status !== 'ringing') return;
    const timer = window.setTimeout(() => void markMissed(matchId), 45000);
    return () => window.clearTimeout(timer);
  }, [call?.status, call?.callerId, matchId, myId]);

  const incoming = call && (call.status === 'initiating' || call.status === 'ringing') && call.calleeId === myId;
  const outgoing = call && call.callerId === myId && (call.status === 'initiating' || call.status === 'ringing');
  const callerLabel = call?.status === 'ringing' ? `Ringing ${peerName}…` : `Calling ${peerName}`;

  return (
    <>
      <div className="flex gap-1">
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Voice call" title="Voice call" onClick={() => void begin('voice', peerId)}>
          <Phone className="w-4 h-4" />
        </button>
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Video call" title="Video call" onClick={() => void begin('video', peerId)}>
          <Video className="w-4 h-4" />
        </button>
      </div>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {error && <p className="text-[11px] text-rose-700">{error}</p>}
      {incoming && (
        <div className="fixed inset-0 z-[90] bg-black/80 text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="font-serif text-xl">{peerName} is calling</p>
          <p className="text-sm">{call?.type === 'video' ? 'Video call' : 'Audio call'}</p>
          <div className="flex gap-2">
            <button type="button" className="px-4 py-2 rounded-full bg-stone-600" onClick={() => void declineCall(matchId)}>Decline</button>
            <button type="button" className="px-4 py-2 rounded-full bg-emerald-700" onClick={() => void accept()}>Accept</button>
          </div>
        </div>
      )}
      {outgoing && (
        <div className="fixed inset-0 z-[90] bg-[#2a1218] text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="font-serif text-xl">{callerLabel}</p>
          <p className="text-sm">{call.type === 'video' ? 'Video call' : 'Audio call'}</p>
          <button type="button" className="px-4 py-2 rounded-full bg-rose-800" onClick={() => void cancelCall(matchId)}>Cancel</button>
        </div>
      )}
      {call?.status === 'declined' && call.callerId === myId && (
        <div className="fixed inset-0 z-[90] bg-[#2a1218] text-[#f3ece6] flex items-center justify-center">Call declined</div>
      )}
      {call?.status === 'missed' && call.callerId === myId && (
        <div className="fixed inset-0 z-[90] bg-[#2a1218] text-[#f3ece6] flex items-center justify-center">No answer</div>
      )}
      {call?.status === 'accepted' && (call.callerId === myId || call.calleeId === myId) && (
        <div className="fixed inset-0 z-[90] bg-[#1c1917] text-[#f3ece6] flex flex-col">
          <div className="flex-1 relative">
            <p className="absolute top-4 left-4 text-xs">{connected ? 'Connected' : 'Connecting…'}</p>
            <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localRef} autoPlay muted playsInline className="absolute bottom-4 right-4 w-24 h-32 object-cover rounded-xl" />
          </div>
          <div className="p-3 flex justify-center gap-2">
            <button type="button" className="px-3 py-2 rounded-full bg-white/10 text-xs" onClick={() => {
              setMuted((m) => !m);
              streamRef.current?.getAudioTracks().forEach((t) => {
                t.enabled = muted;
              });
            }}>{muted ? 'Unmute' : 'Mute'}</button>
            {call.type === 'video' && (
              <button type="button" className="px-3 py-2 rounded-full bg-white/10 text-xs" onClick={() => {
                setCamOff((c) => !c);
                streamRef.current?.getVideoTracks().forEach((t) => {
                  t.enabled = camOff;
                });
              }}>{camOff ? 'Camera on' : 'Camera off'}</button>
            )}
            <button type="button" className="px-3 py-2 rounded-full bg-rose-800 text-xs" onClick={() => void cleanup()}>End</button>
          </div>
        </div>
      )}
    </>
  );
};
