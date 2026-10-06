// Real speech-to-text dictation.
// Native: record with expo-audio → POST bytes to backend /api/transcribe
// (Groq Whisper) → caller types the result into the chat input.
// Web: live browser SpeechRecognition with interim results.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from './api';

export type DictationPhase = 'idle' | 'recording' | 'transcribing';

const MAX_RECORDING_MS = 30000;
// Hands-free voice-turn caps (call/loop mode): stop shortly after the caller
// pauses, or hard-cap the turn so the loop always advances.
const VOICE_TURN_MAX_MS = 14000;
const VOICE_TURN_SILENCE_MS = 1400;
const VOICE_TURN_SPEECH_LEVEL = 0.16; // normalized mic level treating as speech

export interface Dictation {
  phase: DictationPhase;
  error: string | null;
  start: () => void;
  stop: () => void;
  cancel: () => void;
  /**
   * Voice-turn mode (hands-free duplex-lite): while recording, silence is
   * detected via mic metering and the turn auto-commits — no button tap.
   */
  setVoiceTurn: (on: boolean) => void;
}

export interface DictationResultHandler {
  (text: string, isLive: boolean): void;
}

export interface DictationHooks {
  /** Live mic level 0..1 while recording — feeds the audio-reactive orb. */
  onLevel?: (level: number) => void;
}

function guessContentType(uri: string) {
  if (uri.endsWith('.m4a') || uri.endsWith('.mp4')) return 'audio/m4a';
  if (uri.endsWith('.wav')) return 'audio/wav';
  if (uri.endsWith('.webm')) return 'audio/webm';
  if (uri.endsWith('.mp3')) return 'audio/mpeg';
  return 'audio/m4a';
}

async function transcribeOnServer(uri: string, lang: string): Promise<string> {
  // Allow Android audio subsystem a moment to finalize file header
  await new Promise((resolve) => setTimeout(resolve, 150));

  const formData = new FormData();
  formData.append('file', {
    uri,
    name: 'speech.m4a',
    type: guessContentType(uri),
  } as any);

  const res = await fetch(
    `${API_BASE_URL}/api/transcribe?lang=${encodeURIComponent(lang)}`,
    {
      method: 'POST',
      body: formData,
    },
  );
  if (!res.ok) throw new Error(`stt-${res.status}`);
  const data = await res.json();
  return (data?.text || '').trim();
}

// ---------------------------------------------------------------------------
// Web: live browser SpeechRecognition (interim results stream into the input)
// ---------------------------------------------------------------------------
function useDictationWeb(lang: string, onResult: DictationResultHandler, hooks?: DictationHooks): Dictation {
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onLevelRef = useRef(hooks?.onLevel);
  onLevelRef.current = hooks?.onLevel;
  const voiceTurnRef = useRef(false);

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      recognitionRef.current = null;
    },
    [],
  );

  const start = useCallback(() => {
    const SR: any =
      (globalThis as any).SpeechRecognition || (globalThis as any).webkitSpeechRecognition;
    if (!SR) {
      setError(
        lang === 'hi'
          ? 'इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है।'
          : 'Speech recognition is not supported in this browser.',
      );
      return;
    }
    try {
      const rec = new SR();
      rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      let finalText = '';
      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const chunk = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) finalText += `${chunk} `;
          else interim += chunk;
        }
        const live = `${finalText}${interim}`.replace(/\s+/g, ' ');
        if (live.trim()) onResultRef.current(live.trim(), true);
      };
      rec.onspeechstart = () => onLevelRef.current?.(0.55);
      rec.onaudiostart = () => onLevelRef.current?.(0.25);
      rec.onerror = (event: any) => {
        // Surface the real cause instead of silently dying — "not-allowed"
        // (mic blocked) and "no-speech" were previously swallowed, leaving the
        // call looking live while nothing was being heard.
        const kind = event?.error || 'unknown';
        if (kind === 'not-allowed' || kind === 'service-not-allowed') {
          setError(
            lang === 'hi'
              ? 'माइक्रोफ़ोन बंद है — ब्राउज़र में अनुमति दें।'
              : 'Microphone blocked — allow mic access in the browser.',
          );
        } else if (kind === 'audio-capture') {
          setError(
            lang === 'hi' ? 'माइक्रोफ़ोन नहीं मिला।' : 'No microphone found.',
          );
        } else if (kind === 'network') {
          setError(
            lang === 'hi'
              ? 'आवाज़ सेवा से संपर्क नहीं — इंटरनेट जाँचें।'
              : 'Speech service unreachable — check internet.',
          );
        }
        setPhase('idle');
      };
      rec.onend = () => setPhase((prev) => (prev === 'recording' ? 'idle' : prev));
      recognitionRef.current = rec;
      rec.start();
      setPhase('recording');
    } catch {
      setError(lang === 'hi' ? 'माइक शुरू नहीं हो सका।' : 'Could not start the microphone.');
    }
  }, [lang]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    recognitionRef.current = null;
    setPhase('idle');
  }, []);

  const cancel = useCallback(() => {
    try {
      recognitionRef.current?.abort?.();
    } catch {}
    recognitionRef.current = null;
    voiceTurnRef.current = false;
    setPhase('idle');
  }, []);

  return { phase, error, start, stop, cancel, setVoiceTurn: (on: boolean) => { voiceTurnRef.current = on; } };
}

// ---------------------------------------------------------------------------
// Native: expo-audio record → backend Whisper transcribe
// ---------------------------------------------------------------------------
function useDictationNative(lang: string, onResult: DictationResultHandler, hooks?: DictationHooks): Dictation {
  const [phase, setPhase] = useState<DictationPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const expoAudio = useRef<any>(null);
  if (!expoAudio.current) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      expoAudio.current = require('expo-audio');
    } catch {
      expoAudio.current = null;
    }
  }
  const { useAudioRecorder: useRec, RecordingPresets, AudioModule, setAudioModeAsync } = expoAudio.current || ({} as any);

  // Voice-turn state (hands-free call mode) + live mic level plumbing.
  const voiceTurnRef = useRef(false);
  const gotSpeechRef = useRef(false);
  const startedAtRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const onLevelRef = useRef(hooks?.onLevel);
  onLevelRef.current = hooks?.onLevel;
  const doStopRef = useRef<() => void>(() => {});

  const statusListenerRef = useRef<(status: any) => void>(() => {});
  statusListenerRef.current = (status: any) => {
    if (phaseRef.current !== 'recording') return;
    // Mic metering (dB, roughly -160..0) → normalized 0..1 level.
    const metering = typeof status?.metering === 'number' ? status.metering : -160;
    const norm = Math.max(0, Math.min(1, (metering + 50) / 50));
    onLevelRef.current?.(norm);
    if (!voiceTurnRef.current) return;
    const now = Date.now();
    if (norm > VOICE_TURN_SPEECH_LEVEL) {
      gotSpeechRef.current = true;
      lastSpeechAtRef.current = now;
    }
    const elapsed = now - startedAtRef.current;
    const silenceMs = now - lastSpeechAtRef.current;
    if ((gotSpeechRef.current && silenceMs > VOICE_TURN_SILENCE_MS) || elapsed > VOICE_TURN_MAX_MS) {
      voiceTurnRef.current = false;
      doStopRef.current();
    }
  };

  const recorder = useRec
    ? useRec(
        { ...(RecordingPresets?.HIGH_QUALITY || {}), isMeteringEnabled: true },
        (status: any) => statusListenerRef.current(status),
      )
    : null;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoStop = () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  useEffect(() => clearAutoStop, []);

  const doStop = useCallback(async () => {
    clearAutoStop();
    if (!recorder || phaseRef.current !== 'recording') return;
    phaseRef.current = 'transcribing';
    setPhase('transcribing');
    let uri = '';
    try {
      if (recorder.isRecording) {
        await recorder.stop();
      }
      uri = recorder.uri || '';
    } catch (e) {
      console.warn('recorder stop failed:', e);
    }
    try {
      try {
        await setAudioModeAsync?.({ playsInSilentMode: true, allowsRecording: false });
      } catch {}
      if (!uri) throw new Error('no-uri');
      const text = await transcribeOnServer(uri, lang);
      if (text) onResultRef.current(text, false);
      else
        setError(
          lang === 'hi' ? 'कुछ समझ नहीं आया, दोबारा बोलिए।' : "Didn't catch that — please try again.",
        );
    } catch (e) {
      console.warn('transcription failed:', e);
      setError(
        lang === 'hi'
          ? 'आवाज़ पहचान नहीं हो सकी, दोबारा कोशिश करें।'
          : 'Transcription failed, please try again.',
      );
    } finally {
      phaseRef.current = 'idle';
      setPhase('idle');
    }
  }, [lang, recorder, setAudioModeAsync]);

  doStopRef.current = () => void doStop();

  const start = useCallback(() => {
    if (phaseRef.current !== 'idle' || !recorder) return;
    setError(null);
    void (async () => {
      try {
        const perm = await AudioModule?.requestRecordingPermissionsAsync?.();
        if (perm && perm.granted === false) {
          setError(
            lang === 'hi' ? 'माइक्रोफ़ोन की अनुमति चाहिए।' : 'Microphone permission is required.',
          );
          return;
        }
        try {
          await setAudioModeAsync?.({ playsInSilentMode: true, allowsRecording: true });
        } catch {}
        await recorder.prepareToRecordAsync({ ...(RecordingPresets?.HIGH_QUALITY || {}), isMeteringEnabled: true });
        recorder.record();
        phaseRef.current = 'recording';
        setPhase('recording');
        startedAtRef.current = Date.now();
        lastSpeechAtRef.current = Date.now();
        gotSpeechRef.current = false;
        clearAutoStop();
        autoStopRef.current = setTimeout(() => {
          void doStop();
        }, MAX_RECORDING_MS);
      } catch (e) {
        console.warn('dictation start failed:', e);
        setError(
          lang === 'hi' ? 'रिकॉर्डिंग शुरू नहीं हो सकी।' : 'Could not start recording.',
        );
        phaseRef.current = 'idle';
        setPhase('idle');
      }
    })();
  }, [lang, recorder, AudioModule, RecordingPresets, setAudioModeAsync, doStop]);

  const stop = useCallback(() => {
    void doStop();
  }, [doStop]);

  const cancel = useCallback(() => {
    clearAutoStop();
    voiceTurnRef.current = false;
    phaseRef.current = 'idle';
    try {
      if (recorder && recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
    } catch {}
    setPhase('idle');
  }, [recorder]);

  const setVoiceTurn = useCallback((on: boolean) => {
    voiceTurnRef.current = on;
    if (on) {
      gotSpeechRef.current = false;
      startedAtRef.current = Date.now();
      lastSpeechAtRef.current = Date.now();
    }
  }, []);

  return { phase, error, start, stop, cancel, setVoiceTurn };
}

export function useDictation(lang: string, onResult: DictationResultHandler, hooks?: DictationHooks): Dictation {
  if (Platform.OS === 'web') return useDictationWeb(lang, onResult, hooks);
  return useDictationNative(lang, onResult, hooks);
}
