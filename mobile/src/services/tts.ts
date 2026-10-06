// Natural voice playback — server-side Murf TTS from `${API_BASE_URL}/api/tts`,
// played through expo-audio on native and HTMLAudio on web. expo-speech (the
// robotic device TTS) remains only as a last-resort fallback when the server
// is unreachable or the audio genuinely fails to play — every fallback is
// logged loudly with the exact error so the cause is always visible.
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { API_BASE_URL, getBackendBaseUrl } from './api';

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

// Active streaming speaker (sentence-by-sentence playback for live replies) —
// tracked module-level so a global stopNaturalVoice() always silences it too.
let activeStreamingSpeaker: { stop(): void } | null = null;

export function stopNaturalVoice() {
  speechGeneration += 1;
  if (activeStreamingSpeaker) {
    const speaker = activeStreamingSpeaker;
    activeStreamingSpeaker = null;
    speaker.stop();
  }
  const player = currentPlayer;
  currentPlayer = null;
  if (player) {
    try {
      player.pause?.();
    } catch {}
    try {
      // RN web exposes HTMLAudioElement; scrub the src so a paused element
      // can't keep buffering a half-fetched clip.
      if (typeof player.removeAttribute === 'function') player.removeAttribute('src');
      player.load?.();
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
    // Fresh element per clip. Reusing the primed sharedAudioElement was the
    // machine-voice root cause: it sits paused mid-prime with a data: URI src,
    // and swapping src on a paused+crossOrigin element intermittently rejects
    // play() — which silently fell through to the robotic device TTS.
    // (The shared element is still used once for the unlock gesture only.)
    const audio = new window.Audio();
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
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err: any) => {
        if (err?.name === 'AbortError') return; // superseded by a newer clip
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
 * `opts.noStop` skips the global stop (used by the stream player for its own
 * clips, so advancing clips doesn't cancel itself).
 */
export async function speakNatural(
  text: string,
  lang: string = 'hi',
  cb?: VoiceCallbacks,
  opts?: { noStop?: boolean },
) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    cb?.onError?.();
    return;
  }

  // Unlock audio context synchronously during user gesture window on Web
  if (Platform.OS === 'web') {
    unlockWebAudio();
  }

  if (!opts?.noStop) {
    stopNaturalVoice();
  }
  const gen = speechGeneration;

  let audioUrl: string | null = null;
  let audioLengthSec = 0;
  try {
    // One retry on the SAME backend — a transient 5xx/network blip gets a
    // second chance. The old localhost fallback was unreachable from deployed
    // sites (netlify → http://localhost is dead by construction) and only
    // burned seconds before the robotic device-TTS fallback kicked in.
    let res: Response | null = null;
    const baseUrl = getBackendBaseUrl();
    for (let attempt = 0; attempt < 2 && !res; attempt += 1) {
      try {
        const r = await fetch(`${baseUrl}/api/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed, lang }),
        });
        if (r.ok) {
          res = r;
          break;
        }
      } catch {
        // brief retry
      }
    }

    if (!res) throw new Error('no response from tts');
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

// ---------------------------------------------------------------------------
// Streaming speaker — for live LLM replies.
// Text is synthesized + played sentence by sentence: the first sentence's
// audio starts while later sentences are still being generated, so the
// perceived gap between "answer ready" and "answer heard" collapses from
// full-text-synthesis-time to first-sentence-synthesis-time.
// ---------------------------------------------------------------------------

/** Split a full reply into speakable sentences (Hindi & English aware). */
function splitIntoSpeakableChunks(text: string): string[] {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  // Split STRICTLY on sentence terminators: danda (।), period, question mark, exclamation
  const parts = clean.split(/(?<=[।.?!\n])/);
  const chunks: string[] = [];
  let buffer = '';
  for (const part of parts) {
    const piece = part.trim();
    if (!piece) continue;
    buffer += (buffer ? ' ' : '') + piece;
    // Only flush if it's a full complete sentence of at least 55 chars
    if (buffer.length >= 55 && /[।.?!]$/.test(buffer)) {
      chunks.push(buffer);
      buffer = '';
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}

export interface SpeakStreamCallbacks {
  /** Fires once when the first audio chunk actually starts playing. */
  onFirstAudio?: () => void;
  onDone?: (fullText: string) => void;
  onError?: () => void;
}

// Raw 24kHz 16-bit mono PCM relayed by /api/tts/stream.
const PCM_SAMPLE_RATE = 24000;
// In-band failure marker the server appends when both Murf regions fail.
const TTS_STREAM_ERROR = '__TTS_ERROR__';

/**
 * Web: schedules raw PCM chunks on ONE WebAudio timeline as they arrive —
 * gapless by construction (each buffer starts where the last ends), which is
 * what killed the old fragmented per-sentence <audio> clips.
 */
class PcmScheduler {
  private ctx: AudioContext;
  private nextStart = 0; // ctx timeline position where the next chunk plays
  private pendingByte = 0; // leftover byte from an odd-length chunk
  private sources = new Set<AudioBufferSourceNode>();
  private stopped = false;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** Seconds of audio still queued to play (context timeline). */
  get remaining(): number {
    return Math.max(0, this.nextStart - this.ctx.currentTime);
  }

  schedule(bytes: Uint8Array): boolean {
    if (this.stopped || !bytes.length) return false;
    if (this.pendingByte) {
      // Stitch the previous odd byte in front of this chunk.
      const buf = new Uint8Array(bytes.length + 1);
      buf[0] = this.pendingByte;
      buf.set(bytes, 1);
      bytes = buf;
      this.pendingByte = 0;
    }
    if (bytes.length % 2) {
      this.pendingByte = bytes[bytes.length - 1];
      const trimmed = new Uint8Array(bytes.length - 1);
      trimmed.set(bytes.subarray(0, bytes.length - 1));
      bytes = trimmed;
    }
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
    if (!samples.length) return false;

    const floats = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i += 1) floats[i] = samples[i] / 32768;

    const buffer = this.ctx.createBuffer(1, floats.length, PCM_SAMPLE_RATE);
    buffer.copyToChannel(floats, 0);

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    // Small lead-in so a late chunk never backfills over played audio.
    const when = Math.max(this.ctx.currentTime + 0.08, this.nextStart);
    src.start(when);
    this.nextStart = when + buffer.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
    return true;
  }

  stop() {
    this.stopped = true;
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {}
    }
    this.sources.clear();
  }
}

/**
 * Incremental natural-voice playback: `pushText` feeds text as it streams in;
 * complete sentences are fetched from Murf and queued for playback in order.
 * Call `stop()` to cancel (also triggered by the global stopNaturalVoice()).
 */
export function speakNaturalStream(lang: string, cb: SpeakStreamCallbacks) {
  stopNaturalVoice();

  const chunks: string[] = [];
  let closed = false;
  let generation = speechGeneration;
  let playedAny = false;
  let firstAudioFired = false;
  let scheduler: PcmScheduler | null = null;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Reuse the gesture-primed context; create it if it somehow isn't yet.
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      if (!webAudioContext) webAudioContext = new AudioCtx();
      if (webAudioContext && webAudioContext.state === 'suspended') {
        webAudioContext.resume().catch(() => {});
      }
      scheduler = new PcmScheduler(webAudioContext);
    }
  }
  const isWebStream = scheduler !== null;

  const fireFirstAudio = () => {
    if (!firstAudioFired) {
      firstAudioFired = true;
      cb.onFirstAudio?.();
    }
  };

  /** Fetch one sentence from the streaming endpoint, scheduling PCM as it arrives. */
  const streamSentence = async (text: string): Promise<void> => {
    if (generation !== speechGeneration) return;
    const baseUrl = getBackendBaseUrl();
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2 && !res; attempt += 1) {
      try {
        const r = await fetch(`${baseUrl}/api/tts/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang }),
        });
        if (r.ok && r.body) {
          res = r;
          break;
        }
      } catch {
        // brief retry
      }
    }
    if (!res || !res.body) throw new Error('no response from tts stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sawErrorMarker = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (generation !== speechGeneration) return;
        if (!value || !value.length) continue;
        // Murf failure marker arrives as a tiny ASCII-only tail chunk (real
        // PCM chunks are kilobytes, so an exact match is never a false hit).
        if (value.length <= TTS_STREAM_ERROR.length) {
          const asText = decoder.decode(value);
          if (asText === TTS_STREAM_ERROR) {
            sawErrorMarker = true;
            continue;
          }
        }
        if (scheduler?.schedule(value)) {
          playedAny = true;
          fireFirstAudio();
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
    if (sawErrorMarker && !playedAny) throw new Error('murf stream failed both regions');
  };

  /** Native path: play each sentence via the cached blob endpoint. */
  const playClipBlob = (text: string): Promise<void> =>
    new Promise((resolve) => {
      if (generation !== speechGeneration) {
        resolve();
        return;
      }
      speakNatural(
        text,
        lang,
        {
          onDone: () => resolve(),
          onError: () => resolve(),
          onStart: () => {
            playedAny = true;
            fireFirstAudio();
          },
        },
        { noStop: true },
      );
    });

  const runQueue = async () => {
    let next = 0;
    while (generation === speechGeneration) {
      if (next < chunks.length) {
        const text = chunks[next];
        next += 1;
        try {
          if (isWebStream) {
            // Serialized fetches: sentence N+1's synthesis starts only after
            // N's stream ends — synthesis runs ahead of playback, and Murf's
            // per-region concurrency (2) is respected. Sentences never play
            // out of order.
            await streamSentence(text);
          } else {
            await playClipBlob(text);
          }
        } catch (err) {
          // A single failed sentence is skipped (text still shows); the
          // no-audio-at-all case is handled after the loop.
          console.warn('[tts] stream sentence failed (skipping):', err);
        }
      } else if (closed) {
        break;
      } else {
        await new Promise((r) => setTimeout(r, 80));
      }
    }

    if (generation !== speechGeneration) return;

    if (!playedAny) {
      // Nothing was synthesized at all — device TTS keeps the turn audible.
      const full = chunks.join(' ');
      console.warn('[tts] stream produced no audio → device TTS fallback');
      cb.onError?.();
      speakWithDeviceTts(full, lang, {
        onDone: () => {
          if (activeStreamingSpeaker === (speakerRef as any)) activeStreamingSpeaker = null;
        },
      });
      return;
    }

    // Web: wait for the scheduled tail to finish playing. Native: each clip
    // already resolved on end, so we're done.
    if (isWebStream && scheduler) {
      // ponytail: 100ms polling; a SourceNode-ended promise would save ~50ms
      while (generation === speechGeneration && scheduler.remaining > 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (generation === speechGeneration) {
      if (activeStreamingSpeaker === (speakerRef as any)) {
        activeStreamingSpeaker = null;
      }
      cb.onDone?.(chunks.join(' '));
    }
  };

  // Pending incomplete-sentence tail (module fn scope) — declared before the
  // speaker object so its closures see the binding.
  let _pending = '';

  // Identity ref: runQueue and streamSentence check which speaker is live.
  const speakerRef: any = {};

  const speaker = {
    /** Feed streamed text; full sentences are queued for playback in continuous order. */
    pushText(delta: string) {
      if (generation !== speechGeneration) return;
      _pending += delta;
      const ready = splitIntoSpeakableChunks(_pending);
      if (ready.length <= 1) return;

      const lastPiece = ready[ready.length - 1];
      const complete = ready.slice(0, ready.length - 1);
      for (const piece of complete) {
        if (piece.trim()) chunks.push(piece.trim());
      }
      _pending = lastPiece;
    },
    /** Mark the text stream complete; flush the pending tail and finish. */
    close() {
      if (closed) return;
      closed = true;
      const tail = _pending.trim();
      if (tail) {
        chunks.push(tail);
        _pending = '';
      }
    },
    stop() {
      generation = -1; // invalidate this speaker against future stop calls
      closed = true;
      scheduler?.stop();
      chunks.length = 0;
      _pending = '';
    },
  };

  if (activeStreamingSpeaker && activeStreamingSpeaker !== speakerRef) {
    activeStreamingSpeaker.stop();
  }
  activeStreamingSpeaker = speakerRef;
  // runQueue closes over speakerRef (not the literal) so identity checks hold.
  speakerRef.stop = speaker.stop;
  speakerRef.pushText = speaker.pushText;
  speakerRef.close = speaker.close;
  runQueue().catch(() => {
    if (generation === speechGeneration) cb.onError?.();
  });

  return speaker;
}
