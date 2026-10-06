import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  getConfig,
  startAgent,
  stopAgent,
  getLatestCard,
  clearLatestCard,
  sendChatMessage,
} from './api';
import { speakNatural, stopNaturalVoice, primeWebAudio, unlockWebAudio, speakNaturalStream } from './tts';
import { ConvState } from '../components/StateBadge';
import { Language } from '../context/AppContext';
import {
  ChatSession,
  saveChatSession,
  getChatSession,
  getActiveSessionId,
  setActiveSessionId,
} from './chatStorage';
import { getItem, setItem } from './storage';
import { loadAgoraNative } from './agoraEngine';
import { loadAgoraWeb } from './agoraWeb';

export interface MessageItem {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
  card?: PushedCard | null;
}

export interface PushedCard {
  type: 'facility' | 'medicine' | 'savings' | 'vitals' | 'emergency' | 'scheme' | 'caregiver' | 'reminder';
  title: string;
  subtitle: string;
  data?: any;
}

/**
 * How the live voice session is running:
 * - 'rtc'  → real Agora duplex call (agent STT→LLM→TTS over RTC, mic is hot,
 *            transcripts arrive over the datastream). The true duplex pipeline.
 * - 'loop' → graceful fallback when no RTC engine is available (e.g. Expo Go,
 *            missing native module, or agent start failure). The UI runs a
 *            capture loop: listen (dictation) → LLM → server TTS → listen again.
 */
export type VoiceSessionMode = 'rtc' | 'loop';

const HISTORY_TURNS = 12; // messages sent to the LLM for context

// Agora RTC SDKs load through platform-split modules so neither the web SDK
// lands in native bundles nor the native SDK in the web bundle.
const AgoraRTC = loadAgoraWeb() as any;

// Stable per-device voice channel so server-side memory keys survive across
// calls (a fresh channel name every call would strand the history).
const VOICE_CHANNEL_KEY = 'sahara.voice_channel';
async function getStableVoiceChannel(): Promise<string> {
  try {
    const existing = await getItem(VOICE_CHANNEL_KEY);
    if (existing) return existing;
    const fresh = `sahara-room-${Math.random().toString(36).slice(2, 10)}`;
    await setItem(VOICE_CHANNEL_KEY, fresh);
    return fresh;
  } catch {
    return `sahara-room-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Profile snapshot (name + caregiver phone from onboarding) sent with each
 * chat turn so a voice-detected emergency dispatches to the real caregiver
 * instead of server-side placeholder contacts.
 */
const USER_NAME_KEY = 'sahara.userName';
const CAREGIVER_PHONE_KEY = 'sahara.caregiverPhone';
async function getProfileContext(): Promise<{ patient?: string; caregiverPhone?: string }> {
  try {
    const [name, phone] = await Promise.all([
      getItem(USER_NAME_KEY),
      getItem(CAREGIVER_PHONE_KEY),
    ]);
    return {
      patient: name || undefined,
      caregiverPhone: phone || undefined,
    };
  } catch {
    return {};
  }
}

/** Convert transcript messages into OpenAI-format history (cards stripped). */
function toHistory(messages: MessageItem[], maxTurns = HISTORY_TURNS) {
  return messages
    .filter((m) => m.text && m.text.trim())
    .slice(-maxTurns)
    .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));
}

export function useAgoraVoice() {
  const [state, setState] = useState<ConvState>('idle');
  const [agentId, setAgentId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => `sess-${Date.now()}`);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [pushedCard, setPushedCard] = useState<PushedCard | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<VoiceSessionMode | null>(null);
  const sessionModeRef = useRef<VoiceSessionMode | null>(null);
  useEffect(() => {
    sessionModeRef.current = sessionMode;
  }, [sessionMode]);
  // Mirrors the local mic's published state on the RTC channel. Toggled by
  // the composer mic button while a session is live.
  const [muted, setMuted] = useState(false);

  // Prevents late backend responses from repopulating freshly cleared sessions
  const generationRef = useRef(0);
  // Live mirror of messages so callbacks (RTC events, TTS onDone) never read a
  // stale closure — this was silently dropping context/memory before.
  const messagesRef = useRef<MessageItem[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const stateRef = useRef<ConvState>('idle');
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Agora RTC Web references
  const agoraClientRef = useRef<any>(null);
  const localMicTrackRef = useRef<any>(null);
  const remoteAudioTrackRef = useRef<any>(null);

  // Agora RTC Native reference
  const nativeEngineRef = useRef<any>(null);
  const volumeIntervalRef = useRef<any>(null);

  // Load last active session on initial mount
  useEffect(() => {
    getActiveSessionId().then(async (actId) => {
      if (actId) {
        const sess = await getChatSession(actId);
        if (sess && sess.messages && sess.messages.length > 0) {
          setSessionId(sess.id);
          setMessages(sess.messages);
        }
      }
    }).catch(() => {});
  }, []);

  // Autosave messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      const firstUserMsg = messages.find((m) => m.sender === 'user');
      const title = firstUserMsg ? firstUserMsg.text.slice(0, 36) : 'स्वास्थ्य बातचीत';
      saveChatSession({
        id: sessionId,
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages,
      }).catch(() => {});
      setActiveSessionId(sessionId).catch(() => {});
    }
  }, [messages, sessionId]);

  // Sync latest pushed card from backend while session is active
  useEffect(() => {
    if (state === 'idle') return;
    const interval = setInterval(async () => {
      try {
        const res = await getLatestCard(channelName || undefined);
        if (res.status === 'success' && res.card) {
          setPushedCard((prev) => {
            if (!prev || prev.title !== res.card.title || prev.subtitle !== res.card.subtitle) {
              return res.card;
            }
            return prev;
          });
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [state, channelName]);

  /**
   * Append (or merge) a transcript line from the duplex datastream.
   * User ASR partials (same sender within 2.5s) replace the previous line
   * instead of piling duplicates; agent lines always append so sentence
   * deltas are not lost.
   */
  const appendTranscript = useCallback((sender: 'user' | 'agent', text: string) => {
    const now = Date.now();
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (sender === 'user' && last && last.sender === 'user' && now - Number(last.timestamp || 0) < 2500) {
        const next = prev.slice();
        next[next.length - 1] = { ...last, text, timestamp: String(now) };
        return next;
      }
      return [
        ...prev,
        {
          id: `stream-${now}-${Math.random().toString(36).slice(2, 7)}`,
          sender,
          text,
          timestamp: String(now),
        },
      ];
    });
  }, []);

  /** Transcript plumbing: user line → thinking, agent line → listening. */
  const handleTranscript = useCallback((role: 'user' | 'agent', text: string) => {
    if (!text || !text.trim()) return;
    appendTranscript(role, text.trim());
    if (role === 'user') {
      setState((curr) => (curr === 'listening' || curr === 'connecting' ? 'thinking' : curr));
    } else {
      setState((curr) => (curr === 'thinking' ? 'speaking' : curr));
    }
  }, [appendTranscript]);

  const startVolumeMonitoring = useCallback(() => {
    if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
    volumeIntervalRef.current = setInterval(() => {
      let level = 0;
      let remoteActive = false;
      if (remoteAudioTrackRef.current) {
        const rVol = remoteAudioTrackRef.current.getVolumeLevel?.() || 0;
        if (rVol > 0.04) {
          remoteActive = true;
          level = Math.max(level, rVol);
        }
      }
      if (localMicTrackRef.current) {
        const lVol = localMicTrackRef.current.getVolumeLevel?.() || 0;
        if (lVol > 0.05) {
          level = Math.max(level, lVol);
        }
      }
      setAudioLevel(level);
      if (remoteActive && stateRef.current !== 'speaking') setState('speaking');
      else if (!remoteActive && stateRef.current === 'speaking') setState('listening');
    }, 100);
  }, []);

  const stopVolumeMonitoring = useCallback(() => {
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const stopSpeaking = useCallback(() => {
    stopNaturalVoice();
    setCurrentlySpeakingId(null);
  }, []);

  const speakText = useCallback(
    (text: string, lang: Language = 'hi', messageId?: string, onDone?: () => void) => {
      stopSpeaking();
      if (messageId) setCurrentlySpeakingId(messageId);

      speakNatural(text, lang, {
        onDone: () => {
          setCurrentlySpeakingId((curr) => (curr === messageId ? null : curr));
          if (onDone) onDone();
        },
        onError: () => {
          setCurrentlySpeakingId((curr) => (curr === messageId ? null : curr));
        },
      });
    },
    [stopSpeaking],
  );

  const teardownRtc = useCallback(() => {
    stopVolumeMonitoring();

    if (nativeEngineRef.current) {
      try {
        nativeEngineRef.current.leaveChannel();
        nativeEngineRef.current.release();
      } catch {}
      nativeEngineRef.current = null;
    }
    if (localMicTrackRef.current) {
      try {
        localMicTrackRef.current.close();
      } catch {}
      localMicTrackRef.current = null;
    }
    if (agoraClientRef.current) {
      try {
        agoraClientRef.current.leave();
      } catch {}
      agoraClientRef.current = null;
    }
    remoteAudioTrackRef.current = null;
  }, [stopVolumeMonitoring]);

  const startSession = async (lang: Language = 'hi') => {
    stopSpeaking();
    if (Platform.OS === 'web') {
      primeWebAudio();
      unlockWebAudio();
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
        }).catch(() => {});
      }
    }
    setState('connecting');
    // A fresh call always starts with a hot mic.
    setMuted(false);

    try {
      // 0. Stable channel → server-side memory keys survive across calls
      const stableChannel = await getStableVoiceChannel();
      setChannelName(stableChannel);

      // Web experience: Instant Murf Voice Call Loop with hands-free STT + Murf TTS + Companion Cards
      if (Platform.OS === 'web') {
        setSessionMode('loop');
        // Greet only when the conversation is actually new — reconnecting to
        // an existing chat must not re-append the greeting every orb tap.
        const isFreshConversation = messagesRef.current.length === 0;
        if (isFreshConversation) {
          const greeting =
            lang === 'hi'
              ? 'नमस्ते! मैं सहारा हूँ। बताइए, आज आप कैसा महसूस कर रहे हैं?'
              : 'Hello! I am Sahara. How can I help you today?';
          appendTranscript('agent', greeting);
          setState('speaking');
          speakNatural(greeting, lang, {
            onDone: () => setState((curr) => (curr === 'speaking' ? 'listening' : curr)),
            onError: () => setState((curr) => (curr === 'speaking' ? 'listening' : curr)),
          });
        } else {
          // Resuming a live conversation: straight to listening, no re-greeting.
          setState('listening');
        }
        return;
      }

      // 1. Fetch Agora tokens & channel configuration from backend
      const config = await getConfig({ channel: stableChannel });
      const ch = config.channel_name;
      const userUid = Number(config.uid) || Math.floor(Math.random() * 900000) + 100000;
      const agentRtcUid = Number(config.agent_uid) || Math.floor(Math.random() * 900000) + 100000;

      setChannelName(ch);

      // 2. Start Agora Cloud Conversational AI Agent, carrying the recent
      //    conversation so the fresh agent session remembers prior calls.
      const context = toHistory(messagesRef.current, 10);
      const res = await startAgent(ch, agentRtcUid, userUid, undefined, lang, context);
      if (res?.agent_id) {
        setAgentId(res.agent_id);
      }

      // 3. Connect via react-native-agora on Native if the native engine is linked
      const agoraNative = loadAgoraNative();
      if (agoraNative) {
        try {
          const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = agoraNative;
          const engine = createAgoraRtcEngine();
          nativeEngineRef.current = engine;
          engine.initialize({ appId: config.app_id });
          engine.enableAudio();
          engine.setChannelProfile(ChannelProfileType?.ChannelProfileLiveBroadcasting ?? 1);
          engine.setClientRole(ClientRoleType?.ClientRoleBroadcaster ?? 1);

          engine.registerEventHandler({
            onJoinChannelSuccess: () => {
              setSessionMode('rtc');
              setState('listening');
            },
            onUserJoined: (_conn: any, remoteUid: number) => {
              if (remoteUid === agentRtcUid) {
                setSessionMode('rtc');
                setState('listening');
              }
            },
            onStreamMessage: (_conn: any, uid: number, _streamId: number, data: Uint8Array) => {
              try {
                // Agent transcripts arrive with the agent's RTC uid; tolerate
                // missing role markers by trusting the uid first.
                let parsed: any = {};
                try {
                  parsed = JSON.parse(new TextDecoder('utf-8').decode(data));
                } catch {
                  return;
                }
                const content = parsed.text || parsed.content || '';
                if (!content) return;
                const role: 'user' | 'agent' = parsed.role
                  ? parsed.role === 'user'
                    ? 'user'
                    : 'agent'
                  : uid === agentRtcUid
                  ? 'agent'
                  : 'user';
                handleTranscript(role, content);
              } catch {}
            },
            onAudioVolumeIndication: (_conn: any, speakers: any[]) => {
              if (speakers && speakers.length > 0) {
                const maxVol = Math.max(...speakers.map((s) => s.volume || 0));
                setAudioLevel(maxVol / 255);
              }
            },
          });

          engine.enableAudioVolumeIndication(200, 3, true);
          engine.joinChannel(config.token, ch, userUid, {
            clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
          });

          setSessionMode('rtc');
          setState('listening');
          return;
        } catch (nativeErr) {
          console.warn('Native Agora RTC connection note:', nativeErr);
          teardownRtc();
        }
      }


      // 5. Voice-loop fallback — no RTC engine available (Expo Go / dev-build
      //    pending / agent start failed). Still a real STT → LLM → TTS
      //    pipeline: the UI auto-listens and routes through sendVoiceQuery.
      setSessionMode('loop');
      if (messagesRef.current.length === 0) {
        const greeting =
          lang === 'hi'
            ? 'नमस्ते! मैं सहारा हूँ। बताइए, आज आप कैसा महसूस कर रहे हैं?'
            : 'Hello! I am Sahara. How can I help you today?';
        appendTranscript('agent', greeting);
        setState('speaking');
        speakNatural(greeting, lang, {
          onDone: () => setState((curr) => (curr === 'speaking' ? 'listening' : curr)),
          onError: () => setState((curr) => (curr === 'speaking' ? 'listening' : curr)),
        });
      } else {
        setState('listening');
      }
    } catch (err: any) {
      console.warn('Agora agent network connection notice:', err);
      // Total failure (no backend at all) → still run the local voice loop so
      // the orb call is never a dead end.
      setSessionMode('loop');
      setState('listening');
    }
  };

  const endSession = async (_lang: Language = 'hi') => {
    stopSpeaking();
    teardownRtc();

    if (agentId) {
      stopAgent(agentId).catch(() => {});
    }
    setAgentId(null);
    setSessionMode(null);
    setState('idle');
    setMuted(false);
  };

  /**
   * Composer mic button action while a session is live:
   * - RTC native → engine.muteLocalAudioStream
   * - RTC web → micTrack.setEnabled
   * - voice loop → the loop's mic IS the dictation capture; expose muted as
   *   the TalkScreen's kill-switch for its auto-listen effect (it checks
   *   `muted` before starting a capture turn).
   */
  const toggleMute = useCallback((): boolean => {
    const next = !muted;
    if (sessionMode === 'rtc') {
      if (nativeEngineRef.current?.muteLocalAudioStream) {
        try {
          nativeEngineRef.current.muteLocalAudioStream(next);
        } catch (err) {
          console.warn('muteLocalAudioStream failed:', err);
        }
      }
      if (localMicTrackRef.current?.setEnabled) {
        try {
          localMicTrackRef.current.setEnabled(!next);
        } catch (err) {
          console.warn('mic track setEnabled failed:', err);
        }
      }
    }
    setMuted(next);
    return next;
  }, [muted, sessionMode]);

  const toggleSession = (lang: Language = 'hi') => {
    if (state === 'idle') {
      startSession(lang);
    } else {
      endSession(lang);
    }
  };

  const newChat = () => {
    generationRef.current += 1;
    stopSpeaking();
    teardownRtc();
    if (agentId) {
      stopAgent(agentId).catch(() => {});
    }

    clearLatestCard(channelName || undefined);
    setAgentId(null);
    setChannelName(null);
    setMessages([]);
    setPushedCard(null);
    setAudioLevel(0);
    setSessionMode(null);
    setState('idle');
    setMuted(false);

    const newId = `sess-${Date.now()}`;
    setSessionId(newId);
    setActiveSessionId(newId).catch(() => {});
  };

  const loadSession = async (loadId: string) => {
    stopSpeaking();
    const sess = await getChatSession(loadId);
    if (sess) {
      setSessionId(sess.id);
      setActiveSessionId(sess.id).catch(() => {});
      setMessages(sess.messages || []);
      setPushedCard(null);
    }
  };

  const sendVoiceQuery = async (queryText: string, lang: Language = 'hi') => {
    const gen = generationRef.current;
    const trimmed = queryText.trim();
    if (!trimmed) return;

    // Ensure stable channel for memory keys across calls
    let ch = channelName;
    if (!ch) {
      try {
        const stableChannel = await getStableVoiceChannel();
        ch = stableChannel;
        setChannelName(ch);
      } catch {}
    }

    // Snapshot history from the live ref — never a stale closure.
    const history = toHistory(messagesRef.current);
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: String(Date.now()),
    };
    const agentMsgId = `agent-${Date.now()}`;
    const agentMsg: MessageItem = {
      id: agentMsgId,
      sender: 'agent',
      text: '',
      timestamp: String(Date.now()),
    };
    setMessages([...messagesRef.current, userMsg, agentMsg]);
    setState('thinking');

    try {
      // Live-caption streaming: as LLM deltas arrive they grow the agent
      // bubble in place, and sentences start playing on Murf immediately.
      const speaker = speakNaturalStream(lang, {
        onChunk: () => {},
        onDone: () => {
          setCurrentlySpeakingId((curr) => (curr === agentMsgId ? null : curr));
          setState((curr) => {
            if (curr !== 'speaking') return curr;
            return sessionModeRef.current === 'loop' ? 'listening' : 'idle';
          });
        },
        onError: () => {
          setCurrentlySpeakingId((curr) => (curr === agentMsgId ? null : curr));
        },
      });
      setCurrentlySpeakingId(agentMsgId);

      let liveReply = '';
      const chatRes = await sendChatMessage(
        trimmed,
        ch || 'default',
        lang,
        history,
        await getProfileContext(),
        {
          onDelta: (delta) => {
            if (gen !== generationRef.current) return;
            liveReply += delta;
            speaker.pushText(delta);
            // Live caption: grow the agent bubble in place as text streams.
            setMessages((prev) =>
              prev.map((m) => (m.id === agentMsgId ? { ...m, text: liveReply } : m)),
            );
          },
        },
      );
      speaker.close();
      if (gen !== generationRef.current) {
        speaker.stop();
        return;
      }
      // (gen guard also applies inside onDelta above — a newer turn silently
      // discards this turn's remaining deltas.)

      let reply = chatRes.text || liveReply;
      const turnCard = chatRes.card || null;

      setPushedCard(turnCard);
      if (turnCard?.type === 'emergency') {
        setState('emergency');
      }

      if (!reply) {
        reply = lang === 'hi'
          ? 'माफ़ कीजिए, अभी सर्वर से संपर्क नहीं हो पा रहा है। कृपया एक बार दोबारा पूछें।'
          : 'I am unable to reach the server right now. Please ask again in a moment.';
        setMessages((prev) => prev.map((m) => (m.id === agentMsgId ? { ...m, text: reply } : m)));
        // Offline fallback still speaks — with the device voice if Murf is down.
        speakText(reply, lang, agentMsgId, () => {
          setState((curr) => {
            if (curr !== 'speaking') return curr;
            return sessionModeRef.current === 'loop' ? 'listening' : 'idle';
          });
        });
      } else {
        // Final text (authoritative, may differ in whitespace from stream).
        setMessages((prev) => prev.map((m) => (m.id === agentMsgId ? { ...m, text: reply, card: turnCard } : m)));
      }
      setState('speaking');
    } catch (err) {
      console.warn('sendVoiceQuery error:', err);
      setCurrentlySpeakingId(null);
      if (stateRef.current === 'thinking' || stateRef.current === 'speaking') {
        setState(sessionModeRef.current === 'loop' ? 'listening' : 'idle');
      }
    }
  };

  return {
    state,
    agentId,
    channelName,
    sessionId,
    messages,
    pushedCard,
    audioLevel,
    currentlySpeakingId,
    sessionMode,
    muted,
    toggleSession,
    toggleMute,
    sendVoiceQuery,
    speakText,
    stopSpeaking,
    newChat,
    loadSession,
  };
}
