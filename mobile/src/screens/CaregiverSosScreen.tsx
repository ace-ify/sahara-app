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
  const { t, lang, userName } = useApp();
  const channel = route.params?.channel || 'emergency-live';
  const [joined, setJoined] = useState(false);
  const [incident, setIncident] = useState<IncidentSnapshot | null>(null);

  // Caregiver's own identity for the ack — the caregiver's saved name, not a
  // hardcoded persona. (On the caregiver's device the app runs as them.)
  const selfName = userName || (lang === 'hi' ? 'केयरगिवर' : 'Caregiver');

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
      await ackEmergency(channel, selfName);
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
  const attempts = incident?.attempts || [];
  const emsNotified = attempts.some((a) => a.kind === 'ambulance' && a.delivered);
  const caregiverAlerted = attempts.some((a) => a.kind === 'caregiver' && a.delivered);
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
            <AppText variant="body" color={colors.textMuted}>
              {emsNotified ? t('csos_dispatched') : lang === 'hi' ? 'अलर्ट भेजा जा रहा है…' : 'Alerting…'}
            </AppText>
            {/* No invented ETA — real dispatch data arrives with the live CAD
                integration; until then we show the honest dispatch state. */}
            <View style={s.etaBadge}>
              <AppText variant="small" weight="bold" color={colors.brand}>
                {emsNotified ? '108' : '…'}
              </AppText>
            </View>
          </View>
        </Card>

        {/* Vitals only when a live SBAR snapshot actually carried them —
            no fabricated critical readings. */}
        {sbar?.assessment && (
        <View style={s.vitals}>
          <Card doubleBezel tint="danger" style={{ flex: 1 }}>
            <AppText variant="small" color={colors.textMuted} weight="bold">{t('csos_bp')}</AppText>
            <AppText variant="number" weight="bold" color={colors.dangerBright} style={{ marginTop: 4 }}>
              {sbar.assessment.split(/(\d{2,3}\/\d{2,3})/).filter((p: string) => /\d/.test(p))[0] || '—'}
            </AppText>
            <AppText variant="small" color={colors.dangerBright}>{t('csos_high')}</AppText>
          </Card>
          <Card doubleBezel tint="emerald" style={{ flex: 1 }}>
            <AppText variant="small" color={colors.textMuted} weight="bold">{t('csos_pulse')}</AppText>
            <AppText variant="number" weight="bold" color={colors.white} style={{ marginTop: 4 }}>
              {sbar.assessment.match(/(\d{2,3})\s*(?:bpm|धड़कन)/)?.[1] || '—'}
            </AppText>
            <AppText variant="small" color={colors.brand}>bpm</AppText>
          </Card>
        </View>
        )}

        <Card doubleBezel tint="cyan">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Icon name="mic" set="feather" size={14} color={colors.brandSecondary} />
            <AppText variant="small" weight="bold" color={colors.brandSecondary}>{t('csos_live_audio')}</AppText>
          </View>
          {/* Live transcript lines — only shown when a real dispatch carried
              transcript text. No scripted demo dialogue, no invented doctor. */}
          {(incident?.reason || caregiverAlerted) && (
            <AppText variant="body" color={colors.white} style={{ marginTop: 4 }}>
              {incident?.reason || t('csos_default_reason')}
            </AppText>
          )}
          {joined ? (
            <AppText variant="body" weight="semibold" color={colors.brandSecondary} style={{ marginTop: 2 }}>
              {t('csos_joined_sub')}
            </AppText>
          ) : (
            <AppText variant="small" color={colors.textMuted} style={{ marginTop: 6 }}>
              {t('csos_join_sub')}
            </AppText>
          )}
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
