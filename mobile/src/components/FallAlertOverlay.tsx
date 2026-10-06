import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Animated } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, space } from '../theme';
import { useApp } from '../context/AppContext';
import { speakNatural, stopNaturalVoice } from '../services/tts';
import { useFallDetection } from '../services/fallDetection';
import { triggerEmergency } from '../services/api';

const VOICE_OK_HI = 'क्या आप ठीक हैं? सहारा यहाँ है। ठीक हैं तो ठीक हैं दबाइए।';
const VOICE_OK_EN = 'Are you okay? Sahara is here. If you are okay, press I am okay.';

// Escalate after this much silence following the fall.
const ESCALATE_AFTER_MS = 30000;

export function FallAlertOverlay({ channelName }: { channelName: string | null }) {
  const { lang, userName, caregiverPhone } = useApp();
  const [visible, setVisible] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [countdown, setCountdown] = useState(ESCALATE_AFTER_MS / 1000);
  const escalateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const clearTimers = () => {
    if (escalateTimer.current) {
      clearInterval(escalateTimer.current);
      escalateTimer.current = null;
    }
  };

  const askByVoice = () => {
    speakNatural(lang === 'hi' ? VOICE_OK_HI : VOICE_OK_EN, lang, {});
  };

  // The fall handler: show overlay + ask by voice.
  const handleFall = () => {
    if (visible) return; // already in a fall cycle
    setVisible(true);
    setEscalating(false);
    setCountdown(ESCALATE_AFTER_MS / 1000);
    askByVoice();
    // Re-ask every 10s while unanswered, escalate after ESCALATE_AFTER_MS.
    let elapsed = 0;
    clearTimers();
    escalateTimer.current = setInterval(() => {
      elapsed += 1000;
      setCountdown(Math.max(0, Math.ceil((ESCALATE_AFTER_MS - elapsed) / 1000)));
      if (elapsed % 10000 === 0 && elapsed < ESCALATE_AFTER_MS) askByVoice();
      if (elapsed >= ESCALATE_AFTER_MS) {
        clearTimers();
        handleEscalate();
      }
    }, 1000);
  };

  const handleEscalate = () => {
    setEscalating(true);
    stopNaturalVoice();
    const ch = channelName || `fall-${Date.now()}`;
    const patient = userName || 'मरीज़';
    triggerEmergency(
      ch,
      lang === 'hi'
        ? 'गिरने की घटना — वॉइस पूछा पर उत्तर नहीं मिला'
        : 'Fall detected — no response to voice check',
      patient,
      caregiverPhone || undefined,
    ).catch((e) => console.warn('[fall] escalation dispatch error:', e));
  };

  const handleImOkay = () => {
    clearTimers();
    stopNaturalVoice();
    setVisible(false);
    setEscalating(false);
  };

  // Real accelerometer fall detection: free-fall → impact → "Are you okay?".
  useFallDetection(handleFall, true);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  useEffect(() => clearTimers, []);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleImOkay}>
        <View style={s.backdrop}>
          <Animated.View style={[s.card, { transform: [{ scale: pulse }] }]}>
            <View style={s.iconWrap}>
              <Icon name="alert-octagon" set="feather" size={34} color="#F87171" />
            </View>
            <AppText variant="h1" weight="bold" color={colors.white} align="center">
              {escalating
                ? lang === 'hi'
                  ? 'मदद बुला दी गई है'
                  : 'Help has been called'
                : lang === 'hi'
                ? 'क्या आप ठीक हैं?'
                : 'Are you okay?'}
            </AppText>
            <AppText variant="body" color={colors.textMuted} align="center" style={{ marginTop: 6 }}>
              {escalating
                ? lang === 'hi'
                  ? 'उत्तर नहीं मिलने पर परिवार और 108 को सूचना भेज दी गई है।'
                  : 'No response — family and 108 have been alerted.'
                : lang === 'hi'
                ? `सहारा बोल रहा है — उत्तर नहीं दिया तो ${countdown} सेकंड में मदद बुलाई जाएगी।`
                : `Sahara is speaking — no answer in ${countdown}s will call for help.`}
            </AppText>

            {!escalating && (
              <Button
                label={lang === 'hi' ? 'मैं ठीक हूँ' : "I'm okay"}
                icon="check"
                variant="primary"
                big
                onPress={handleImOkay}
                style={{ marginTop: space.md, width: '100%' }}
              />
            )}
            {escalating && (
              <Button
                label={lang === 'hi' ? 'संकट समाप्त — मैं सुरक्षित हूँ' : 'Emergency over — I am safe'}
                variant="outline"
                big
                onPress={handleImOkay}
                style={{ marginTop: space.md, width: '100%' }}
              />
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0E131F',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(248, 113, 113, 0.5)',
    padding: space.xl,
    alignItems: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
});
