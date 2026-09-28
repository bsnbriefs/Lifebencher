/**
 * Cross-platform Audio Recording utility for mobile (iOS Safari, Android Chrome) and Desktop.
 * Automatically chooses the best supported audio MIME type and handles audio streams cleanly.
 */

const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
  'audio/ogg'
];

export function getSupportedMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return undefined;
  }

  for (const mime of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return undefined; // Default browser container
}

export interface RecordingSession {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  stop: () => Promise<{ blob: Blob; mimeType: string; duration: number; dataUrl: string }>;
  cancel: () => void;
}

export async function startAudioRecording(): Promise<RecordingSession> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Audio recording is not supported on this device/browser.');
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message.includes('Permission denied')) {
        const permErr = new Error('Microphone permission denied. Please allow microphone access in your browser or iframe.');
        permErr.name = 'NotAllowedError';
        throw permErr;
      }
    }
    throw err;
  }

  const selectedMime = getSupportedMimeType();
  const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
  const mediaRecorder = new MediaRecorder(stream, options);

  const chunks: Blob[] = [];
  const startTime = Date.now();

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  mediaRecorder.start(100); // 100ms timeslices for smooth chunk collection

  const cleanupStream = () => {
    stream.getTracks().forEach((track) => track.stop());
  };

  const cancel = () => {
    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    cleanupStream();
  };

  const stop = (): Promise<{ blob: Blob; mimeType: string; duration: number; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        cleanupStream();
        const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const mimeType = selectedMime || mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });

        try {
          const dataUrl = await blobToDataUrl(blob);
          resolve({ blob, mimeType, duration, dataUrl });
        } catch (err) {
          reject(err);
        }
      };

      mediaRecorder.onerror = (e) => {
        cleanupStream();
        reject(e);
      };

      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    });
  };

  return { mediaRecorder, stream, stop, cancel };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert audio blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Generates an audible, valid audio WAV data URL containing a warm greeting chime
 * for initial seed voice notes and offline testing.
 */
export function createDemoVoiceAudioUrl(): string {
  if (typeof window === 'undefined') return '';
  const sampleRate = 16000;
  const numChannels = 1;
  const duration = 4;
  const numSamples = sampleRate * duration;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Warm gentle melody sequence: C4, E4, G4, C5
  const notes = [261.63, 329.63, 392.00, 523.25];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t / 1.0));
    const freq = notes[noteIdx];
    const decay = Math.exp(-((t % 1.0) * 2.5));
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.35 * decay;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

