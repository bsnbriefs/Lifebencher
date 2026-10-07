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
  headless?: boolean;
}> = ({ matchId, myId, peerId, peerName, headless }) => {
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
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const [hasMedia, setHasMedia] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [flipping, setFlipping] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

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
    if (oscRef.current || audioCtxRef.current) return;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const burst = () => {
      if (!audioCtxRef.current) return;
      const osc = audioCtxRef.current.createOscillator();
      const gain = audioCtxRef.current.createGain();
      osc.type = 'sine';
      osc.frequency.value = incoming ? 480 : 440;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(audioCtxRef.current.destination);
      osc.start();
      osc.stop(audioCtxRef.current.currentTime + 0.45);
    };
    burst();
    oscRef.current = { stop() {} } as OscillatorNode;
    vibrateRef.current = window.setInterval(() => {
      burst();
      try { navigator.vibrate?.([500, 300, 500, 1000]); } catch { /* ignore */ }
    }, 1800);
  };

  const stopMedia = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteRef.current) remoteRef.current.srcObject = null;
    if (localRef.current) localRef.current.srcObject = null;
    setConnected(false);
    setHasMedia(false);
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
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    const pc = new RTCPeerConnection(await ICE());
    pcRef.current = pc;
    pc.onconnectionstatechange = () => {
      const ok = pc.connectionState === 'connected';
      setConnected(ok);
      if (ok && !connectedAtRef.current) connectedAtRef.current = Date.now();
    };
    pc.ontrack = (ev) => {
      const localIds = new Set(streamRef.current?.getTracks().map((t) => t.id));
      if (localIds.has(ev.track.id)) return;
      const incoming = ev.streams[0];
      if (incoming) {
        incoming.getTracks().forEach((track) => {
          if (!remoteStreamRef.current.getTracks().some((t) => t.id === track.id)) remoteStreamRef.current.addTrack(track);
        });
      } else if (!remoteStreamRef.current.getTracks().some((t) => t.id === ev.track.id)) {
        remoteStreamRef.current.addTrack(ev.track);
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.muted = false;
        void remoteAudioRef.current.play().catch(() => undefined);
      }
      if (ev.track.kind === 'video') {
        ev.track.enabled = true;
        setHasRemoteVideo(true);
        if (remoteRef.current) {
          remoteRef.current.srcObject = remoteStreamRef.current;
          void remoteRef.current.play().catch(() => undefined);
        }
      }
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) void addIce(matchId, roleRef.current, ev.candidate.toJSON());
    };
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: video ? { facingMode: 'user', width: { ideal: 720, max: 1280 }, height: { ideal: 480, max: 720 }, frameRate: { ideal: 24, max: 30 } } : false
    });
    streamRef.current = stream;
    setHasMedia(true);
    setCameraOn(stream.getVideoTracks().some((t) => t.enabled));
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    return pc;
  };

  const begin = async (video = false) => {
    setNotice(null);
    stopRing();
    try {
      roleRef.current = 'caller';
      startRing(false);
      const pc = await attachPc(video);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await startCall(matchId, peerId, video ? 'video' : 'voice', offer);
    } catch {
      stopRing();
      stopMedia();
      setNotice(video ? 'Camera and microphone access are required for a video call.' : 'Allow microphone access to make voice calls.');
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
      setNotice('Connection failed');
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
    if (call.callerId !== myId || !headless) return;
    if (!['declined', 'cancelled', 'missed', 'ended'].includes(call.status)) return;
    const logKey = `call-log-${matchId}-${call.status}`;
    if (loggedRef.current === logKey || sessionStorage.getItem(logKey) === '1') return;
    loggedRef.current = logKey;
    sessionStorage.setItem(logKey, '1');
    const label = call.type === 'video' ? 'Video call' : 'Voice call';
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

  useEffect(() => {
    if (!hasMedia) return;
    if (localRef.current && streamRef.current) {
      localRef.current.srcObject = streamRef.current;
      void localRef.current.play().catch(() => undefined);
    }
    if (remoteRef.current && remoteStreamRef.current.getVideoTracks().length) {
      remoteRef.current.srcObject = remoteStreamRef.current;
      void remoteRef.current.play().catch(() => undefined);
    }
  }, [hasMedia, call?.status]);

  const incoming = call && (call.status === 'initiating' || call.status === 'ringing') && call.calleeId === myId;
  const outgoing = call && call.callerId === myId && (call.status === 'initiating' || call.status === 'ringing');

  return (
    <>
      <div className="flex gap-1">
        {!headless && <button type="button" className="p-1.5 rounded-full hover:bg-black/5" aria-label="Voice call" title="Voice call" onClick={() => void begin(false)}>
          <Phone className="w-4 h-4" />
        </button>}
        {!headless && <button type="button" className="p-1.5 rounded-full hover:bg-black/5 text-[10px] font-semibold" aria-label="Video call" title="Video call" onClick={() => void begin(true)}>Video</button>}
      </div>
      <audio ref={remoteAudioRef} autoPlay playsInline />
      {notice && (
        <div className="fixed inset-0 z-[90] bg-[#2a1218]/90 text-[#f3ece6] flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm text-center">{notice}</p>
          <button type="button" className="px-4 py-2 rounded-full bg-rose-800" onClick={() => setNotice(null)}>Close</button>
        </div>
      )}
      {incoming && (
        <div className="fixed inset-0 z-[90] bg-[#1c1416] text-[#f3ece6] flex flex-col">
          {portrait}
          <p className="mt-2 text-center text-sm text-white/70">{call?.type === 'video' ? 'Incoming video call' : 'Incoming voice call'}</p>
          <div className="mt-auto px-6 pt-4 flex justify-center gap-8" style={{ paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <button type="button" className="min-w-16 min-h-12 px-4 rounded-full bg-stone-600 text-sm" onClick={() => { stopRing(); void declineCall(matchId); }} aria-label="Decline">Decline</button>
            <button type="button" className="min-w-16 min-h-12 px-4 rounded-full bg-emerald-700 text-sm" onClick={() => void accept()} aria-label="Answer">Answer</button>
          </div>
        </div>
      )}
      {outgoing && (
        <div className="fixed inset-0 z-[90] bg-[#1c1416] text-[#f3ece6] flex flex-col">
          {portrait}
          <p className="mt-2 text-center text-sm text-white/70">{call?.status === 'ringing' ? 'Ringing...' : 'Calling...'}</p>
          <div className="mt-auto px-6 pt-4 flex justify-center" style={{ paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))' }}>
            <button type="button" className="min-w-28 min-h-12 px-4 rounded-full bg-rose-800 text-sm" onClick={() => { stopRing(); void cancelCall(matchId); }} aria-label="Cancel">Cancel</button>
          </div>
        </div>
      )}
      {call?.status === 'accepted' && hasMedia && (call.callerId === myId || call.calleeId === myId) && (
        <div className="fixed inset-0 z-[90] h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-black text-white">
          {call.type === 'video' && <video ref={remoteRef} autoPlay playsInline onLoadedData={() => { if ((remoteRef.current?.videoWidth || 0) > 0) setHasRemoteVideo(true); }} className="absolute inset-0 z-0 h-full w-full object-cover pointer-events-none" />}
          {call.type === 'video' && !hasRemoteVideo && <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">{portrait}</div>}
          {call.type === 'video' && cameraOn && <video ref={localRef} autoPlay muted playsInline className="absolute right-3 z-20 h-36 w-24 rounded-2xl object-cover pointer-events-none" style={{ top: 'max(4.5rem, env(safe-area-inset-top))' }} />}
          <div className="absolute left-4 z-20" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
            <p className="font-semibold">{peerName}</p>
            <p className="text-sm text-white/80">{hasRemoteVideo || connected ? formatDuration(elapsed) : 'Connecting...'}</p>
          </div>
          {cameraNote && <p className="absolute inset-x-0 z-20 text-center text-xs" style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))' }}>{cameraNote}</p>}
          <div className="absolute inset-x-0 z-30 grid grid-cols-4 px-3" style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <button type="button" className="mx-auto h-14 w-14 rounded-full bg-white/20 text-[11px]" onClick={() => { setMuted((m) => !m); streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = muted; }); }}>{muted ? 'Unmute' : 'Mute'}</button>
            {call.type === 'video' ? <button type="button" className="mx-auto h-14 w-14 rounded-full bg-white/20 text-[11px]" onClick={() => { const next = !cameraOn; setCameraOn(next); streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = next; }); }}>{cameraOn ? 'Camera' : 'Off'}</button> : <span />}
            {call.type === 'video' ? <button type="button" className="mx-auto h-14 w-14 rounded-full bg-white/20 text-[11px]" disabled={flipping} onClick={() => {
              void (async () => {
                setFlipping(true);
                setCameraNote(null);
                const old = streamRef.current?.getVideoTracks()[0];
                const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
                const currentId = old?.getSettings().deviceId;
                try {
                  const nextFacing = facing === 'user' ? 'environment' : 'user';
                const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
                const old = streamRef.current?.getVideoTracks()[0];
                if (!sender || !old) throw new Error('no sender');
                const previousFacing = facing;
                old.stop();
                const open = async (mode: 'user' | 'environment') => {
                  try {
                    return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: mode } });
                  } catch {
                    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId);
                    const target = devices.find((d) => d.deviceId !== old.getSettings().deviceId) || devices[0];
                    if (!target) throw new Error('no camera');
                    return navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: target.deviceId } } });
                  }
                };
                let nextStream: MediaStream;
                try {
                  nextStream = await open(nextFacing);
                } catch {
                  nextStream = await open(previousFacing);
                  throw new Error('switch failed');
                }
                const nextTrack = nextStream.getVideoTracks()[0];
                if (!nextTrack) throw new Error('no track');
                await sender.replaceTrack(nextTrack);
                if (streamRef.current) {
                  streamRef.current.getVideoTracks().forEach((track) => streamRef.current?.removeTrack(track));
                  streamRef.current.addTrack(nextTrack);
                }
                if (localRef.current) localRef.current.srcObject = new MediaStream([nextTrack]);
                setFacing(nextFacing);
                } catch {
                  setCameraNote('Unable to switch camera');
                } finally {
                  setFlipping(false);
                }
              })();
            }}>{flipping ? '...' : 'Flip'}</button> : <span />}
            <button type="button" className="mx-auto h-14 w-14 rounded-full bg-rose-700 text-[11px]" onClick={() => { stopRing(); stopMedia(); void endCall(matchId); }}>End</button>
          </div>
        </div>
      )}
    </>
  );
};
