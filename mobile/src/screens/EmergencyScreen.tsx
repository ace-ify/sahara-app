import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius } from '../theme';
import { getEmergencyStatus, resolveEmergency, updateAvpu, IncidentSnapshot } from '../services/api';
import { useApp } from '../context/AppContext';

export default function EmergencyScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useApp();
  const channel = route.params?.channel || 'emergency-live';

  const [incident, setIncident] = useState<IncidentSnapshot | null>(null);
  const [avpuConfirmed, setAvpuConfirmed] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await getEmergencyStatus(channel);
        if (mounted && res.status === 'active' && res.incident) setIncident(res.incident);
      } catch {}
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [channel]);

  const hasAck = incident?.status === 'acknowledged' || Boolean(incident?.acked_by);
  const attemptsCount = incident?.attempts?.length || 2;
  const isUnresponsive = incident?.avpu_state === 'U';

  const participants = [
    { icon: 'user', set: 'feather', name: t('emerg_you'), st: t('emerg_you_st'), ok: true },
    { icon: 'cpu', set: 'feather', name: t('emerg_ai'), st: t('emerg_ai_st'), ok: true },
    { icon: 'phone-call', set: 'feather', name: t('emerg_caregiver'), st: hasAck ? t('emerg_caregiver_joined') : t('emerg_caregiver_alerted'), ok: true },
    { icon: 'truck', set: 'feather', name: '108 / 112', st: attemptsCount >= 2 ? t('emerg_108_dispatched') : t('emerg_108_active'), ok: true },
  ];

  const steps = [
    { text: t('emerg_step_1'), done: true },
    { text: t('emerg_step_2'), done: true },
    { text: t('emerg_step_3'), done: true },
    {
      text: hasAck ? t('emerg_step_4_ack').replace('{by}', incident?.acked_by || 'रमेश') : t('emerg_step_4_wait'),
      done: hasAck || attemptsCount >= 2,
    },
  ];

  const sbar = incident?.sbar_brief;

  return (
    <Screen bg={colors.bg} showSOS={false}>
      {/* Trauma Center Alert Header */}
      <Card doubleBezel tint="danger" style={s.bannerCard}>
        <View style={s.bannerRow}>
          <View style={{ flex: 1 }}>
            <View style={s.livePulseRow}>
              <View style={s.pulseDot} />
              <AppText variant="small" weight="bold" color={colors.dangerBright} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {t('emerg_red_path')} · LIVE CAD
              </AppText>
            </View>
            <AppText variant="h1" weight="bold" color={colors.white} style={{ marginTop: 4 }}>
              {t('emerg_help_title')}
            </AppText>
          </View>
          <View style={s.sosBadge}>
            <AppText variant="label" weight="bold" color={colors.danger}>SOS</AppText>
          </View>
        </View>
      </Card>

      {/* Participants Mesh */}
      <Card doubleBezel style={s.sectionCard}>
        <View style={s.cardHeaderRow}>
          <AppText variant="label" weight="bold" color={colors.text}>
            ACTIVE RESPONDERS
          </AppText>
          <View style={s.liveMeshPill}>
            <View style={s.greenDot} />
            <AppText variant="small" weight="bold" color={colors.brand}>4 Connected</AppText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
          {participants.map((p) => (
            <View key={p.name} style={{ flex: 1, alignItems: 'center' }}>
              <View style={s.ava}>
                <Icon name={p.icon} set={p.set as any} size={20} color={colors.brand} />
              </View>
              <AppText variant="small" weight="bold" align="center" numberOfLines={1} style={{ marginTop: 6, color: colors.white }}>
                {p.name}
              </AppText>
              <AppText variant="small" align="center" color={colors.brand} style={{ fontSize: 11, marginTop: 2 }}>
                {p.st}
              </AppText>
            </View>
          ))}
        </View>
      </Card>

      {/* AVPU Consciousness Gauge */}
      <Card doubleBezel tint={isUnresponsive ? 'danger' : 'emerald'} style={s.sectionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={isUnresponsive ? 'alert-octagon' : 'heart'} set="feather" size={20} color={isUnresponsive ? colors.dangerBright : colors.brand} />
            <AppText variant="label" weight="bold" color={isUnresponsive ? colors.dangerBright : colors.text}>
              {t('emerg_avpu_title')}
            </AppText>
          </View>
          <View style={[s.avpuStatePill, { backgroundColor: isUnresponsive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}>
            <AppText variant="small" weight="bold" color={isUnresponsive ? colors.dangerBright : colors.brand}>
              {isUnresponsive ? 'UNRESPONSIVE (U)' : 'ALERT & ORIENTED (A)'}
            </AppText>
          </View>
        </View>

        <AppText variant="small" color={colors.textMuted} style={{ marginTop: 8 }}>
          {isUnresponsive ? t('emerg_avpu_unresp') : t('emerg_avpu_ok')}
        </AppText>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {[
            { code: 'A', label: t('emerg_avpu_a'), color: colors.brand },
            { code: 'V', label: t('emerg_avpu_v'), color: colors.warn },
            { code: 'P', label: t('emerg_avpu_p'), color: colors.warn },
            { code: 'U', label: t('emerg_avpu_u'), color: colors.dangerBright },
          ].map((seg) => {
            const selected = (incident?.avpu_state || 'A') === seg.code;
            return (
              <View
                key={seg.code}
                style={[
                  s.segPill,
                  selected && {
                    backgroundColor: seg.color,
                    borderColor: seg.color,
                    shadowColor: seg.color,
                    shadowOpacity: 0.35,
                    shadowRadius: 8,
                    elevation: 3,
                  },
                ]}
              >
                <AppText variant="small" weight="bold" color={selected ? colors.black : colors.textMuted}>
                  {seg.label}
                </AppText>
              </View>
            );
          })}
        </View>

        <Button
          label={t('emerg_im_ok')}
          sub={t('emerg_im_ok_sub')}
          variant={avpuConfirmed ? 'outline' : 'primary'}
          icon="check"
          onPress={() => { setAvpuConfirmed(true); updateAvpu(channel, 'A', 'ok').catch(() => {}); }}
          style={{ marginTop: space.md }}
        />
      </Card>

      {/* SBAR Clinical Handoff */}
      <Card doubleBezel tint="danger" style={s.sectionCard}>
        <View style={s.rowBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="file-text" set="feather" size={18} color={colors.dangerBright} />
            <AppText variant="label" weight="bold" color={colors.white}>{t('emerg_sbar_title')}</AppText>
          </View>
          <View style={s.redBadge}>
            <AppText variant="small" weight="bold" color={colors.white}>{sbar?.band || 'RED'}</AppText>
          </View>
        </View>

        {[
          { k: 'S', label: t('emerg_sbar_s'), val: sbar?.situation || t('emerg_sbar_default_situation') },
          { k: 'B', label: t('emerg_sbar_b'), val: sbar?.background || t('emerg_sbar_default_background') },
          { k: 'A', label: t('emerg_sbar_a'), val: sbar?.assessment || t('emerg_sbar_default_assessment') },
          { k: 'R', label: t('emerg_sbar_r'), val: sbar?.recommendation || t('emerg_sbar_default_recommendation') },
        ].map((row) => (
          <View key={row.k} style={s.sbarRow}>
            <View style={s.sbarKey}>
              <AppText variant="small" weight="bold" color={colors.white}>{row.k}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="small" weight="bold" color={colors.textMuted}>{row.label}</AppText>
              <AppText variant="body" color={colors.white} style={{ marginTop: 2, fontSize: 13 }}>{row.val}</AppText>
            </View>
          </View>
        ))}

        {sbar?.verbal_handoff ? (
          <View style={s.verbalBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="mic" set="feather" size={14} color={colors.brand} />
              <AppText variant="small" weight="bold" color={colors.brand}>{t('emerg_verbal')}</AppText>
            </View>
            <AppText variant="small" color={colors.white} style={{ fontStyle: 'italic', marginTop: 4, lineHeight: 18 }}>
              “{sbar.verbal_handoff}”
            </AppText>
          </View>
        ) : null}
      </Card>

      {/* Ladder Checklist */}
      <Card doubleBezel style={s.sectionCard}>
        <View style={s.cardHeaderRow}>
          <AppText variant="label" weight="bold" color={colors.text}>
            {t('emerg_ladder_title')}
          </AppText>
          <AppText variant="small" color={colors.brand}>Auto Parallel</AppText>
        </View>
        {steps.map((st) => (
          <View key={st.text} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <View style={[s.stepCircle, st.done && s.stepCircleDone]}>
              <Icon name={st.done ? 'check' : 'clock'} set="feather" size={14} color={st.done ? colors.black : colors.textMuted} />
            </View>
            <AppText variant="small" color={st.done ? colors.white : colors.textMuted} style={{ flex: 1, fontWeight: st.done ? '600' : '400' }}>
              {st.text}
            </AppText>
          </View>
        ))}
      </Card>

      {/* Immediate Dispatch Call & Safe Standdown */}
      <View style={{ gap: space.sm, marginTop: space.xs, marginBottom: space.lg }}>
        <Button
          label={t('emerg_call_108')}
          sub={t('emerg_call_108_sub')}
          icon="phone"
          variant="danger"
          big
          onPress={() => Linking.openURL('tel:108').catch(() => {})}
        />
        <Button
          label={t('emerg_resolve')}
          sub={t('emerg_resolve_sub')}
          variant="outline"
          big
          onPress={() => { resolveEmergency(channel).catch(() => {}); nav.goBack(); }}
        />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  bannerCard: {
    marginBottom: space.xs,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livePulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.dangerBright,
  },
  sosBadge: {
    backgroundColor: colors.danger,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    shadowColor: colors.danger,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionCard: {
    marginBottom: space.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  liveMeshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  ava: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avpuStatePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
  },
  redBadge: {
    backgroundColor: colors.dangerDeep,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  sbarRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  sbarKey: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verbalBox: {
    marginTop: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: radius.md,
    padding: space.md,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
});

