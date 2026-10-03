import React, { useEffect, useRef, useState } from 'react';
import { acceptCall, addIce, CallState, declineCall, endCall, iceConfig, listenCall, markMissed, startCall } from '../../lib/calls';

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
  const [camOff, setCamOff] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const remoteRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    pc.ontrack = (ev) => {
      if (remoteRef.current) remoteRef.current.srcObject = ev.streams[0];
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

  const incoming = call && call.status === 'ringing' && call.calleeId === myId;
  const active = call && (call.status === 'ringing' || call.status === 'accepted') && (call.callerId === myId || call.calleeId === myId);

  return (
    <>
      <div className="flex gap-1">
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Voice call" onClick={() => void begin('voice', peerId)}>
          <span className="text-[11px]">Call</span>
        </button>
        <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Video call" onClick={() => void begin('video', peerId)}>
          <span className="text-[11px]">Video</span>
        </button>
      </div>
      {error && <p className="text-[11px] text-rose-700">{error}</p>}
      {incoming && (
        <div className="fixed inset-0 z-[90] bg-black/80 text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="font-serif text-lg">Incoming {call?.type} call</p>
          <p className="text-sm">{peerName}</p>
          <div className="flex gap-2">
            <button type="button" className="px-4 py-2 rounded-full bg-stone-600" onClick={() => void declineCall(matchId)}>Decline</button>
            <button type="button" className="px-4 py-2 rounded-full bg-emerald-700" onClick={() => void accept()}>Accept</button>
          </div>
        </div>
      )}
      {active && call?.status === 'ringing' && call.callerId === myId && (
        <div className="fixed inset-0 z-[90] bg-black/80 text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="font-serif text-lg">Calling {peerName}</p>
          <p className="text-sm">{call.type === 'video' ? 'Video call' : 'Audio call'}</p>
          <button type="button" className="px-4 py-2 rounded-full bg-rose-800" onClick={() => void markMissed(matchId).then(() => cleanup())}>Cancel</button>
        </div>
      )}
      {active && call?.status === 'accepted' && (
        <div className="fixed inset-0 z-[90] bg-[#1c1917] text-[#f3ece6] flex flex-col">
          <div className="flex-1 relative">
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
