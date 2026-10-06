import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Clipboard,
  Share,
  Modal,
  StatusBar,
  Animated,
  useWindowDimensions,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { NebulaVoiceOrb } from '../components/chat/NebulaVoiceOrb';
import { ChatDrawer } from '../components/chat/ChatDrawer';
import { PressableScale } from '../components/PressableScale';
import { FadeInView } from '../components/FadeInView';
import { useDictation } from '../services/stt';
import { primeWebAudio, unlockWebAudio } from '../services/tts';
import {
  HospitalCard,
  MedicationCard,
  SavingsCard,
  SchemeCard,
  VitalsCard,
  EmergencyCard,
  CaregiverEscalationCard,
  ReminderCard,
} from '../components/chat/ToolCards';
import { useAgoraVoice } from '../services/voice';
import { triggerEmergency } from '../services/api';
import { useApp } from '../context/AppContext';
import { colors, radius, sans } from '../theme';

export default function TalkScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { lang, tf, t, userName } = useApp();
  const { width } = useWindowDimensions();

  const {
    state,
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
  } = useAgoraVoice();

  /**
   * Voice-loop mode: when no RTC engine is available (Expo Go / dev build
   * pending), the session itself becomes the duplex-lite pipeline — the orb
   * call auto-listens, transcribes, answers with server TTS, and re-listens.
   */
  const isVoiceLoop = sessionMode === 'loop';
  const voiceTurnRef = useRef(false);
  const voiceTurnLiveRef = useRef(false);
  const silenceTimer = useRef<any>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const inputTextRef = useRef('');
  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});
  const [attachSheetVisible, setAttachSheetVisible] = useState(false);
  const [attachedDoc, setAttachedDoc] = useState<{
    name: string;
    type: 'image' | 'file';
    uri?: string;
    base64?: string | null;
  } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const [viewportH, setViewportH] = useState(0);
  const typingRef = useRef<any>(null);
  const [dictNotice, setDictNotice] = useState<string | null>(null);
  const dictNoticeTimer = useRef<any>(null);
  const dictationPulse = useRef(new Animated.Value(1)).current;
  // Live mic level from local capture — feeds the orb when no RTC metering exists
  const [captureLevel, setCaptureLevel] = useState(0);

  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isActive = state !== 'idle';
  const hasMessages = messages.length > 0;

  // Safe area top padding so header never overlaps Android notification bar
  const headerTopPad = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  );

  // Orb sizes: big while idle/home, smaller once the transcript starts.
  const orbBig = Math.max(150, Math.min(width * 0.62, 250));
  const orbDock = Math.max(110, Math.min(width * 0.42, 168));

  useEffect(() => {
    if (!hasMessages) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages, pushedCard, state, hasMessages]);

  // --- Real speech-to-text dictation (backend Whisper on native, browser SR on web) ---
  const commitVoiceTurn = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    if (!voiceTurnRef.current) return;
    voiceTurnRef.current = false;
    voiceTurnLiveRef.current = false;
    const spoken = inputTextRef.current.trim();
    setInputText('');
    if (spoken) sendVoiceQuery(spoken, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, sendVoiceQuery]);

  const showDictationResult = useCallback((text: string, isLive: boolean) => {
    // Voice-turn capture: preview the transcript, then auto-commit.
    if (voiceTurnRef.current) {
      inputTextRef.current = text;
      setInputText(text);
      if (isLive) {
        // Web SpeechRecognition streams interim results — commit after a
        // short silence so hands-free turns still send.
        voiceTurnLiveRef.current = true;
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(commitVoiceTurn, 1500);
        return;
      }
      // Native final transcript — commit immediately.
      commitVoiceTurn();
      return;
    }
    if (isLive) {
      // Web SpeechRecognition streams interim results — mirror them directly.
      inputTextRef.current = text;
      setInputText(text);
      return;
    }
    // Native final transcript — type it into the input with a typewriter animation.
    if (typingRef.current) clearInterval(typingRef.current);
    let idx = 0;
    setInputText('');
    typingRef.current = setInterval(() => {
      if (idx < text.length) {
        idx += 1;
        setInputText(text.slice(0, idx));
      } else {
        clearInterval(typingRef.current);
        typingRef.current = null;
      }
    }, 24);
  }, [commitVoiceTurn]);

  const dictation = useDictation(lang, showDictationResult, { onLevel: setCaptureLevel });
  const isDictating = dictation.phase !== 'idle';
  const effectiveAudioLevel = Math.max(audioLevel, isDictating ? captureLevel : 0);

  useEffect(() => {
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (dictNoticeTimer.current) clearTimeout(dictNoticeTimer.current);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      dictation.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local capture ended → clear the meter level.
  useEffect(() => {
    if (!isDictating) setCaptureLevel(0);
  }, [isDictating]);

  // Auto-listen in voice-loop mode: whenever Sahara finishes speaking, start
  // capturing the caller's next turn automatically (hands-free duplex-lite).
  // The composer-mic mute acts as the kill-switch: muted → no auto-capture.
  useEffect(() => {
    if (!isVoiceLoop || state !== 'listening' || muted) return;
    if (dictation.phase !== 'idle') return;
    const id = setTimeout(() => {
      if (typingRef.current) {
        clearInterval(typingRef.current);
        typingRef.current = null;
      }
      voiceTurnRef.current = true;
      dictation.setVoiceTurn(true);
      setInputText('');
      dictation.start();
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVoiceLoop, state, muted, dictation.phase]);

  // Mic muted (or call ended) → cancel any active voice-turn capture.
  useEffect(() => {
    if ((muted || state === 'idle') && dictation.phase !== 'idle') {
      voiceTurnRef.current = false;
      voiceTurnLiveRef.current = false;
      dictation.setVoiceTurn(false);
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = null;
      }
      dictation.cancel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, state, dictation.phase]);

  // Surface dictation errors as a transient notice in the composer.
  useEffect(() => {
    if (!dictation.error) return;
    setDictNotice(dictation.error);
    if (dictNoticeTimer.current) clearTimeout(dictNoticeTimer.current);
    dictNoticeTimer.current = setTimeout(() => setDictNotice(null), 4000);
  }, [dictation.error]);

  // Gentle pulse on the composer mic while the Agora session is live and unmuted.
  useEffect(() => {
    const micLive = (state !== 'idle') && !muted;
    if (!micLive) {
      dictationPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dictationPulse, { toValue: 1.22, duration: 620, useNativeDriver: true }),
        Animated.timing(dictationPulse, { toValue: 1, duration: 620, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, muted, dictationPulse]);

  const handleSOS = () => {
    const ch = channelName || `emergency-${Date.now()}`;
    triggerEmergency(ch, 'मरीज़ ने सहायता के लिए SOS बटन दबाया').catch(() => {});
    nav.navigate('Emergency', { channel: ch });
  };

  const handleSendText = (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query && !attachedDoc) return;
    if (typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    voiceTurnRef.current = false;
    if (dictation.phase !== 'idle') {
      dictation.stop();
    }
    const finalMsg = attachedDoc
      ? `[संलग्न ${attachedDoc.type === 'image' ? 'तस्वीर' : 'दस्तावेज़'}: ${attachedDoc.name}] ${
          query || (lang === 'hi' ? 'कृपया इस पर्चे / रिपोर्ट की जाँच करें' : 'Please check this attached document/image')
        }`
      : query;
    setInputText('');
    inputTextRef.current = '';
    setAttachedDoc(null);
    sendVoiceQuery(finalMsg, lang);
  };

  /**
   * Composer mic button:
   * - During active voice call (isActive): toggles caller mute/unmute
   * - In chat mode:
   *   - If dictating: stops dictation and commits the voice turn immediately
   *   - If idle: unlocks web audio, immediately requests mic permission with 0ms delay,
   *     and streams live speech into the input box, auto-committing on silence
   */
  const handleMicButton = () => {
    if (typingRef.current) {
      clearInterval(typingRef.current);
      typingRef.current = null;
    }
    if (isSpeaking) stopSpeaking();

    // If an orb voice call is live, mic button acts as mute/unmute
    if (isActive) {
      toggleMute();
      return;
    }

    // Composer dictation mode
    if (isDictating) {
      dictation.stop();
      commitVoiceTurn();
    } else {
      unlockWebAudio();
      primeWebAudio();
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
        }).catch(() => {});
      }
      voiceTurnRef.current = true;
      dictation.setVoiceTurn(true);
      setInputText('');
      inputTextRef.current = '';
      dictation.start();
    }
  };

  const handleSelectAttachment = async (type: 'camera' | 'photos' | 'files') => {
    setAttachSheetVisible(false);
    try {
      if (type === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          return;
        }
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          const asset = res.assets[0];
          setAttachedDoc({
            name: asset.fileName || (lang === 'hi' ? 'कैमरा_फ़ोटो.jpg' : 'camera_photo.jpg'),
            type: 'image',
            uri: asset.uri,
            base64: asset.base64,
          });
        }
      } else if (type === 'photos') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          const asset = res.assets[0];
          setAttachedDoc({
            name: asset.fileName || (lang === 'hi' ? 'गैलरी_फ़ोटो.jpg' : 'gallery_image.jpg'),
            type: 'image',
            uri: asset.uri,
            base64: asset.base64,
          });
        }
      } else if (type === 'files') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.8,
          base64: true,
        });
        if (!res.canceled && res.assets && res.assets[0]) {
          const asset = res.assets[0];
          setAttachedDoc({
            name: asset.fileName || (lang === 'hi' ? 'दस्तावेज़.pdf' : 'document.pdf'),
            type: 'file',
            uri: asset.uri,
            base64: asset.base64,
          });
        }
      }
    } catch (e) {
      console.warn('ImagePicker attachment error:', e);
    }
  };

  const handleNewChat = () => {
    setDrawerOpen(false);
    setInputText('');
    setAttachedDoc(null);
    setCopiedId(null);
    newChat();
  };

  const copy = (text: string, id: string) => {
    Clipboard.setString(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const suggestions = [
    { label: t('chat_sugg_1'), query: t('qp_meds_query') },
    { label: t('chat_sugg_2'), query: t('qp_clinic_query') },
    { label: t('chat_sugg_3'), query: t('qp_savings_query') },
  ];

  const orb = (size: number) => (
    <NebulaVoiceOrb
      size={size}
      active={isActive}
      speaking={isSpeaking}
      state={state}
      audioLevel={effectiveAudioLevel}
      onClick={() => toggleSession(lang)}
    />
  );

  return (
    <View style={s.root}>
      <ChatDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectPrompt={(p) => handleSendText(p)}
        onNavigateScreen={(screen) => nav.navigate(screen)}
        onNewChat={handleNewChat}
        activeSessionId={sessionId}
        onSelectSession={(id) => {
          setDrawerOpen(false);
          loadSession(id);
        }}
      />

      {/* Header - safe area padded so it never collides with Android status bar */}
      <View style={[s.header, { paddingTop: headerTopPad + 6, height: 58 + headerTopPad }]}>
        <Pressable
          style={s.circleBtn}
          onPress={() => setDrawerOpen(true)}
          accessibilityLabel={t('a11y_menu')}
        >
          <Icon name="menu" set="feather" size={20} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1 }} />

        <PressableScale style={s.sosPill} onPress={handleSOS} accessibilityLabel="Emergency SOS">
          <AppText variant="small" weight="bold" color={colors.danger} style={{ fontSize: 12 }}>
            SOS
          </AppText>
        </PressableScale>

        <Pressable
          style={s.circleBtn}
          onPress={() => nav.navigate('Profile')}
          accessibilityLabel={t('a11y_settings')}
        >
          <Icon name="sliders" set="feather" size={20} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {hasMessages ? (
          <ScrollView
            ref={scrollRef}
            style={s.chat}
            contentContainerStyle={s.chatContent}
            showsVerticalScrollIndicator={false}
            onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((m, idx) => {
              const isUser = m.sender === 'user';
              const isLatestAgent =
                !isUser &&
                idx ===
                  messages.map((item, i) => (item.sender === 'agent' ? i : -1)).filter((i) => i !== -1).pop();

              if (isUser) {
                return (
                  <FadeInView key={m.id} style={s.userRow}>
                    <View style={s.userBubble}>
                      <AppText variant="body" color={colors.bubbleUserText} style={{ lineHeight: 24 }}>
                        {m.text}
                      </AppText>
                    </View>
                  </FadeInView>
                );
              }

              return (
                <FadeInView key={m.id} style={s.assistantBlock}>
                  <AppText variant="body" color={colors.text} style={{ fontSize: 20, lineHeight: 29 }}>
                    {m.text}
                  </AppText>

                  {(() => {
                    const cardToShow = m.card || (isLatestAgent ? pushedCard : null);
                    if (!cardToShow) return null;
                    return (
                      <View style={{ marginTop: 10 }}>
                        {cardToShow.type === 'facility' && (
                          <HospitalCard
                            title={cardToShow.title}
                            subtitle={cardToShow.subtitle}
                            doctor={cardToShow.data?.doctor}
                            phone={cardToShow.data?.phone}
                            directionsUrl={cardToShow.data?.directions_url}
                            staticMapUrl={cardToShow.data?.static_map_url}
                            latitude={cardToShow.data?.latitude}
                            longitude={cardToShow.data?.longitude}
                            address={cardToShow.data?.address}
                            travelTime={cardToShow.data?.travel_time}
                            distanceKm={cardToShow.data?.distance_km}
                            onCall108={handleSOS}
                          />
                        )}
                        {cardToShow.type === 'medicine' && (
                          <MedicationCard name={cardToShow.title} timing={cardToShow.subtitle} genericSavings={cardToShow.data?.savings} />
                        )}
                        {cardToShow.type === 'savings' && (
                          <SavingsCard
                            title={cardToShow.title}
                            subtitle={cardToShow.subtitle}
                            savingsPercent={cardToShow.data?.savings_percentage}
                            brandPrice={cardToShow.data?.branded_price}
                            genericPrice={cardToShow.data?.generic_price}
                            genericName={cardToShow.data?.generic_name}
                            findStoreUrl={cardToShow.data?.find_store_url}
                          />
                        )}
                        {cardToShow.type === 'scheme' && (
                          <SchemeCard
                            scheme={cardToShow.data?.scheme || cardToShow.title}
                            summary={cardToShow.data?.summary || cardToShow.subtitle}
                            coverageAmount={cardToShow.data?.coverage_amount}
                            benefits={cardToShow.data?.benefits}
                            eligibility={cardToShow.data?.eligibility}
                            helpline={cardToShow.data?.helpline}
                            portalUrl={cardToShow.data?.portal_url}
                          />
                        )}
                        {cardToShow.type === 'vitals' && (
                          <VitalsCard
                            bp={cardToShow.data?.bp || '120/80'}
                            sugar={cardToShow.data?.sugar || '110'}
                            pulse={cardToShow.data?.pulse || '72'}
                            spo2={cardToShow.data?.spo2 || '98'}
                            status={cardToShow.data?.interpretation || cardToShow.subtitle}
                          />
                        )}
                        {cardToShow.type === 'emergency' && (
                          <EmergencyCard
                            title={cardToShow.title}
                            description={cardToShow.subtitle}
                            onOpenSOS={handleSOS}
                            onCall108={() => Linking.openURL('tel:108').catch(() => {})}
                          />
                        )}
                        {cardToShow.type === 'caregiver' && (
                          <CaregiverEscalationCard
                            caregiver={cardToShow.data?.caregiver || cardToShow.title}
                            phone={cardToShow.data?.phone}
                            reason={cardToShow.data?.reason}
                            urgency={cardToShow.data?.urgency}
                            whatsappUrl={cardToShow.data?.whatsapp_url}
                            callUrl={cardToShow.data?.call_url}
                          />
                        )}
                        {cardToShow.type === 'reminder' && (
                          <ReminderCard
                            title={cardToShow.data?.title || cardToShow.title}
                            time={cardToShow.data?.time || cardToShow.subtitle}
                            formattedTime={cardToShow.data?.formatted_time}
                            active={cardToShow.data?.active ?? true}
                          />
                        )}
                      </View>
                    );
                  })()}

                  {/* ChatGPT-style action row */}
                  <View style={s.actionRow}>
                    <Pressable style={s.actionBtn} onPress={() => copy(m.text, m.id)} accessibilityLabel={t('talk_copy')}>
                      <Icon name={copiedId === m.id ? 'check' : 'copy'} set="feather" size={16} color={copiedId === m.id ? colors.brand : colors.textMuted} />
                    </Pressable>
                    <Pressable
                      style={s.actionBtn}
                      onPress={() => (currentlySpeakingId === m.id ? stopSpeaking() : speakText(m.text, lang, m.id))}
                      accessibilityLabel={currentlySpeakingId === m.id ? 'Stop reading' : t('talk_speak')}
                    >
                      <Icon
                        name={currentlySpeakingId === m.id ? 'volume-x' : 'volume-2'}
                        set="feather"
                        size={16}
                        color={currentlySpeakingId === m.id ? colors.brand : colors.textMuted}
                      />
                    </Pressable>
                    <Pressable
                      style={s.actionBtn}
                      onPress={() => setFeedback((prev) => ({ ...prev, [m.id]: prev[m.id] === 'up' ? undefined : ('up' as any) }))}
                      accessibilityLabel="Good response"
                    >
                      <Icon name="thumbs-up" set="feather" size={16} color={feedback[m.id] === 'up' ? colors.brand : colors.textMuted} />
                    </Pressable>
                    <Pressable
                      style={s.actionBtn}
                      onPress={() => setFeedback((prev) => ({ ...prev, [m.id]: prev[m.id] === 'down' ? undefined : ('down' as any) }))}
                      accessibilityLabel="Poor response"
                    >
                      <Icon name="thumbs-down" set="feather" size={16} color={feedback[m.id] === 'down' ? colors.danger : colors.textMuted} />
                    </Pressable>
                    <Pressable
                      style={s.actionBtn}
                      onPress={() => Share.share({ message: m.text }).catch(() => {})}
                      accessibilityLabel="Share"
                    >
                      <Icon name="share-2" set="feather" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </FadeInView>
              );
            })}
          </ScrollView>
        ) : (
          <View style={s.home}>
            {/* Dynamic AI State Pill */}
            <View style={s.statusPill}>
              <View
                style={[
                  s.statusDot,
                  isSpeaking && s.statusDotSpeaking,
                  isActive && !isSpeaking && s.statusDotListening,
                ]}
              />
              <AppText
                variant="small"
                weight="bold"
                color={isSpeaking ? '#38BDF8' : isActive ? '#34D399' : '#94A3B8'}
              >
                {isSpeaking
                  ? lang === 'hi'
                    ? 'सहारा बोल रहा है...'
                    : 'Sahara is speaking...'
                  : isThinking
                  ? lang === 'hi'
                    ? 'सोच रहा हूँ...'
                    : 'Thinking...'
                  : muted
                  ? lang === 'hi'
                    ? 'माइक बंद है · चालू करने के लिए माइक दबाएँ'
                    : 'Mic is off · tap the mic to unmute'
                  : isActive
                  ? isVoiceLoop
                    ? lang === 'hi'
                      ? 'सुन रहा हूँ… बोलिए'
                      : 'Listening… speak now'
                    : Platform.OS !== 'web'
                    ? lang === 'hi'
                      ? 'कॉल चालू है · बोलिए'
                      : 'Call is live · speak now'
                    : lang === 'hi'
                    ? 'आपकी बात सुनी जा रही है...'
                    : 'Listening to you...'
                  : lang === 'hi'
                  ? 'सहारा तैयार है · बोलकर कुछ भी पूछें'
                  : 'Sahara is ready · Speak naturally'}
              </AppText>
            </View>

            <View style={s.orbCenter}>{orb(orbBig)}</View>

            <View style={s.suggestWrap}>
              <AppText
                variant="h1"
                weight="bold"
                color={colors.text}
                style={{ marginBottom: 12, fontFamily: sans.bold, fontSize: 24 }}
              >
                {userName
                  ? tf('chat_home_welcome', { name: userName })
                  : t('chat_home_welcome_noname')}
              </AppText>
              <View style={{ gap: 8 }}>
                {suggestions.map((row) => (
                  <PressableScale
                    key={row.label}
                    style={s.suggestionCard}
                    onPress={() => handleSendText(row.query)}
                    accessibilityRole="button"
                    accessibilityLabel={row.label}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <AppText
                        variant="body"
                        weight="medium"
                        color={colors.text}
                        style={{ fontSize: 16, flex: 1 }}
                      >
                        {row.label}
                      </AppText>
                      <Icon name="arrow-up-right" set="feather" size={16} color="#34D399" />
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Orb dock — tap to connect or disconnect voice call */}
        {hasMessages && <View style={s.orbDock}>{orb(orbDock)}</View>}

        {/* Attached Document Preview Chip — ChatGPT Style */}
        {attachedDoc && (
          <View style={s.attachedChipRow}>
            <View style={s.attachedCard}>
              {attachedDoc.uri && attachedDoc.type === 'image' ? (
                <Image source={{ uri: attachedDoc.uri }} style={s.attachedThumb} />
              ) : (
                <View style={s.attachedFileIcon}>
                  <Icon name="file-text" size={20} color="#34D399" />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 6 }}>
                <AppText variant="small" weight="bold" color={colors.text} numberOfLines={1}>
                  {attachedDoc.name}
                </AppText>
                <AppText variant="small" color="#94A3B8" style={{ fontSize: 11 }}>
                  {attachedDoc.type === 'image'
                    ? lang === 'hi' ? 'तस्वीर संलग्न · पूछने के लिए तैयार' : 'Image attached · Ready'
                    : lang === 'hi' ? 'दस्तावेज़ संलग्न' : 'Document attached'}
                </AppText>
              </View>
              {attachedDoc.type === 'image' && (
                <Pressable
                  style={s.attachedScanAction}
                  onPress={() => {
                    nav.navigate('PrescriptionScanner', {
                      initialImage: attachedDoc.uri,
                      initialBase64: attachedDoc.base64,
                    });
                  }}
                >
                  <Icon name="check-square" size={13} color="#38BDF8" />
                  <AppText variant="small" weight="bold" color="#38BDF8" style={{ fontSize: 11 }}>
                    {lang === 'hi' ? 'पर्चा मिलान' : 'Scan Rx'}
                  </AppText>
                </Pressable>
              )}
              <Pressable onPress={() => setAttachedDoc(null)} style={s.attachedRemoveBtn}>
                <Icon name="x" size={16} color="#94A3B8" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Composer Row: Plus (+) | TextInput | Dictation Mic || Dedicated SEND */}
        <View style={s.composerRow}>
          <View style={s.composerPill}>
            {/* Leftmost Plus (+) button for attachments */}
            <Pressable
              style={s.plusBtn}
              onPress={() => setAttachSheetVisible(true)}
              accessibilityLabel="Add attachment or scan"
              accessibilityRole="button"
            >
              <Icon name="plus" set="feather" size={22} color={colors.text} />
            </Pressable>

            {/* Input field */}
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={dictNotice || t('talk_input_placeholder')}
              placeholderTextColor={dictNotice ? colors.danger : colors.textMuted}
              style={[s.input, isDictating && !dictNotice && { color: '#34D399' }]}
              onSubmitEditing={() => handleSendText()}
              returnKeyType="send"
            />

            {/* Inside Right: Voice mic — Dictates when idle, mute/unmute during call */}
            <Pressable
              style={[
                s.micBtnInside,
                (isDictating || (isActive && !muted)) && s.micBtnInsideActive,
                muted && s.micBtnInsideMuted,
              ]}
              onPress={handleMicButton}
              accessibilityLabel={
                isDictating
                  ? (lang === 'hi' ? 'बोलना बंद करें' : 'Stop speaking')
                  : state === 'connecting'
                  ? t('talk_mic_connecting')
                  : state === 'idle'
                  ? t('talk_mic_start')
                  : muted
                  ? t('talk_mic_unmute')
                  : t('talk_mic_muted')
              }
              accessibilityRole="button"
              accessibilityState={{ busy: state === 'connecting' }}
            >
              {(isDictating || (isActive && !muted)) && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.micPulseRing,
                    {
                      transform: [{ scale: dictationPulse }],
                      opacity: dictationPulse.interpolate({
                        inputRange: [1, 1.22],
                        outputRange: [0.75, 0.1],
                      }),
                    },
                  ]}
                />
              )}
              <Icon
                name={muted ? 'mic-off' : 'mic'}
                set="feather"
                size={19}
                color={
                  isDictating
                    ? '#10B981'
                    : state === 'idle'
                    ? colors.text
                    : muted
                    ? colors.danger
                    : '#10B981'
                }
              />
            </Pressable>
          </View>

          {/* Outside Right: Dedicated SEND button */}
          <PressableScale
            style={[
              s.sendBtnRight,
              (inputText.trim().length > 0 || attachedDoc) && s.sendBtnRightActive,
            ]}
            onPress={() => handleSendText()}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Icon
              name="arrow-up"
              set="feather"
              size={22}
              color={inputText.trim().length > 0 || attachedDoc ? '#05070A' : colors.textDim}
            />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Action Sheet Modal — 3 Clean Options: Camera, Photos, Files */}
      <Modal
        visible={attachSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAttachSheetVisible(false)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setAttachSheetVisible(false)}>
          <View style={s.modalSheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <AppText variant="label" weight="bold" color={colors.text} style={{ fontSize: 17 }}>
                {lang === 'hi' ? 'फ़ोटो या फ़ाइल जोड़ें' : 'Attach Photo or Document'}
              </AppText>
              <Pressable onPress={() => setAttachSheetVisible(false)} style={s.sheetCloseBtn}>
                <Icon name="x" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={s.attachGrid}>
              {/* 1. Camera */}
              <Pressable style={s.attachTile} onPress={() => handleSelectAttachment('camera')}>
                <View style={[s.attachIconWrap, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Icon name="camera" size={26} color="#38BDF8" />
                </View>
                <AppText variant="small" weight="bold" color={colors.text} align="center">
                  {lang === 'hi' ? 'कैमरा' : 'Camera'}
                </AppText>
                <AppText variant="small" color={colors.textMuted} align="center" style={{ fontSize: 11 }}>
                  {lang === 'hi' ? 'पर्चा या दवा फ़ोटो' : 'Take photo'}
                </AppText>
              </Pressable>

              {/* 2. Photos */}
              <Pressable style={s.attachTile} onPress={() => handleSelectAttachment('photos')}>
                <View style={[s.attachIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Icon name="image" size={26} color="#C084FC" />
                </View>
                <AppText variant="small" weight="bold" color={colors.text} align="center">
                  {lang === 'hi' ? 'फ़ोटो' : 'Photos'}
                </AppText>
                <AppText variant="small" color={colors.textMuted} align="center" style={{ fontSize: 11 }}>
                  {lang === 'hi' ? 'गैलरी से चुनें' : 'Choose photo'}
                </AppText>
              </Pressable>

              {/* 3. Files */}
              <Pressable style={s.attachTile} onPress={() => handleSelectAttachment('files')}>
                <View style={[s.attachIconWrap, { backgroundColor: 'rgba(52, 211, 153, 0.15)' }]}>
                  <Icon name="file-text" size={26} color="#34D399" />
                </View>
                <AppText variant="small" weight="bold" color={colors.text} align="center">
                  {lang === 'hi' ? 'फ़ाइलें' : 'Files'}
                </AppText>
                <AppText variant="small" color={colors.textMuted} align="center" style={{ fontSize: 11 }}>
                  {lang === 'hi' ? 'PDF या रिपोर्ट' : 'PDF or docs'}
                </AppText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chatBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.iconBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerTint,
    borderWidth: 1,
    borderColor: colors.dangerDeep,
  },
  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
  assistantBlock: { marginBottom: 26 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 12 },
  actionBtn: { padding: 2 },
  userRow: { alignItems: 'flex-end', marginBottom: 18 },
  userBubble: {
    backgroundColor: colors.bubbleUser,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    maxWidth: '80%',
  },
  home: { flex: 1, paddingHorizontal: 18 },
  statusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#94A3B8',
  },
  statusDotSpeaking: {
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  statusDotListening: {
    backgroundColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  orbCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  suggestWrap: { paddingBottom: 10 },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  suggestionCardPressed: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  orbDock: { alignItems: 'center', paddingBottom: 6 },
  attachedChipRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  attachedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  attachedThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  attachedFileIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachedScanAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginRight: 6,
  },
  attachedRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 14,
  },
  composerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.composer,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingLeft: 8,
    paddingRight: 10,
    height: 52,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  plusBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 0, marginLeft: 2 },
  micBtnInside: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnInsideActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  micBtnInsideMuted: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
  },
  micPulseRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  sendBtnRight: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnRightActive: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
    shadowColor: '#34D399',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0D1117',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  attachTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  attachIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
