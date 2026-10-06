import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { AppText } from './AppText';
import { Card } from './Card';
import { Button } from './Button';
import { Icon } from './Icon';
import { colors, space } from '../theme';
import { useApp } from '../context/AppContext';
import { speakNatural, stopNaturalVoice } from '../services/tts';
import { useDictation } from '../services/stt';
import { getMedications, logMedication, sendServerWhatsApp, Medication } from '../services/api';
import { getItem, setItem } from '../services/storage';

const CHECKIN_KEY = 'sahara.checkin.lastDate';
const HOUR_LOCAL = 5; // 5–11 AM local = morning window

const greetMorningHi = (name: string) =>
  `नमस्ते ${name ? name + ' जी' : ''}! सुबह की दवा ली थी? और आज आप कैसा महसूस कर रहे हैं?`;
const greetMorningEn = (name: string) =>
  `Good morning ${name ? name : ''}! Did you take your morning medicine? And how are you feeling today?`;

function isMorningNow() {
  const h = new Date().getHours();
  return h >= HOUR_LOCAL && h < 11;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Proactive daily check-in (PROTOTYPE, foreground): once each morning, greets
 * the senior by voice, records the spoken answer, logs medicines, and alerts
 * the caregiver on WhatsApp when doses are still pending.
 * ponytail: foreground-only — real scheduling needs expo-notifications
 * background jobs + server-side cron; add when daily-driver use starts.
 */
export function DailyCheckInCard() {
  const { lang, userName, caregiverPhone } = useApp();
  const [visible, setVisible] = useState(false);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<'idle' | 'listening' | 'done'>('idle');
  const pendingRef = useRef(false);

  // One check-in per morning; persists across app restarts.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const last = await getItem(CHECKIN_KEY);
        if (isMorningNow() && last !== todayKey() && mounted) {
          setVisible(true);
          speakNatural(
            lang === 'hi' ? greetMorningHi(userName) : greetMorningEn(userName),
            lang,
            {},
          );
          getMedications().then((m) => mounted && setMeds(m.status === 'success' ? m.medications : []));
        }
      } catch {}
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = meds.filter((m) => !m.taken_today);

  const handleVoiceAnswer = useCallback((text: string) => {
    setAnswer(text);
  }, []);

  const dictation = useDictation(lang, handleVoiceAnswer);
  useEffect(() => {
    if (dictation.phase === 'transcribing') setPhase('listening');
    if (dictation.phase === 'idle' && phase === 'listening') setPhase('done');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictation.phase]);

  const startListening = () => {
    setAnswer('');
    dictation.start();
    setPhase('listening');
  };

  // Missed dose → caregiver WhatsApp alert (server-side send).
  const alertCaregiver = async (pendingCount: number) => {
    const who = userName || (lang === 'hi' ? 'मरीज़' : 'patient');
    const msg =
      lang === 'hi'
        ? `सहारा सुबह की जाँच: ${who} ने बताया — "${answer || 'कोई उत्तर नहीं'}"। ${pendingCount} दवा अभी बाकी है। कृपया संपर्क करें।`
        : `Sahara morning check-in: ${who} said — "${answer || 'no response'}". ${pendingCount} dose(s) still pending. Please follow up.`;
    sendServerWhatsApp(msg, caregiverPhone || undefined).catch((e) =>
      console.warn('[checkin] caregiver alert failed:', e),
    );
  };

  const handleDone = async () => {
    stopNaturalVoice();
    dictation.cancel();
    pendingRef.current = false;
    setPhase('idle');
    setVisible(false);
    await setItem(CHECKIN_KEY, todayKey());

    // "हाँ/ले ली/दवा ले ली" → mark today's meds as taken.
    const yes = /हाँ|हां|ले ली|ली थी|ले लीं|yes|took|taken|done/i.test(answer);
    if (yes && meds.length > 0) {
      for (const m of pending) {
        await logMedication(m.name).catch(() => {});
      }
    } else if (pending.length > 0) {
      await alertCaregiver(pending.length);
    }
  };

  if (!visible) return null;

  return (
    <Card doubleBezel tint="emerald" glow>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={s.iconWrap}>
          <Icon name="sun" set="feather" size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" weight="bold" color={colors.white}>
            {lang === 'hi' ? 'सुबह की जाँच (सहारा बोल रहा है)' : 'Morning check-in (Sahara is speaking)'}
          </AppText>
          <AppText variant="small" color={colors.textMuted}>
            {lang === 'hi'
              ? 'दवा ली थी? बोलकर या बटन से बताइए।'
              : 'Did you take your medicine? Answer by voice or button.'}
          </AppText>
        </View>
      </View>

      {/* Spoken answer capture */}
      {phase !== 'idle' && (
        <View style={s.answerBox}>
          <Icon name="mic" set="feather" size={14} color={dictation.phase !== 'idle' ? '#34D399' : colors.textDim} />
          <AppText variant="small" color={colors.text} style={{ flex: 1 }}>
            {answer || (dictation.phase === 'recording'
              ? lang === 'hi' ? 'सुन रहा हूँ… बोलिए' : 'Listening… speak now'
              : dictation.phase === 'transcribing'
              ? lang === 'hi' ? 'समझ रहा हूँ…' : 'Understanding…'
              : lang === 'hi' ? 'बोलकर जवाब दें' : 'Answer by voice')}
          </AppText>
          <Pressable onPress={startListening} style={s.micBtn} accessibilityLabel="Answer by voice">
            <Icon name="mic" set="feather" size={16} color="#34D399" />
          </Pressable>
        </View>
      )}

      {pending.length > 0 && (
        <AppText variant="small" color={colors.textMuted} style={{ marginTop: 6 }}>
          {lang === 'hi'
            ? `आज की ${pending.length} दवा अभी बाकी है — "ले ली" बोलने पर दर्ज हो जाएगी।`
            : `${pending.length} dose(s) pending today — say "took it" to log them.`}
        </AppText>
      )}

      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Button
          label={lang === 'hi' ? 'हाँ, दवा ले ली' : 'Yes, took it'}
          icon="check"
          variant="primary"
          style={{ flex: 1 }}
          onPress={() => {
            setAnswer(lang === 'hi' ? 'हाँ, दवा ले ली' : 'Yes, took my medicine');
            handleDone();
          }}
        />
        <Button
          label={lang === 'hi' ? 'स्किप करें' : 'Skip'}
          variant="outline"
          style={{ flex: 1 }}
          onPress={handleDone}
        />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  micBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
