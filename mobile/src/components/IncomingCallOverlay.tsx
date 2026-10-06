import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, space } from '../theme';
import { useApp } from '../context/AppContext';
import { checkIncomingFollowup } from '../services/api';
import { getItem } from '../services/storage';

const VOICE_CHANNEL_KEY = 'sahara.voice_channel';
const POLL_MS = 8000;

/**
 * Rings the patient's app when an admin starts a follow-up call. One tap
 * answers → starts the voice session (TalkScreen's startSession joins the
 * same channel the agent is already in). Declining is honest: nothing is
 * faked, the dashboard keeps showing the call in progress.
 */
export function IncomingCallOverlay({ onAnswer }: { onAnswer: () => void }) {
  const { lang } = useApp();
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const ringing = useRef(false);
  const answeredRef = useRef(false);

  const ringAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, ringAnim]);

  // Poll for an in-progress admin call on our channel — only while idle-ish;
  // the parent renders this overlay only when the session is idle.
  const poll = useCallback(async () => {
    try {
      const channel = await getItem(VOICE_CHANNEL_KEY);
      if (!channel) return;
      const res = await checkIncomingFollowup(channel);
      if (res.incoming && res.call && !ringing.current && !answeredRef.current) {
        ringing.current = true;
        setNote(res.call.note || null);
        setVisible(true);
      } else if (!res.incoming && ringing.current && !answeredRef.current) {
        // Admin set an outcome / call ended before answering.
        ringing.current = false;
        setVisible(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(poll, POLL_MS);
    poll();
    return () => clearInterval(id);
  }, [poll]);

  const handleAnswer = () => {
    answeredRef.current = true;
    ringing.current = false;
    setVisible(false);
    onAnswer();
    // Re-arm the ringer after the call session ends (next poll cycle).
    setTimeout(() => {
      answeredRef.current = false;
    }, 60000);
  };

  const handleDecline = () => {
    ringing.current = false;
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDecline}>
      <View style={s.backdrop}>
        <Animated.View
          style={[
            s.card,
            {
              transform: [
                {
                  scale: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[
              s.ringCircle,
              {
                borderColor: 'rgba(52, 211, 153, 0.2)',
                transform: [
                  {
                    scale: ringAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.25],
                    }),
                  },
                ],
                opacity: ringAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
              },
            ]}
          />
          <View style={s.phoneIcon}>
            <Icon name="phone-call" set="feather" size={26} color="#34D399" />
          </View>
          <AppText variant="h1" weight="bold" color={colors.white} align="center">
            {lang === 'hi' ? 'सहारा कॉल कर रहा है' : 'Sahara is calling'}
          </AppText>
          <AppText variant="body" color={colors.textMuted} align="center" style={{ marginTop: 4 }}>
            {note ||
              (lang === 'hi'
                ? 'सेहत की नियमित जाँच — बात करने के लिए उठाइए'
                : 'Routine health check-in — answer to talk')}
          </AppText>

          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg, width: '100%' }}>
            <Button
              label={lang === 'hi' ? 'मना करें' : 'Decline'}
              variant="outline"
              style={{ flex: 1 }}
              onPress={handleDecline}
              icon="x"
            />
            <Button
              label={lang === 'hi' ? 'उठाइए (बात करें)' : 'Answer'}
              variant="primary"
              style={{ flex: 1.4 }}
              onPress={handleAnswer}
              icon="phone"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 100,
    paddingHorizontal: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0E131F',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.5)',
    padding: space.xl,
    alignItems: 'center',
  },
  phoneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  ringCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
  },
});
