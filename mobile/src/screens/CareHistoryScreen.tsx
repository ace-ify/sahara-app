import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { colors, space } from '../theme';
import { getVitalsHistory } from '../services/api';
import { useApp } from '../context/AppContext';

export default function CareHistoryScreen() {
  const { t } = useApp();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    getVitalsHistory()
      .then((res) => {
        if (res && res.history) setHistory(res.history);
      })
      .catch(() => {});
  }, []);

  const changes = [t('history_change_1'), t('history_change_2'), t('history_change_3')];
  const tabs = [t('history_tab_all'), t('history_tab_symptoms'), t('history_tab_doctors')];

  return (
    <Screen title={t('history_title')} subtitle={t('history_subtitle')}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xl, gap: space.sm }}
      >
        <Card doubleBezel tint="emerald">
          <AppText variant="h1" weight="bold" color={colors.white}>{t('history_hero_title')}</AppText>
          <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>{t('history_hero_body')}</AppText>
        </Card>

        <Card doubleBezel>
          <AppText variant="label" weight="bold" color={colors.white}>{t('history_changes_title')}</AppText>
          {changes.map((c) => (
            <View key={c} style={s.row}>
              <View style={s.checkBadge}>
                <AppText variant="small" weight="bold" color={colors.brand}>✓</AppText>
              </View>
              <AppText variant="body" color={colors.text} style={{ flex: 1 }}>{c}</AppText>
            </View>
          ))}
        </Card>

        {history.length > 0 && (
          <Card doubleBezel>
            <AppText variant="label" weight="bold" color={colors.white}>{t('history_recent')}</AppText>
            {history.map((h) => (
              <View
                key={h.id || h.timestamp}
                style={[s.row, { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6 }]}
              >
                <View style={{ flex: 1 }}>
                  <AppText variant="label" weight="bold" color={colors.white}>
                    {h.type}: {h.value} {h.unit}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted}>{h.timestamp}</AppText>
                </View>
                <AppText
                  variant="small"
                  weight="bold"
                  color={h.status?.includes('बढ़ा') || h.status?.includes('High') ? colors.danger : colors.brand}
                >
                  {h.status}
                </AppText>
              </View>
            ))}
          </Card>
        )}

        <View style={s.tabs}>
          {tabs.map((tab, i) => (
            <View key={tab} style={[s.tab, i === 0 && s.tabOn]}>
              <AppText variant="small" weight="bold" color={i === 0 ? colors.black : colors.textMuted}>
                {tab}
              </AppText>
            </View>
          ))}
        </View>

        <Card doubleBezel>
          <AppText variant="small" color={colors.textMuted}>{t('history_entry1_time')}</AppText>
          <AppText variant="label" weight="bold" color={colors.white} style={{ marginTop: 2 }}>{t('history_entry1_title')}</AppText>
          <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>
            {t('history_entry1_body')}
          </AppText>
          <AppText variant="small" color={colors.brand} weight="bold" style={{ marginTop: 8 }}>
            {t('history_listen')}
          </AppText>
        </Card>

        <Card doubleBezel>
          <AppText variant="small" color={colors.textMuted}>{t('history_entry2_time')}</AppText>
          <AppText variant="label" weight="bold" color={colors.white} style={{ marginTop: 2 }}>{t('history_entry2_title')}</AppText>
          <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>
            {t('history_entry2_body')}
          </AppText>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', gap: space.sm, marginVertical: space.xs },
  tab: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: colors.surfaceHigh,
  },
  tabOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
});
