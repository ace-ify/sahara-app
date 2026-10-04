import React from 'react';
import { View, Pressable, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius } from '../theme';
import { useApp, TextSizeLevel } from '../context/AppContext';
import { clearAll } from '../services/storage';
import { resetAllData } from '../services/api';
import { FlipCard } from '../components/reacticx';

export default function ProfileScreen() {
  const nav = useNavigation<any>();
  const {
    lang,
    setLang,
    textSize,
    setTextSize,
    consentCaregiverSync,
    setConsentCaregiverSync,
    consentEmergencyBreakGlass,
    setConsentEmergencyBreakGlass,
    consentDoctorShare,
    setConsentDoctorShare,
    t,
  } = useApp();

  const sizes = [t('size_normal'), t('size_large'), t('size_xl')];

  const handleConfirmReset = () => {
    Alert.alert(
      lang === 'hi' ? 'ऐप रीसेट करें?' : 'Reset All Data?',
      lang === 'hi'
        ? 'क्या आप वाकई सहारा की सारी मेमोरी, चैट हिस्ट्री, दवाएं और वाइटल्स मिटाना चाहते हैं? नया यूजर शुरू से शुरू कर सकेगा।'
        : 'Are you sure you want to wipe all memory, transcripts, medications, and vitals? The app will return to a clean slate.',
      [
        { text: lang === 'hi' ? 'रद्द करें' : 'Cancel', style: 'cancel' },
        {
          text: lang === 'hi' ? 'हाँ, सब साफ़ करें' : 'Yes, Wipe All',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetAllData();
              await clearAll();
              Alert.alert(
                lang === 'hi' ? 'रीसेट पूरा हुआ' : 'Reset Complete',
                lang === 'hi' ? 'ऐप का सारा डेटा साफ़ कर दिया गया है।' : 'All data has been cleared.',
                [{ text: 'OK', onPress: () => nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] }) }],
              );
            } catch {
              await clearAll();
              nav.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
            }
          },
        },
      ],
    );
  };

  return (
    <Screen title={t('settings_title')} subtitle={t('settings_subtitle')}>
      {/* 3D Sahara Medical Health ID Card (Reacticx FlipCard) */}
      <FlipCard width={330} height={196} borderRadius={20}>
        <FlipCard.Front style={s.healthCardFront}>
          <FlipCard.Trigger style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={s.cardTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.cardLogoCircle}>
                  <Icon name="heart-pulse" set="mci" size={20} color="#10B981" />
                </View>
                <View>
                  <AppText variant="label" weight="bold" color="#F8FAFC">
                    सहारा स्वास्थ्य कार्ड (Health Pass)
                  </AppText>
                  <AppText variant="small" color="#94A3B8" style={{ fontSize: 11 }}>
                    Govt. Ayushman Bharat Linked
                  </AppText>
                </View>
              </View>
              <View style={s.vipBadge}>
                <AppText variant="small" weight="bold" color="#10B981">
                  वरिष्ठ नागरिक
                </AppText>
              </View>
            </View>

            <View style={s.cardStatsRow}>
              <View>
                <AppText variant="small" color="#94A3B8">रक्त समूह (Blood)</AppText>
                <AppText variant="label" weight="bold" color="#F8FAFC" style={{ fontSize: 17, marginTop: 2 }}>
                  O+ Positive
                </AppText>
              </View>
              <View>
                <AppText variant="small" color="#94A3B8">सुरक्षा स्थिति</AppText>
                <AppText variant="label" weight="bold" color="#10B981" style={{ fontSize: 14, marginTop: 2 }}>
                  सक्रिय (Active) ✓
                </AppText>
              </View>
              <View>
                <AppText variant="small" color="#94A3B8">आयु (Age)</AppText>
                <AppText variant="label" weight="bold" color="#F8FAFC" style={{ fontSize: 17, marginTop: 2 }}>
                  68 वर्ष
                </AppText>
              </View>
            </View>

            <View style={s.cardBottomHintRow}>
              <AppText variant="small" color="#64748B" style={{ fontSize: 11 }}>
                ID: SAH-2026-DL9921
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="rotate-cw" set="feather" size={12} color="#38BDF8" />
                <AppText variant="small" color="#38BDF8" weight="bold" style={{ fontSize: 11 }}>
                  पीछे पलटें (Tap to Flip)
                </AppText>
              </View>
            </View>
          </FlipCard.Trigger>
        </FlipCard.Front>

        <FlipCard.Back style={s.healthCardBack}>
          <FlipCard.Trigger style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={s.cardTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="alert-circle" set="feather" size={18} color="#EF4444" />
                <AppText variant="label" weight="bold" color="#EF4444">
                  आपातकालीन संपर्क विवरण
                </AppText>
              </View>
              <View style={s.sosBadge}>
                <AppText variant="small" weight="bold" color="#FFFFFF">
                  SOS 108 / 112
                </AppText>
              </View>
            </View>

            <View style={{ gap: 4, marginVertical: 4 }}>
              <AppText variant="small" color="#E2E8F0">
                • नज़दीकी अस्पताल: <AppText variant="small" weight="bold" color="#38BDF8">AIIMS New Delhi</AppText>
              </AppText>
              <AppText variant="small" color="#E2E8F0">
                • फैमिली केयरगिवर: <AppText variant="small" weight="bold" color="#10B981">WhatsApp Live Sync</AppText>
              </AppText>
              <AppText variant="small" color="#E2E8F0">
                • आपातकालीन पासकी: <AppText variant="small" weight="bold" color="#F59E0B">482 · 910</AppText>
              </AppText>
            </View>

            <View style={s.cardBottomHintRow}>
              <AppText variant="small" color="#64748B" style={{ fontSize: 11 }}>
                24x7 इमरजेंसी ब्रेक-ग्लास अधिकृत
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Icon name="rotate-ccw" set="feather" size={12} color="#10B981" />
                <AppText variant="small" color="#10B981" weight="bold" style={{ fontSize: 11 }}>
                  आगे जाएँ (Flip Front)
                </AppText>
              </View>
            </View>
          </FlipCard.Trigger>
        </FlipCard.Back>
      </FlipCard>

      {/* Text Size Selection */}
      <Card>
        <AppText variant="label" weight="bold">{t('settings_text_size')}</AppText>
        <View style={s.row}>
          {sizes.map((l, i) => (
            <Pressable
              key={l}
              onPress={() => setTextSize(i as TextSizeLevel)}
              style={[s.chip, i === textSize && s.chipOn]}
            >
              <AppText variant="small" weight="semibold" color={i === textSize ? colors.white : colors.text}>
                {l}
              </AppText>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Language Selection */}
      <Card>
        <AppText variant="label" weight="bold">{t('settings_language')}</AppText>
        <View style={s.row}>
          <Pressable onPress={() => setLang('hi')} style={[s.chip, lang === 'hi' && s.chipOn]}>
            <AppText variant="label" weight="semibold" color={lang === 'hi' ? colors.white : colors.text}>
              हिंदी
            </AppText>
          </Pressable>
          <Pressable onPress={() => setLang('en')} style={[s.chip, lang === 'en' && s.chipOn]}>
            <AppText variant="label" weight="semibold" color={lang === 'en' ? colors.white : colors.text}>
              English
            </AppText>
          </Pressable>
        </View>
      </Card>

      {/* Data Privacy & Consent Vault (Local-First + Controlled Sharing) */}
      <Card>
        <View style={s.privacyHeader}>
          <View style={s.shieldIconBadge}>
            <Icon name="shield" set="feather" size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="label" weight="bold" color="#F3F4F6">
              {t('consent_title')}
            </AppText>
            <AppText variant="small" color="#9CA3AF" style={{ marginTop: 2 }}>
              {t('consent_subtitle')}
            </AppText>
          </View>
        </View>

        {/* Local-first Encryption Banner */}
        <View style={s.localBanner}>
          <Icon name="lock" set="feather" size={14} color="#10B981" />
          <AppText variant="small" color="#10B981" style={{ flex: 1 }}>
            {t('consent_local_only')}
          </AppText>
        </View>

        <View style={s.consentList}>
          {/* 1. Caregiver Auto-Sync */}
          <View style={s.consentItem}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semibold" color="#F3F4F6">
                {t('consent_caregiver')}
              </AppText>
              <AppText variant="small" color="#9CA3AF">
                {t('consent_caregiver_sub')}
              </AppText>
            </View>
            <Pressable
              onPress={() => setConsentCaregiverSync(!consentCaregiverSync)}
              style={[s.toggleChip, consentCaregiverSync ? s.toggleOn : s.toggleOff]}
            >
              <AppText
                variant="small"
                weight="bold"
                color={consentCaregiverSync ? '#10B981' : '#9CA3AF'}
              >
                {consentCaregiverSync ? t('consent_on') : t('consent_off')}
              </AppText>
            </Pressable>
          </View>

          {/* 2. 108 Emergency Break-Glass */}
          <View style={s.consentItem}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semibold" color="#F3F4F6">
                {t('consent_emergency')}
              </AppText>
              <AppText variant="small" color="#9CA3AF">
                {t('consent_emergency_sub')}
              </AppText>
            </View>
            <Pressable
              onPress={() => setConsentEmergencyBreakGlass(!consentEmergencyBreakGlass)}
              style={[s.toggleChip, consentEmergencyBreakGlass ? s.toggleOn : s.toggleOff]}
            >
              <AppText
                variant="small"
                weight="bold"
                color={consentEmergencyBreakGlass ? '#10B981' : '#9CA3AF'}
              >
                {consentEmergencyBreakGlass ? t('consent_on') : t('consent_off')}
              </AppText>
            </Pressable>
          </View>

          {/* 3. Doctor & Hospital Teleconsult Sharing (Opt-in) */}
          <View style={s.consentItem}>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="semibold" color="#F3F4F6">
                {t('consent_doctor')}
              </AppText>
              <AppText variant="small" color="#9CA3AF">
                {t('consent_doctor_sub')}
              </AppText>
            </View>
            <Pressable
              onPress={() => setConsentDoctorShare(!consentDoctorShare)}
              style={[s.toggleChip, consentDoctorShare ? s.toggleOn : s.toggleOff]}
            >
              <AppText
                variant="small"
                weight="bold"
                color={consentDoctorShare ? '#10B981' : '#9CA3AF'}
              >
                {consentDoctorShare ? t('consent_on') : t('consent_off')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Card>

      {/* Auto SOS Sensor Card */}
      <Card>
        <AppText variant="label" weight="bold">{t('settings_auto_sos')}</AppText>
        <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>
          {t('settings_fall_detect')}
        </AppText>
        <AppText variant="body" color={colors.textMuted}>
          {t('settings_shake_sos')}
        </AppText>
      </Card>

      {/* Factory Reset & Complete Data Wipe */}
      <Card doubleBezel tint="danger" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239, 68, 68, 0.15)', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="trash-2" set="feather" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="label" weight="bold" color="#EF4444">
                {lang === 'hi' ? 'फ़ैक्टरी रीसेट · सारा डेटा मिटाएं' : 'Factory Reset · Clear All Data'}
              </AppText>
              <AppText variant="small" color="#9CA3AF" style={{ marginTop: 2 }}>
                {lang === 'hi'
                  ? 'पुरानी बातचीत, दवाएं, वाइटल्स व केयरगिवर सब मिटाकर ऐप बिल्कुल नई बन जाएगी।'
                  : 'Permanently wipes all memory, chat history, vitals, meds, and caregiver links.'}
              </AppText>
            </View>
          </View>
          <Button
            label={lang === 'hi' ? '⚠️ सारा डेटा साफ़ करें (Reset App)' : '⚠️ Wipe Everything & Reset App'}
            variant="danger"
            onPress={handleConfirmReset}
            style={{ marginTop: space.xs }}
          />
        </View>
      </Card>

      {/* Demo Screen Links */}
      <Card>
        <AppText variant="label" weight="bold">{t('settings_demo_screens')}</AppText>
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Button label={t('demo_onboarding')} sub={t('demo_onboarding_sub')} variant="ghost" onPress={() => nav.navigate('Onboarding')} />
          <Button label={t('demo_caregiver')} sub={t('demo_caregiver_sub')} variant="ghost" onPress={() => nav.navigate('CaregiverPairing')} />
          <Button label={t('demo_history')} sub={t('demo_history_sub')} variant="ghost" onPress={() => nav.navigate('CareHistory')} />
          <Button label={t('demo_emergency')} sub={t('demo_emergency_sub')} variant="ghost" onPress={() => nav.navigate('Emergency')} />
          <Button label={t('demo_caregiver_sos')} sub={t('demo_caregiver_sos_sub')} variant="ghost" onPress={() => nav.navigate('CaregiverSos')} />
        </View>
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarm,
  },
  chipOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  shieldIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  localBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  consentList: {
    gap: space.sm,
    marginTop: space.md,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
  },
  toggleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  toggleOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
  },
  toggleOff: {
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderColor: '#4B5563',
  },
  healthCardFront: {
    backgroundColor: '#13192B',
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    shadowColor: '#10B981',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  healthCardBack: {
    backgroundColor: '#161C2E',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    shadowColor: '#EF4444',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLogoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sosBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardBottomHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
