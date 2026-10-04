// Natural voice playback — server-side Murf TTS (same "Anisha" voice as the
// RTC agent) with an expo-speech fallback when the server is unreachable.
// This replaces the robotic device TTS ("machinery awaaz") for greetings,
// replies, and the onboarding voice preview on native.
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { API_BASE_URL } from './api';

type VoiceCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: () => void;
};

// Lazily required so web (no expo-audio native module) still works.
let AudioModule: any = null;
let createAudioPlayer: any = null;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoAudio = require('expo-audio');
    AudioModule = expoAudio.AudioModule;
    createAudioPlayer = expoAudio.createAudioPlayer;
  } catch {}
}

let currentPlayer: any = null;
let speechGeneration = 0;

function speakWithDeviceTts(text: string, lang: string, cb?: VoiceCallbacks) {
  try {
    Speech.speak(text, {
      language: lang === 'hi' ? 'hi-IN' : 'en-IN',
      pitch: 1.05,
      rate: 0.95,
      onDone: () => cb?.onDone?.(),
      onError: () => cb?.onError?.(),
      onStopped: () => cb?.onDone?.(),
    });
    cb?.onStart?.();
  } catch {
    cb?.onError?.();
  }
}

export function stopNaturalVoice() {
  speechGeneration += 1;
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.release();
    } catch {}
    currentPlayer = null;
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

/**
 * Speak `text` with the natural Murf voice via the backend.
 * Falls back to device TTS when the server call or playback fails.
 */
export async function speakNatural(text: string, lang: string = 'hi', cb?: VoiceCallbacks) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    cb?.onError?.();
    return;
  }

  stopNaturalVoice();
  const gen = speechGeneration;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, lang }),
    });
    if (gen !== speechGeneration) return;

    if (!res.ok) throw new Error(`tts ${res.status}`);
    const data = await res.json();
    const audioUrl = data?.audio_url;
    if (!audioUrl) throw new Error('no audio_url');

    if (Platform.OS === 'web') {
      const audio = new window.Audio(audioUrl);
      audio.onplay = () => cb?.onStart?.();
      audio.onended = () => {
        if (gen === speechGeneration) cb?.onDone?.();
      };
      audio.onerror = () => speakWithDeviceTts(trimmed, lang, cb);
      currentPlayer = audio;
      cb?.onStart?.();
      try {
        await audio.play();
      } catch {
        speakWithDeviceTts(trimmed, lang, cb);
      }
      return;
    }

    if (!createAudioPlayer) throw new Error('expo-audio unavailable');

    try {
      await AudioModule?.setAudioModeAsync?.({
        playsInSilentMode: true,
        allowsRecording: false,
      });
    } catch {}

    const player = createAudioPlayer(audioUrl);
    currentPlayer = player;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (gen === speechGeneration) cb?.onDone?.();
      try {
        player.release();
      } catch {}
      if (currentPlayer === player) currentPlayer = null;
    };
    try {
      player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.didJustFinish) finish();
      });
    } catch {}
    cb?.onStart?.();
    player.play();
    // Safety net: if the didJustFinish event never arrives, resolve via duration.
    const estMs = Math.min(120000, Math.max(2000, ((data?.audio_length || 0) as number) * 1000 + 4000));
    fallbackTimer = setTimeout(finish, estMs);
    return;
  } catch (err) {
    console.warn('speakNatural fell back to device TTS:', err);
  } finally {
    if (fallbackTimer) clearTimeout(fallbackTimer);
  }

  if (gen === speechGeneration) {
    speakWithDeviceTts(trimmed, lang, cb);
  }
}
