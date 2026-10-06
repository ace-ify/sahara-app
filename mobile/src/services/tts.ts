// Natural voice playback — server-side Murf TTS from `${API_BASE_URL}/api/tts`,
// played through expo-audio on native and HTMLAudio on web. expo-speech (the
// robotic device TTS) remains only as a last-resort fallback when the server
// is unreachable or the audio genuinely fails to play — every fallback is
// logged loudly with the exact error so the cause is always visible.
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { API_BASE_URL } from './api';

type VoiceCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
};

// Lazily required so web bundles never evaluate the native module.
let createAudioPlayer: any = null;
let setAudioModeAsync: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoAudio = require('expo-audio');
    createAudioPlayer = expoAudio.createAudioPlayer;
    setAudioModeAsync = expoAudio.setAudioModeAsync;
  } catch (err) {
    console.warn('[tts] expo-audio unavailable — device TTS will be used:', err);
  }
}

let currentPlayer: any = null;
let speechGeneration = 0;

function speakWithDeviceTts(text: string, lang: string, cb?: VoiceCallbacks) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.pitch = 1.05;
      utterance.rate = 0.95;
      utterance.onend = () => cb?.onDone?.();
      utterance.onerror = () => cb?.onError?.();
      cb?.onStart?.();
      window.speechSynthesis.speak(utterance);
      return;
    }
    Speech.speak(text, {
      language: lang === 'hi' ? 'hi-IN' : 'en-IN',
      pitch: 1.05,
      rate: 0.95,
      onDone: () => cb?.onDone?.(),
      onError: () => cb?.onError?.(),
      onStopped: () => cb?.onDone?.(),
    });
    cb?.onStart?.();
  } catch (err) {
    console.warn('[tts] device TTS speak failed:', err);
    cb?.onError?.();
  }
}

export function stopNaturalVoice() {
  speechGeneration += 1;
  const player = currentPlayer;
  currentPlayer = null;
  if (player) {
    try {
      player.pause?.();
    } catch {}
    try {
      player.release?.();
    } catch {}
  }
  try {
    Speech.stop();
  } catch {}
  if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

// Shared audio element and Web Audio API context primed on user interaction
let sharedAudioElement: HTMLAudioElement | null = null;
let webAudioContext: any = null;

export function primeWebAudio() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (!sharedAudioElement) {
      sharedAudioElement = new window.Audio();
      sharedAudioElement.crossOrigin = 'anonymous';
    }
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx && !webAudioContext) {
      webAudioContext = new AudioCtx();
    }
    if (webAudioContext && webAudioContext.state === 'suspended') {
      webAudioContext.resume().catch(() => {});
    }
    // Briefly prime media playback with tiny silent buffer
    sharedAudioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
    const p = sharedAudioElement.play();
    if (p !== undefined) {
      p.then(() => {
        sharedAudioElement?.pause();
      }).catch(() => {});
    }
  } catch {}
}

export function unlockWebAudio() {
  primeWebAudio();
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlock = () => {
    primeWebAudio();
    window.removeEventListener('click', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('keydown', unlock, { once: true, passive: true });
}

function playWebAudio(
  audioUrl: string,
  trimmed: string,
  lang: string,
  gen: number,
  cb?: VoiceCallbacks,
) {
  try {
    const audio = sharedAudioElement || new window.Audio();
    audio.crossOrigin = 'anonymous';
    currentPlayer = audio;

    audio.onended = () => {
      if (gen === speechGeneration) cb?.onDone?.();
    };
    audio.onerror = (e: any) => {
      console.warn('[tts] web audio element error for', audioUrl, e);
      if (gen === speechGeneration) speakWithDeviceTts(trimmed, lang, cb);
    };

    cb?.onStart?.();
    audio.src = audioUrl;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: any) => {
        if (err?.name === 'AbortError') return;
        console.warn('[tts] web audio play() rejected (falling back to device TTS):', err);
        if (gen === speechGeneration) speakWithDeviceTts(trimmed, lang, cb);
      });
    }
  } catch (err) {
    console.warn('[tts] web audio play() threw:', err);
    if (gen === speechGeneration) speakWithDeviceTts(trimmed, lang, cb);
  }
}

async function playNativeAudio(
  audioUrl: string,
  audioLengthSec: number,
  trimmed: string,
  lang: string,
  gen: number,
  cb?: VoiceCallbacks,
) {
  if (!createAudioPlayer) {
    console.warn('[tts] expo-audio createAudioPlayer unavailable — device TTS fallback');
    speakWithDeviceTts(trimmed, lang, cb);
    return;
  }

  // Proper playback mode: audible while the device is silenced, ducks other
  // apps, no background session, and STT recording turned off so the speaker
  // is exclusive. Playback proceeds even if the mode call fails.
  if (setAudioModeAsync) {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      allowsRecording: false,
      interruptionMode: 'duckOthers',
    }).catch((err: unknown) => {
      console.warn('[tts] setAudioModeAsync failed (continuing):', err);
    });
    if (gen !== speechGeneration) return;
  }

  // downloadFirst fetches the whole MP3 to tmp before playback — the reliable
  // way to play short remote clips (no streaming stalls, no half-played audio).
  let player: any;
  try {
    player = createAudioPlayer({ uri: audioUrl }, { downloadFirst: true, updateInterval: 250 });
  } catch (err) {
    console.warn('[tts] createAudioPlayer failed for', audioUrl, '— device TTS fallback:', err);
    speakWithDeviceTts(trimmed, lang, cb);
    return;
  }
  currentPlayer = player;

  let settled = false;
  let safetyTimer: ReturnType<typeof setTimeout> | null = null;
  let durationArmed = false;
  let notPlayingTicks = 0;
  let subscription: any = null;

  const clearSafety = () => {
    if (safetyTimer) {
      clearTimeout(safetyTimer);
      safetyTimer = null;
    }
  };
  const dispose = () => {
    clearSafety();
    try {
      subscription?.remove?.();
    } catch {}
    try {
      player.release();
    } catch {}
    if (currentPlayer === player) currentPlayer = null;
  };
  const finish = () => {
    if (settled) return;
    settled = true;
    dispose();
    if (gen === speechGeneration) cb?.onDone?.();
  };
  const fail = (reason: unknown) => {
    if (settled) return;
    settled = true;
    dispose();
    console.warn(
      '[tts] remote Murf playback failed → device TTS fallback · url:',
      audioUrl,
      '· error:',
      reason,
    );
    if (gen === speechGeneration) speakWithDeviceTts(trimmed, lang, cb);
  };

  try {
    subscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (settled || gen !== speechGeneration) return;
      if (status?.error) {
        fail(new Error(`player status error: ${status.error}`));
        return;
      }
      if (status?.didJustFinish) {
        finish();
        return;
      }
      // Once the real duration is known, re-arm the safety net accurately.
      if (!durationArmed && status?.isLoaded && (status?.duration || 0) > 0) {
        durationArmed = true;
        clearSafety();
        safetyTimer = setTimeout(finish, status.duration * 1000 + 8000);
      }
      // Loaded but idle across two updates — play() may have been requested
      // before load completed and got lost; nudge playback once (only near
      // the start of the clip, so a finished clip is never restarted).
      if (
        status?.isLoaded &&
        !status?.playing &&
        !status?.paused &&
        (status?.currentTime || 0) < 0.25
      ) {
        notPlayingTicks += 1;
        if (notPlayingTicks === 2) {
          try {
            player.play();
          } catch (err) {
            fail(err);
          }
        }
      } else {
        notPlayingTicks = 0;
      }
    });
    cb?.onStart?.();
    player.play();
    // Last-resort net: resolves onDone if the didJustFinish event never
    // arrives. Re-armed with the real duration as soon as it is known.
    const estimatedSec =
      audioLengthSec > 0 ? audioLengthSec : Math.max(4, trimmed.length / 13);
    safetyTimer = setTimeout(finish, Math.min(180000, estimatedSec * 1000 + 8000));
  } catch (err) {
    fail(err);
  }
}

/**
 * Speak `text` with the natural Murf voice via the backend.
 * Falls back to device TTS only when the server call or playback genuinely
 * fails — each failure is logged with the exact error.
 */
export async function speakNatural(text: string, lang: string = 'hi', cb?: VoiceCallbacks) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    cb?.onError?.();
    return;
  }

  // Unlock audio context synchronously during user gesture window on Web
  if (Platform.OS === 'web') {
    unlockWebAudio();
  }

  stopNaturalVoice();
  const gen = speechGeneration;

  let audioUrl: string | null = null;
  let audioLengthSec = 0;
  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, lang }),
      });
      if (!res.ok) throw new Error(`primary tts error ${res.status}`);
    } catch (primaryErr) {
      // Automatic fallback: try secondary backend URL (Render if local, or localhost if remote)
      const fallbackUrl = API_BASE_URL.includes('localhost')
        ? 'https://sahara-sh0i.onrender.com/api/tts'
        : 'http://localhost:8000/api/tts';
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, lang }),
      });
      if (!res.ok) throw primaryErr;
    }

    if (gen !== speechGeneration) return;
    const data = await res.json();
    audioUrl = data?.audio_url || data?.audioFile || null;
    audioLengthSec = Number(data?.audio_length) || 0;
    if (!audioUrl) throw new Error('response contained no audio_url');
  } catch (err) {
    console.warn('[tts] Murf server request failed → device TTS fallback:', err);
    if (gen === speechGeneration) speakWithDeviceTts(trimmed, lang, cb);
    return;
  }
  if (gen !== speechGeneration) return;

  if (Platform.OS === 'web') {
    playWebAudio(audioUrl, trimmed, lang, gen, cb);
    return;
  }
  await playNativeAudio(audioUrl, audioLengthSec, trimmed, lang, gen, cb);
}
