import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius } from '../theme';
import { getMedications, logMedication, Medication } from '../services/api';
import { useApp } from '../context/AppContext';

export default function MedsScreen() {
  const nav = useNavigation<any>();
  const { lang, t, tf } = useApp();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchMeds = async () => {
    try {
      setLoading(true);
      const res = await getMedications();
      setMeds(res.medications || []);
    } catch {
      setMeds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeds();
  }, []);

  const handleMarkTaken = (medName: string) => {
    setMeds((prev) =>
      prev.map((m) =>
        m.name.toLowerCase().includes(medName.toLowerCase()) || medName.toLowerCase().includes(m.name.toLowerCase())
          ? { ...m, taken_today: true }
          : m,
      ),
    );
    setActionMsg(`${t('meds_success_msg')} (${medName})`);
    setTimeout(() => setActionMsg(null), 4000);
    logMedication(medName).catch(() => {});
  };

  const takenCount = meds.filter((m) => m.taken_today).length;
  const progressPct = meds.length > 0 ? Math.round((takenCount / meds.length) * 100) : 0;

  return (
    <Screen title={t('meds_title')} subtitle={t('meds_subtitle')}>
      {/* Adherence Card */}
      <Card doubleBezel tint="emerald" style={s.sectionCard}>
        <View style={s.rowBetween}>
          <View>
            <AppText variant="label" weight="bold" color={colors.white}>{t('meds_adherence')}</AppText>
            <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
              {tf('meds_progress', { taken: takenCount, total: meds.length, pct: progressPct })}
            </AppText>
          </View>
          <View style={s.adherenceBadge}>
            <AppText variant="label" weight="bold" color={colors.brand}>{progressPct}%</AppText>
          </View>
        </View>
        <View style={s.track}>
          <View style={[s.trackFill, { width: `${progressPct}%` }]} />
        </View>
      </Card>

      {/* Prescription & Chemist Bill Scanner Trigger Card */}
      <Pressable onPress={() => nav.navigate('PrescriptionScanner')}>
        <Card doubleBezel glow tint="cyan" style={s.sectionCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={s.scannerIconWrap}>
              <Icon name="camera" set="feather" size={22} color={colors.black} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.rowBetween}>
                <AppText variant="label" weight="bold" color={colors.white}>
                  {lang === 'hi' ? '📸 पर्चा व बिल स्कैनर' : '📸 Scan Prescription & Bill'}
                </AppText>
                <View style={s.newPill}>
                  <AppText variant="small" weight="bold" color={colors.black} style={{ fontSize: 10 }}>
                    {lang === 'hi' ? 'नया' : 'NEW'}
                  </AppText>
                </View>
              </View>
              <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
                {lang === 'hi'
                  ? 'हाथ की पर्ची + केमिस्ट बिल का मिलान · जन औषधि से बचत'
                  : 'Multi-source Rx + GST Bill cross-check · Jan Aushadhi match'}
              </AppText>
            </View>
            <Icon name="chevron-right" set="feather" size={20} color={colors.brand} />
          </View>
        </Card>
      </Pressable>

      {actionMsg && (
        <Card doubleBezel tint="emerald" style={s.sectionCard}>
          <AppText variant="body" color={colors.brand} weight="semibold">✓ {actionMsg}</AppText>
        </Card>
      )}

      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
      ) : meds.length === 0 ? (
        <Card doubleBezel style={s.sectionCard}>
          <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
            <Icon name="pill" set="mci" size={38} color={colors.textMuted} />
            <AppText variant="h2" weight="bold" color={colors.text} align="center">
              {lang === 'hi' ? 'वर्तमान में कोई दवा दर्ज नहीं है' : 'No Medications Added'}
            </AppText>
            <AppText variant="small" color={colors.textMuted} align="center" style={{ maxWidth: 300, lineHeight: 18 }}>
              {lang === 'hi'
                ? 'डॉक्टर का पर्चा या बिल स्कैन करके अपनी असली दवाएं जोड़ें, अथवा सहारा से बोलें: "मेरी दवा जोड़ो"।'
                : 'Scan your doctor prescription or bill to add medications, or tell Sahara via voice.'}
            </AppText>
            <Button
              label={lang === 'hi' ? '📸 पर्चा व बिल स्कैन करें' : '📸 Scan Prescription & Bill'}
              onPress={() => nav.navigate('PrescriptionScanner')}
              style={{ marginTop: 6 }}
            />
          </View>
        </Card>
      ) : (
        meds.map((m) => (
          <Card
            key={m.id}
            doubleBezel
            tint={m.taken_today ? 'emerald' : undefined}
            style={s.sectionCard}
          >
            <View style={s.rowBetween}>
              <AppText variant="label" weight="bold" color={colors.white} style={{ flex: 1, fontSize: 17 }}>
                {m.name}
              </AppText>
              <View style={[s.pill, { backgroundColor: m.taken_today ? 'rgba(16, 185, 129, 0.15)' : colors.surfaceHigh }]}>
                <AppText variant="small" weight="bold" color={m.taken_today ? colors.brand : colors.textMuted}>
                  {m.taken_today ? t('meds_taken_badge') : t('meds_pending_badge')}
                </AppText>
              </View>
            </View>

            <AppText variant="small" color={colors.textMuted} style={{ marginTop: 6 }}>
              🕒 {m.timing}
            </AppText>

            <View style={s.tagRow}>
              <View style={s.tag}>
                <AppText variant="small" color={colors.textMuted}>{m.purpose}</AppText>
              </View>
              <View style={[s.tag, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                <AppText variant="small" weight="bold" color={colors.brand}>{t('meds_generic_available')}</AppText>
              </View>
            </View>

            {!m.taken_today && (
              <Button
                label={t('meds_mark_taken')}
                icon="check"
                onPress={() => handleMarkTaken(m.name)}
                style={{ marginTop: space.md }}
              />
            )}
          </Card>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  sectionCard: {
    marginBottom: space.xs,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  adherenceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHigh, marginTop: 12, overflow: 'hidden' },
  trackFill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  scannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  newPill: {
    backgroundColor: colors.brand,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
