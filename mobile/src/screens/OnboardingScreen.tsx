import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  PermissionsAndroid,
  TextInput,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius } from '../theme';
import { useApp, Language } from '../context/AppContext';
import { speakNatural, stopNaturalVoice } from '../services/tts';

// Step-1 welcome, spoken automatically in natural Murf voice on mount and
// re-spoken when the language card changes.
const WELCOME_HI =
  'नमस्ते! मैं सहारा हूँ — आपकी सेहत और परिवार का साथी। कृपया अपनी पसंदीदा भाषा चुनें।';
const WELCOME_EN =
  'Hello! I am Sahara — a companion for your health and family. Please choose your preferred language.';

export default function OnboardingScreen() {
  const nav = useNavigation<any>();
  const {
    lang,
    previewLang,
    chooseLanguage,
    languageChosen,
    t,
    userName,
    setUserName,
    caregiverPhone,
    setCaregiverPhone,
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Language>(lang);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [nameInput, setNameInput] = useState(userName);
  const [phoneInput, setPhoneInput] = useState(caregiverPhone);
  // 'idle' → nothing requested yet · 'requesting' → system dialogs up ·
  // 'granted' → both allowed · 'blocked' → Android said "never ask again".
  const [permStatus, setPermStatus] = useState<'idle' | 'requesting' | 'granted' | 'blocked'>('idle');

  // Breathing Voice AI Orb Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.9,
            duration: 1800,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1800,
            useNativeDriver: false,
          }),
        ]),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim, glowAnim]);

  const stopGreeting = () => {
    stopNaturalVoice();
    setIsPlayingVoice(false);
  };

  // Auto-play the warm welcome in natural Murf voice when the screen mounts.
  useEffect(() => {
    setIsPlayingVoice(true);
    speakNatural(lang === 'hi' ? WELCOME_HI : WELCOME_EN, lang, {
      onDone: () => setIsPlayingVoice(false),
      onError: () => setIsPlayingVoice(false),
    });
    return stopGreeting;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectLanguage = (l: Language) => {
    if (l === selected) return;
    setSelected(l);
    previewLang(l);
    // Re-greet in the newly selected language so the choice is heard, not just seen.
    setIsPlayingVoice(true);
    speakNatural(l === 'hi' ? WELCOME_HI : WELCOME_EN, l, {
      onDone: () => setIsPlayingVoice(false),
      onError: () => setIsPlayingVoice(false),
    });
  };

  // Fire the REAL system permission dialogs — mic first, then location.
  // Both routes are the SDK's own permission prompts (PermissionsAndroid on
  // Android, the module's request API on iOS; web needs no prompt).
  // Returns 'granted' | 'denied' | 'blocked' so an ordinary denial can be
  // retried while a hard "never ask again" routes to system settings.
  const requestMicPermission = async (): Promise<'granted' | 'denied' | 'blocked'> => {
    try {
      if (Platform.OS === 'web') return 'granted';
      if (Platform.OS === 'android') {
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (res === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
        if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
        return 'denied';
      }
      // iOS — expo-audio's own permission prompt (denials are re-promptable
      // from settings, so keep the retry route rather than hard-blocking).
      const { requestRecordingPermissionsAsync } = await import('expo-audio');
      const perm = await requestRecordingPermissionsAsync();
      return perm?.granted ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  };

  const requestLocationPermission = async (): Promise<'granted' | 'denied' | 'blocked'> => {
    try {
      if (Platform.OS === 'web') return 'granted';
      if (Platform.OS === 'android') {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        if (res === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
        if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
        return 'denied';
      }
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) return 'granted';
      return canAskAgain === false ? 'blocked' : 'denied';
    } catch {
      return 'denied';
    }
  };

  const handleFinish = () => {
    stopGreeting();
    // Persist the entered profile (trimmed in the context) before moving on.
    setUserName(nameInput);
    setCaregiverPhone(phoneInput);
    if (languageChosen) {
      nav.navigate('Home');
    } else {
      chooseLanguage(selected);
    }
  };

  // The single high-trust action: requests both permissions, then finishes.
  const handleEnableAndStart = async () => {
    if (permStatus === 'granted') {
      handleFinish();
      return;
    }
    if (permStatus === 'requesting') return;
    // Previously denied with "never ask again" → route to system settings.
    if (permStatus === 'blocked') {
      Linking.openSettings().catch(() => {});
      return;
    }

    setPermStatus('requesting');
    const micResult = await requestMicPermission();
    const locResult = await requestLocationPermission();

    if (micResult === 'granted' && locResult === 'granted') {
      setPermStatus('granted');
      handleFinish();
      return;
    }
    // Hard "never ask again" on either permission → route to system settings.
    // An ordinary denial stays retryable — onboarding is never a dead end.
    if (micResult === 'blocked' || locResult === 'blocked') {
      setPermStatus('blocked');
      return;
    }
    setPermStatus('idle');
  };

  return (
    <Screen showBack={false} showSOS={false} bg={colors.bg}>
      {/* Top Bar: Stepper, Mute & Skip */}
      <View style={s.topBar}>
        <View style={s.brandRow}>
          <View style={s.logoPill}>
            <View style={s.logoDot} />
            <AppText variant="small" weight="bold" color="#34D399">
              SAHARA AI
            </AppText>
          </View>
        </View>

        {/* 3-Step Pill Stepper */}
        <View style={s.stepperTrack}>
          {[1, 2, 3].map((sNum) => (
            <Pressable
              key={sNum}
              onPress={() => setStep(sNum as 1 | 2 | 3)}
              style={[
                s.stepPill,
                step === sNum && s.stepPillActive,
                step > sNum && s.stepPillCompleted,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Step ${sNum}`}
            />
          ))}
        </View>

        <View style={s.topActions}>
          {/* Subtle mute/stop for the auto-playing greeting */}
          <Pressable
            onPress={stopGreeting}
            style={s.muteBtn}
            accessibilityRole="button"
            accessibilityLabel={isPlayingVoice ? 'Stop greeting audio' : t('onb_listen')}
          >
            <Icon
              name={isPlayingVoice ? 'volume-x' : 'volume-2'}
              set="feather"
              size={16}
              color={isPlayingVoice ? '#34D399' : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={handleFinish}
            style={s.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <AppText variant="small" weight="semibold" color={colors.textMuted}>
              {t('onb_skip')}
            </AppText>
          </Pressable>
        </View>
      </View>

      {/* ========================================================
          SLIDE 1: VOICE WELCOME & LANGUAGE
         ======================================================== */}
      {step === 1 && (
        <View style={s.slideContainer}>
          {/* Breathing AI Voice Orb Hero */}
          <View style={s.heroOrbContainer}>
            <Animated.View
              style={[
                s.orbOuterHalo,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: glowAnim,
                },
              ]}
            />
            <View style={s.orbCore}>
              <View style={s.orbInnerGradient}>
                <Icon name="mic" size={32} color="#FFFFFF" />
              </View>
            </View>
          </View>

          {/* Headline & mission */}
          <View style={s.headerBlock}>
            <AppText variant="h1" weight="bold" align="center" color={colors.text}>
              {t('onb_s1_title')}
            </AppText>
            <AppText
              variant="body"
              align="center"
              color={colors.textMuted}
              style={{ marginTop: 4, lineHeight: 22 }}
            >
              {t('onb_s1_body')}
            </AppText>
            {isPlayingVoice && (
              <AppText variant="small" color="#34D399" align="center" style={{ marginTop: 6 }}>
                {t('onb_s1_voice_now')}
              </AppText>
            )}
          </View>

          {/* Language Selection: Double-Bezel Tactile Cards */}
          <View style={{ width: '100%', gap: space.sm }}>
            <AppText
              variant="small"
              weight="bold"
              color={colors.textDim}
              style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}
            >
              {t('onb_choose_lang')}
            </AppText>

            {(['hi', 'en'] as const).map((l) => (
              <Pressable
                key={l}
                onPress={() => handleSelectLanguage(l)}
                style={[s.langCard, selected === l && s.langCardActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === l }}
              >
                <View style={s.langAvatar}>
                  <AppText variant="h2">{l === 'hi' ? '🇮🇳' : '🌐'}</AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText
                    variant="label"
                    weight="bold"
                    color={selected === l ? '#34D399' : colors.text}
                    style={{ fontSize: 18 }}
                  >
                    {l === 'hi' ? 'हिंदी (Hindi)' : 'English (Indian)'}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted}>
                    {l === 'hi' ? 'आवाज़ व बातचीत हिंदी में' : 'Voice and chat in fluent English'}
                  </AppText>
                </View>
                <View style={[s.radioCircle, selected === l && s.radioCircleActive]}>
                  {selected === l && <View style={s.radioDot} />}
                </View>
              </Pressable>
            ))}
          </View>

          {/* Simple intuitive forward button */}
          <Button
            label={selected === 'hi' ? 'आगे बढ़ें →' : 'Continue →'}
            trailingIcon="arrow-right"
            variant="primary"
            big
            style={{ width: '100%', marginTop: space.sm }}
            onPress={() => {
              stopGreeting();
              setStep(2);
            }}
          />
        </View>
      )}

      {/* ========================================================
          SLIDE 2: WHAT IS SAHARA — 2-PILLAR MISSION (NO JARGON)
         ======================================================== */}
      {step === 2 && (
        <View style={s.slideContainer}>
          <View style={s.heroIconWrap}>
            <View
              style={[
                s.shieldCircle,
                { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' },
              ]}
            >
              <Icon name="heart-pulse" set="mci" size={36} color="#34D399" />
            </View>
          </View>

          <View style={s.headerBlock}>
            <AppText variant="h1" weight="bold" align="center" color={colors.text}>
              {t('onb_s2_title')}
            </AppText>
            <AppText
              variant="body"
              align="center"
              color={colors.textMuted}
              style={{ marginTop: 4, lineHeight: 22 }}
            >
              {t('onb_s2_body')}
            </AppText>
          </View>

          {/* Mission Pillar 1: daily chronic health support */}
          <Card doubleBezel glow tint="emerald" style={{ width: '100%' }}>
            <View style={s.pillarRow}>
              <View style={[s.pillarBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <Icon name="activity" size={20} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label" weight="bold" color="#6EE7B7">
                  {t('onb_s2_p1_title')}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {t('onb_s2_p1_body')}
                </AppText>
              </View>
            </View>
          </Card>

          {/* Mission Pillar 2: 24/7 emergency lifeline */}
          <Card doubleBezel tint="danger" style={{ width: '100%' }}>
            <View style={s.pillarRow}>
              <View style={[s.pillarBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Icon name="truck" size={20} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label" weight="bold" color="#FCA5A5">
                  {t('onb_s2_p2_title')}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {t('onb_s2_p2_body')}
                </AppText>
              </View>
            </View>
          </Card>

          {/* Navigation Controls */}
          <View style={s.btnRow}>
            <Button
              label={t('onb_back')}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => setStep(1)}
            />
            <Button
              label={selected === 'hi' ? 'आगे बढ़ें →' : 'Continue →'}
              variant="primary"
              style={{ flex: 2 }}
              onPress={() => setStep(3)}
            />
          </View>
        </View>
      )}

      {/* ========================================================
          SLIDE 3: SETUP — NAME, CAREGIVER & PERMISSIONS
         ======================================================== */}
      {step === 3 && (
        <View style={s.slideContainer}>
          <View style={s.headerBlock}>
            <AppText variant="h1" weight="bold" align="center" color={colors.text}>
              {t('onb_s3_title')}
            </AppText>
            <AppText
              variant="body"
              align="center"
              color={colors.textMuted}
              style={{ marginTop: 4, lineHeight: 20 }}
            >
              {t('onb_s3_body')}
            </AppText>
          </View>

          {/* User Name */}
          <Card warm doubleBezel style={{ width: '100%' }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Icon name="user" set="feather" size={20} color="#34D399" />
                <AppText variant="label" weight="bold" color={colors.text}>
                  {t('onb_s3_name_label')}
                </AppText>
              </View>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={t('onb_s3_name_hint')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
                style={s.inputField}
              />
            </View>
          </Card>

          {/* Family Caregiver WhatsApp Number — saved for SOS alerts */}
          <Card warm doubleBezel style={{ width: '100%' }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Icon name="phone-call" set="feather" size={20} color="#34D399" />
                <AppText variant="label" weight="bold" color={colors.text}>
                  {t('onb_s3_caregiver_label')}
                </AppText>
              </View>
              <TextInput
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder={t('onb_s3_caregiver_hint')}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                returnKeyType="done"
                style={s.inputField}
              />
              <AppText variant="small" color={colors.textMuted} style={{ fontSize: 11 }}>
                {t('onb_s3_caregiver_sub')}
              </AppText>
            </View>
          </Card>

          {/* Single high-trust permission card — one button, real dialogs */}
          <Pressable
            onPress={handleEnableAndStart}
            style={[s.permCard, permStatus === 'granted' && s.permCardActive]}
            accessibilityRole="button"
            accessibilityLabel={t('onb_s3_perm_title')}
            disabled={permStatus === 'requesting'}
          >
            <View style={[s.permIconBox, permStatus === 'granted' && s.permIconBoxActive]}>
              <Icon
                name={permStatus === 'granted' ? 'check-circle' : 'lock'}
                set="feather"
                size={22}
                color={permStatus === 'granted' ? '#34D399' : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="bold" color={colors.text} style={{ fontSize: 16 }}>
                {t('onb_s3_perm_title')}
              </AppText>
              <AppText variant="small" color={colors.textMuted}>
                {permStatus === 'granted'
                  ? t('onb_s3_perm_granted')
                  : permStatus === 'blocked'
                  ? t('onb_s3_perm_retry')
                  : permStatus === 'requesting'
                  ? selected === 'hi'
                    ? 'अनुमति माँगी जा रही है…'
                    : 'Asking for permission…'
                  : t('onb_s3_perm_sub')}
              </AppText>
            </View>
            {permStatus === 'requesting' && (
              <Icon name="loader" set="feather" size={18} color={colors.textMuted} />
            )}
          </Pressable>

          {/* Launch Button — requests permissions cleanly and finishes onboarding */}
          <Button
            label={permStatus === 'granted' ? t('onb_s3_finish') : t('onb_s3_enable')}
            trailingIcon="arrow-right"
            variant="primary"
            big
            style={{ width: '100%', marginTop: space.sm }}
            onPress={handleEnableAndStart}
          />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  logoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  stepperTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepPill: {
    width: 22,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  stepPillActive: {
    width: 32,
    backgroundColor: '#34D399',
    shadowColor: colors.brand,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  stepPillCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.45)',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muteBtn: {
    width: 32,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  slideContainer: {
    alignItems: 'center',
    gap: space.md,
    paddingBottom: space.xl,
  },

  // Hero Orb
  heroOrbContainer: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.xs,
  },
  orbOuterHalo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
  },
  orbCore: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#0E131F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.6)',
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
  orbInnerGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBlock: {
    alignItems: 'center',
    paddingHorizontal: space.sm,
  },

  // Language Cards
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  langCardActive: {
    borderColor: '#34D399',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  langAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#34D399',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34D399',
  },

  // Slide 2 & 3 Helpers
  heroIconWrap: {
    marginVertical: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pillarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: space.sm,
    marginTop: space.sm,
  },

  // Setup inputs
  inputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },

  // Single permission card
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  permCardActive: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  permIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconBoxActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
});
