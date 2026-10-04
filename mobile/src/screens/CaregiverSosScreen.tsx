import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space } from '../theme';
import { ackEmergency, resolveEmergency, getEmergencyStatus, IncidentSnapshot } from '../services/api';
import { useApp } from '../context/AppContext';

export default function CaregiverSosScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useApp();
  const channel = route.params?.channel || 'emergency-live';
  const [joined, setJoined] = useState(false);
  const [incident, setIncident] = useState<IncidentSnapshot | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getEmergencyStatus(channel);
        if (mounted && res.status === 'active' && res.incident) {
          setIncident(res.incident);
        }
      } catch {}
    };
    load();
    const interval = setInterval(load, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [channel]);

  const handleJoin = async () => {
    try {
      await ackEmergency(channel, 'रमेश');
      setJoined(true);
    } catch {
      setJoined(true);
    }
  };

  const handleResolve = async () => {
    try {
      await resolveEmergency(channel);
    } catch {}
    nav.goBack();
  };

  const sbar = incident?.sbar_brief;
  return (
    <Screen bg={colors.bg}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space.xl, gap: space.sm }}>
        <Card doubleBezel tint="danger">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={s.pulseDot} />
            <AppText variant="small" weight="bold" color={colors.dangerBright} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
              {t('csos_alert')}
            </AppText>
          </View>
          <AppText variant="h1" weight="bold" color={colors.white}>
            {incident?.patient || t('csos_default_patient')}
          </AppText>
          <AppText variant="body" color={colors.text} style={{ marginTop: 2 }}>
            {incident?.reason || t('csos_default_reason')}
          </AppText>
        </Card>

        <Button
          label={joined ? t('csos_joined') : t('csos_join')}
          sub={joined ? t('csos_joined_sub') : t('csos_join_sub')}
          icon="headphones"
          variant={joined ? 'primary' : 'danger'}
          big
          onPress={handleJoin}
        />

        {sbar && (
          <Card doubleBezel tint="danger">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <AppText variant="label" weight="bold" color={colors.white}>{t('csos_sbar')}</AppText>
              <View style={s.redBadge}>
                <AppText variant="small" weight="bold" color={colors.white}>{sbar.band || 'RED PATH'}</AppText>
              </View>
            </View>
            <AppText variant="small" color={colors.white}>
              <AppText variant="small" weight="bold" color={colors.textMuted}>{t('emerg_sbar_s')}: </AppText>
              {sbar.situation}
            </AppText>
            <AppText variant="small" color={colors.white} style={{ marginTop: 6 }}>
              <AppText variant="small" weight="bold" color={colors.textMuted}>{t('emerg_sbar_a')}: </AppText>
              {sbar.assessment}
            </AppText>
            <AppText variant="small" color={colors.white} style={{ marginTop: 6 }}>
              <AppText variant="small" weight="bold" color={colors.textMuted}>{t('emerg_sbar_r')}: </AppText>
              {sbar.recommendation}
            </AppText>
          </Card>
        )}

        <Card doubleBezel>
          <AppText variant="label" weight="bold" color={colors.white}>{t('csos_ambulance')}</AppText>
          <View style={s.row}>
            <AppText variant="body" color={colors.textMuted}>{t('csos_dispatched')}</AppText>
            <View style={s.etaBadge}>
              <AppText variant="small" weight="bold" color={colors.brand}>{t('csos_eta')}</AppText>
            </View>
          </View>
        </Card>

        <View style={s.vitals}>
          <Card doubleBezel tint="danger" style={{ flex: 1 }}>
            <AppText variant="small" color={colors.textMuted} weight="bold">{t('csos_bp')}</AppText>
            <AppText variant="number" weight="bold" color={colors.dangerBright} style={{ marginTop: 4 }}>158/96</AppText>
            <AppText variant="small" color={colors.dangerBright}>{t('csos_high')}</AppText>
          </Card>
          <Card doubleBezel tint="emerald" style={{ flex: 1 }}>
            <AppText variant="small" color={colors.textMuted} weight="bold">{t('csos_pulse')}</AppText>
            <AppText variant="number" weight="bold" color={colors.white} style={{ marginTop: 4 }}>104</AppText>
            <AppText variant="small" color={colors.brand}>bpm · {t('vitals_normal')}</AppText>
          </Card>
        </View>

        <Card doubleBezel tint="cyan">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="mic" set="feather" size={14} color={colors.brandSecondary} />
            <AppText variant="small" weight="bold" color={colors.brandSecondary}>{t('csos_live_audio')}</AppText>
          </View>
          <AppText variant="body" color={colors.white} style={{ marginTop: 4 }}>{t('csos_line1')}</AppText>
          <AppText variant="body" weight="semibold" color={colors.brandSecondary} style={{ marginTop: 2 }}>{t('csos_line2')}</AppText>
          <AppText variant="small" color={colors.textMuted} style={{ marginTop: 6 }}>{t('csos_doctor_joining')}</AppText>
        </Card>

        <Button label={t('csos_resolve')} variant="outline" big onPress={handleResolve} />
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  vitals: { flexDirection: 'row', gap: space.sm },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dangerBright,
  },
  redBadge: {
    backgroundColor: colors.dangerDeep,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  etaBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
});
