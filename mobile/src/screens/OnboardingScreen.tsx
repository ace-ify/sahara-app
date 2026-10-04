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
import type { Permission as AndroidPermission } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius } from '../theme';
import { useApp, Language } from '../context/AppContext';
import { speakNatural, stopNaturalVoice } from '../services/tts';

export default function OnboardingScreen() {
  const nav = useNavigation<any>();
  const { lang, previewLang, chooseLanguage, languageChosen, t } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Language>(lang);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [permMic, setPermMic] = useState(false);
  const [permLoc, setPermLoc] = useState(false);
  const [permNotif, setPermNotif] = useState(false);
  // True when Android answered "never ask again" — tapping the card opens app settings.
  const [permBlocked, setPermBlocked] = useState<{ mic?: boolean; loc?: boolean; notif?: boolean }>({});
  const [caregiverPhone, setCaregiverPhone] = useState('');

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

  const handleSelectLanguage = (l: Language) => {
    setSelected(l);
    previewLang(l);
  };

  const handlePlayVoiceGreeting = async () => {
    if (isPlayingVoice) {
      stopNaturalVoice();
      setIsPlayingVoice(false);
      return;
    }

    const text =
      selected === 'hi'
        ? 'नमस्ते! मैं सहारा हूँ — आपकी सेहत और परिवार की देखभाल के लिए हमेशा तैयार। आप मुझसे बोलकर बात कर सकते हैं।'
        : 'Hello! I am Sahara — your voice healthcare companion. You can speak to me naturally anytime.';

    setIsPlayingVoice(true);
    // Natural Murf voice from the backend; device TTS is the automatic fallback.
    speakNatural(text, selected, {
      onDone: () => setIsPlayingVoice(false),
      onError: () => setIsPlayingVoice(false),
    });
  };

  // Fire the REAL Android system permission dialog directly (no in-app alert),
  // matching the native notification-permission behaviour. When Android answers
  // "never ask again", the card switches to an "open Settings" action.
  const requestSystemPermission = async (
    permission: AndroidPermission,
    key: 'mic' | 'loc' | 'notif',
    setGranted: (granted: boolean) => void,
  ) => {
    if (Platform.OS !== 'android') {
      // iOS/desktop fallback: keep the original demo-toggle behaviour.
      setGranted(true);
      return;
    }
    if (permBlocked[key]) {
      Linking.openSettings().catch(() => {});
      return;
    }
    try {
      const res = await PermissionsAndroid.request(permission);
      if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        setPermBlocked((prev) => ({ ...prev, [key]: true }));
        setGranted(false);
        return;
      }
      setGranted(res === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      setGranted(false);
    }
  };

  const handleRequestMic = () =>
    requestSystemPermission(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, 'mic', setPermMic);

  const handleRequestLoc = () =>
    requestSystemPermission(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      'loc',
      setPermLoc,
    );

  const handleRequestNotif = () => {
    if (Platform.OS === 'android' && !PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
      setPermNotif(true);
      return;
    }
    requestSystemPermission(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, 'notif', setPermNotif);
  };

  const handleFinish = () => {
    stopNaturalVoice();
    if (languageChosen) {
      nav.navigate('Home');
    } else {
      chooseLanguage(selected);
    }
  };

  return (
    <Screen showBack={false} showSOS={false} bg={colors.bg}>
      {/* Top Bar: Stepper & Skip */}
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

        <Pressable
          onPress={handleFinish}
          style={s.skipBtn}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
        >
          <AppText variant="small" weight="semibold" color={colors.textMuted}>
            {selected === 'hi' ? 'छोड़ें' : 'Skip'}
          </AppText>
        </Pressable>
      </View>

      {/* ========================================================
          SLIDE 1: MEET SAHARA & VOICE PREVIEW
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

          {/* Headline & Mission */}
          <View style={s.headerBlock}>
            <AppText variant="h1" weight="bold" align="center" color={colors.text}>
              {selected === 'hi' ? 'नमस्ते! मैं सहारा हूँ 🙏' : 'Meet Sahara, Your Voice Companion'}
            </AppText>
            <AppText
              variant="body"
              align="center"
              color={colors.textMuted}
              style={{ marginTop: 4, lineHeight: 22 }}
            >
              {selected === 'hi'
                ? 'बुज़ुर्गों और परिवारों के लिए आसान आवाज़ साथी — बस बोलकर बात करें, बिना टाइपिंग के।'
                : 'Thoughtful voice healthcare for seniors — simply speak naturally in Hindi or English.'}
            </AppText>
          </View>

          {/* Interactive Spoken Voice Demo Card */}
          <Card doubleBezel glow tint="emerald" style={{ width: '100%' }}>
            <View style={s.voiceDemoRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name="volume-2" size={18} color="#34D399" />
                  <AppText variant="label" weight="bold" color="#34D399">
                    {selected === 'hi' ? 'आवाज़ सुनकर देखें' : 'Hear Voice Preview'}
                  </AppText>
                </View>
                <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
                  {isPlayingVoice
                    ? selected === 'hi'
                      ? '🔊 सहारा बोल रहा है...'
                      : '🔊 Sahara is speaking...'
                    : selected === 'hi'
                    ? 'दबाकर सहारा की दोस्ताना आवाज़ सुनें'
                    : 'Tap to test clear natural speech'}
                </AppText>
              </View>

              <Pressable
                onPress={handlePlayVoiceGreeting}
                style={[s.playButton, isPlayingVoice && s.playButtonActive]}
                accessibilityRole="button"
                accessibilityLabel="Play audio sample"
              >
                <Icon
                  name={isPlayingVoice ? 'square' : 'play'}
                  size={18}
                  color={isPlayingVoice ? '#FFFFFF' : '#05070A'}
                />
              </Pressable>
            </View>
          </Card>

          {/* Language Selection: Double-Bezel Tactile Cards */}
          <View style={{ width: '100%', gap: space.sm }}>
            <AppText variant="small" weight="bold" color={colors.textDim} style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
              {selected === 'hi' ? 'अपनी पसंदीदा भाषा चुनें' : 'Choose Your Preferred Language'}
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
                    {l === 'hi'
                      ? 'आवाज़ व बातचीत हिंदी में'
                      : 'Voice and chat in fluent English'}
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
            onPress={() => setStep(2)}
          />
        </View>
      )}

      {/* ========================================================
          SLIDE 2: EMERGENCY SAFETY (SIMPLE, NO JARGON)
         ======================================================== */}
      {step === 2 && (
        <View style={s.slideContainer}>
          <View style={s.heroIconWrap}>
            <View style={[s.shieldCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.35)' }]}>
              <Icon name="shield" size={36} color="#EF4444" />
            </View>
          </View>

          <View style={s.headerBlock}>
            <AppText variant="h1" weight="bold" align="center" color={colors.text}>
              {selected === 'hi' ? 'मुश्किल समय में परिवार और डॉक्टर साथ' : 'Help is Always One Touch Away'}
            </AppText>
            <AppText
              variant="body"
              align="center"
              color={colors.textMuted}
              style={{ marginTop: 4, lineHeight: 22 }}
            >
              {selected === 'hi'
                ? 'अगर बुज़ुर्ग गिर जाएँ या तबियत बिगड़े, तो सहारा तुरंत परिवार और एम्बुलेंस दोनों को खबर करता है।'
                : 'If a senior falls or feels unwell, Sahara immediately alerts family and emergency responders.'}
            </AppText>
          </View>

          {/* Safety Pillar Cards - Simple, warm, no confusing acronyms */}
          <View style={{ width: '100%', gap: space.sm }}>
            <Card doubleBezel glow tint="danger">
              <View style={s.pillarRow}>
                <View style={[s.pillarBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Icon name="truck" size={20} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" weight="bold" color="#FCA5A5">
                    {selected === 'hi' ? '108 सरकारी एम्बुलेंस अलर्ट' : '108 Emergency Ambulance'}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted}>
                    {selected === 'hi'
                      ? 'घर का सटीक पता और स्वास्थ्य स्थिति बिना देरी के भेजी जाती है'
                      : 'Sends your exact home location and vital info without any delay'}
                  </AppText>
                </View>
              </View>
            </Card>

            <Card doubleBezel tint="emerald">
              <View style={s.pillarRow}>
                <View style={[s.pillarBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Icon name="message-circle" size={20} color="#34D399" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" weight="bold" color="#6EE7B7">
                    {selected === 'hi' ? 'परिवार को तुरंत WhatsApp मैसेज' : 'Instant WhatsApp to Family'}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted}>
                    {selected === 'hi'
                      ? 'बेटे, बेटी या रिश्तेदार को फ़ौरन सूचना मिलती है'
                      : 'Caregiver receives live alert with symptoms and action steps'}
                  </AppText>
                </View>
              </View>
            </Card>

            <Card doubleBezel tint="cyan">
              <View style={s.pillarRow}>
                <View style={[s.pillarBadge, { backgroundColor: 'rgba(6, 182, 212, 0.2)' }]}>
                  <Icon name="phone-call" size={20} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" weight="bold" color="#7DD3FC">
                    {selected === 'hi' ? 'सहारा लगातार लाइन पर बना रहता है' : 'Continuous Voice Support'}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted}>
                    {selected === 'hi'
                      ? 'जब तक मदद नहीं पहुँचती, सहारा मरीज़ से बात करता रहता है'
                      : 'Sahara stays speaking with the senior until help arrives safely'}
                  </AppText>
                </View>
              </View>
            </Card>
          </View>

          {/* Navigation Controls */}
          <View style={s.btnRow}>
            <Button
              label={selected === 'hi' ? '← पीछे' : '← Back'}
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => setStep(1)}
            />
            <Button
              label={selected === 'hi' ? 'अनुमतियाँ सेट करें →' : 'Set Permissions →'}
              variant="primary"
              style={{ flex: 2 }}
              onPress={() => setStep(3)}
            />
          </View>
        </View>
      )}

      {/* ========================================================
          SLIDE 3: PRIVACY & REAL PERMISSIONS
         ======================================================== */}
      {step === 3 && (
        <View style={s.slideContainer}>
          <View style={s.heroIconWrap}>
            <View style={[s.shieldCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}>
              <Icon name="lock" size={36} color="#34D399" />
            </View>
          </View>

          <View style={s.headerBlock}>
            <AppText variant="h1" weight="bold" align="center" color={colors.text}>
              {selected === 'hi' ? '100% सुरक्षित और निजी' : 'Private & On-Device Security'}
            </AppText>
            <AppText
              variant="body"
              align="center"
              color={colors.textMuted}
              style={{ marginTop: 4, lineHeight: 22 }}
            >
              {selected === 'hi'
                ? 'आपका स्वास्थ्य डेटा आपके फ़ोन में सुरक्षित रहता है। केवल आपातकाल में अधिकृत लोगों से साझा होता है।'
                : 'Your medical data stays local on your phone with zero advertising tracking.'}
            </AppText>
          </View>

          {/* Tactile Permission Cards that actually trigger system popups */}
          <View style={{ width: '100%', gap: space.sm }}>
            <Pressable
              onPress={handleRequestMic}
              style={[s.permToggleCard, permMic && s.permToggleActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: permMic }}
            >
              <View style={[s.permIconBox, permMic && s.permIconBoxActive]}>
                <Icon name="mic" size={20} color={permMic ? '#34D399' : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label" weight="bold" color={colors.text}>
                  {selected === 'hi' ? 'माइक्रोफ़ोन (Microphone)' : 'Microphone Access'}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {permMic
                    ? (selected === 'hi' ? '✓ अनुमति प्राप्त' : '✓ Permission granted')
                    : permBlocked.mic
                    ? (selected === 'hi' ? 'Settings में जाकर अनुमति दें →' : 'Open Settings to allow →')
                    : (selected === 'hi' ? 'टैप करके अनुमति दें ताकि बोलकर बात कर सकें' : 'Tap to allow natural voice conversation')}
                </AppText>
              </View>
              <Icon name={permMic ? 'check-circle' : 'circle'} size={22} color={permMic ? '#34D399' : colors.textDim} />
            </Pressable>

            <Pressable
              onPress={handleRequestLoc}
              style={[s.permToggleCard, permLoc && s.permToggleActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: permLoc }}
            >
              <View style={[s.permIconBox, permLoc && s.permIconBoxActive]}>
                <Icon name="map-pin" size={20} color={permLoc ? '#34D399' : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label" weight="bold" color={colors.text}>
                  {selected === 'hi' ? 'आपातकालीन लोकेशन (GPS)' : 'Emergency Location (GPS)'}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {permLoc
                    ? (selected === 'hi' ? '✓ अनुमति प्राप्त' : '✓ Permission granted')
                    : permBlocked.loc
                    ? (selected === 'hi' ? 'Settings में जाकर अनुमति दें →' : 'Open Settings to allow →')
                    : (selected === 'hi' ? 'टैप करके अनुमति दें ताकि एम्बुलेंस सीधे घर पहुँचे' : 'Tap to allow 108 ambulance dispatch to home')}
                </AppText>
              </View>
              <Icon name={permLoc ? 'check-circle' : 'circle'} size={22} color={permLoc ? '#34D399' : colors.textDim} />
            </Pressable>

            <Pressable
              onPress={handleRequestNotif}
              style={[s.permToggleCard, permNotif && s.permToggleActive]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: permNotif }}
            >
              <View style={[s.permIconBox, permNotif && s.permIconBoxActive]}>
                <Icon name="bell" size={20} color={permNotif ? '#34D399' : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="label" weight="bold" color={colors.text}>
                  {selected === 'hi' ? 'दवा व अलर्ट सूचनाएँ' : 'Medicine & Alert Notifications'}
                </AppText>
                <AppText variant="small" color={colors.textMuted}>
                  {permNotif
                    ? (selected === 'hi' ? '✓ अनुमति प्राप्त' : '✓ Permission granted')
                    : permBlocked.notif
                    ? (selected === 'hi' ? 'Settings में जाकर अनुमति दें →' : 'Open Settings to allow →')
                    : (selected === 'hi' ? 'टैप करके समय पर दवा के रिमाइंडर चालू करें' : 'Tap to receive timely BP and dose reminders')}
                </AppText>
              </View>
              <Icon name={permNotif ? 'check-circle' : 'circle'} size={22} color={permNotif ? '#34D399' : colors.textDim} />
            </Pressable>
          </View>

          {/* Caregiver Optional Setup - NOT pre-linked */}
          <Card warm doubleBezel style={{ width: '100%', marginTop: 2 }}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Icon name="users" size={20} color="#34D399" />
                <AppText variant="label" weight="bold" color={colors.text}>
                  {selected === 'hi' ? 'परिवार का फ़ोन नंबर (वैकल्पिक)' : 'Family Caregiver Phone (Optional)'}
                </AppText>
              </View>
              <TextInput
                value={caregiverPhone}
                onChangeText={setCaregiverPhone}
                placeholder={selected === 'hi' ? 'जैसे: 9876543210' : 'e.g. 9876543210'}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: radius.md,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  fontSize: 15,
                }}
              />
              <AppText variant="small" color={colors.textMuted} style={{ fontSize: 11 }}>
                {selected === 'hi'
                  ? 'आपातकाल व रोज़ाना दवा की स्थिति इस नंबर पर WhatsApp द्वारा भेजी जाएगी। इसे बाद में भी जोड़ सकते हैं।'
                  : 'Emergency alerts and daily medicine logs will sync to this number. You can also add it later.'}
              </AppText>
            </View>
          </Card>

          {/* Launch Button */}
          <Button
            label={selected === 'hi' ? 'सहारा शुरू करें' : 'Start Sahara'}
            trailingIcon="arrow-right"
            variant="primary"
            big
            style={{ width: '100%', marginTop: space.sm }}
            onPress={handleFinish}
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

  // Voice Preview Card
  voiceDemoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: '#EF4444',
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

  // Permission Toggles
  permToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  permToggleActive: {
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
