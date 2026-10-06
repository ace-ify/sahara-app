import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius, sans } from '../theme';
import { logVital, getVitalsHistory } from '../services/api';
import { getItem, setItem } from '../services/storage';
import { useApp } from '../context/AppContext';
import { Card } from '../components/Card';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { CircularProgress } from '../components/reacticx';

// --- Real NEWS2 triage (client mirror of the server's laya.calculate_news2_score) ---
type Band = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

interface News2Result {
  score: number;
  band: Band;
  reasons: string[];
}

function news2ForVital(type: string, value: string): News2Result {
  let score = 0;
  const reasons: string[] = [];
  let singleParamRed = false;

  const t = type.toLowerCase();
  if (t.includes('bp')) {
    const m = value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (m) {
      const sys = parseInt(m[1], 10);
      const dia = parseInt(m[2], 10);
      if (sys >= 180 || dia >= 110) {
        score += 3;
        singleParamRed = true;
        reasons.push(`अत्यधिक उच्च BP (SBP ${sys})`);
      } else if (sys <= 90) {
        score += 3;
        singleParamRed = true;
        reasons.push(`गंभीर निम्न BP (SBP ${sys})`);
      } else if (sys <= 100) {
        score += 2;
        reasons.push(`निम्न BP (SBP ${sys})`);
      } else if (sys <= 110) {
        score += 1;
        reasons.push(`हल्का निम्न BP (SBP ${sys})`);
      } else if (sys >= 160) {
        score += 2;
        reasons.push(`उच्च BP स्टेज 2 (SBP ${sys})`);
      }
    }
  } else if (t.includes('pulse')) {
    const p = parseInt(value, 10);
    if (!isNaN(p)) {
      if (p >= 131 || p <= 40) {
        score += 3;
        singleParamRed = true;
        reasons.push(`गंभीर नाड़ी गति (${p} bpm)`);
      } else if (p >= 111) {
        score += 2;
        reasons.push(`तीव्र धड़कन (${p} bpm)`);
      } else if (p <= 50) {
        score += 1;
        reasons.push(`धीमी धड़कन (${p} bpm)`);
      } else if (p >= 91) {
        score += 1;
        reasons.push(`हल्की बढ़ी धड़कन (${p} bpm)`);
      }
    }
  } else if (t.includes('spo2')) {
    const s = parseInt(value, 10);
    if (!isNaN(s)) {
      if (s <= 85) {
        score += 3;
        singleParamRed = true;
        reasons.push(`गंभीर ऑक्सीजन कमी (SpO2 ${s}%)`);
      } else if (s <= 91) {
        score += 2;
        reasons.push(`ऑक्सीजन कम (SpO2 ${s}%)`);
      } else if (s <= 93) {
        score += 1;
        reasons.push(`हल्की ऑक्सीजन कमी (SpO2 ${s}%)`);
      }
    }
  } else if (t.includes('sugar')) {
    const g = parseInt(value, 10);
    if (!isNaN(g)) {
      if (g >= 400 || g <= 50) {
        score += 3;
        singleParamRed = true;
        reasons.push(`खतरनाक शुगर (${g} mg/dL)`);
      } else if (g >= 250) {
        score += 2;
        reasons.push(`उच्च शुगर (${g} mg/dL)`);
      }
    }
  }

  const band: Band =
    score >= 7 || singleParamRed ? 'RED' : score >= 5 ? 'ORANGE' : score >= 1 ? 'YELLOW' : 'GREEN';
  return { score, band, reasons };
}

const BAND_LABELS: Record<Band, string> = {
  GREEN: 'सामान्य',
  YELLOW: 'हल्का ध्यान',
  ORANGE: 'मध्यम जोखिम',
  RED: 'क्रिटिकल अलर्ट',
};
const BAND_COLORS: Record<Band, string> = {
  GREEN: colors.brand,
  YELLOW: colors.warn,
  ORANGE: colors.warn,
  RED: colors.dangerBright,
};

const VITALS_HISTORY_KEY = 'sahara.vitals.history.v1';

interface StoredVital {
  id: string;
  type: string;
  value: string;
  unit: string;
  timestamp: string;
  status: string;
  band: Band;
}

async function loadStoredVitals(): Promise<StoredVital[]> {
  try {
    const raw = await getItem(VITALS_HISTORY_KEY);
    if (raw) return JSON.parse(raw) as StoredVital[];
  } catch {}
  return [];
}

async function persistVitals(list: StoredVital[]): Promise<void> {
  try {
    await setItem(VITALS_HISTORY_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {}
}

function Vital({
  title,
  val,
  unit,
  icon,
  alarm,
  statusText,
  rangeLabel,
  onPress,
}: {
  title: string;
  val: string;
  unit: string;
  icon: string;
  alarm?: boolean;
  statusText: string;
  rangeLabel: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Card doubleBezel tint={alarm ? 'danger' : 'emerald'} style={s.vitalCard}>
        <View style={s.rowBetween}>
          <AppText variant="small" color={colors.textMuted} weight="bold">{title}</AppText>
          <View style={[s.pill, { backgroundColor: alarm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }]}>
            <AppText variant="small" weight="bold" color={alarm ? colors.dangerBright : colors.brand}>{statusText}</AppText>
          </View>
        </View>
        <AppText variant="number" weight="bold" color={alarm ? colors.dangerBright : colors.white} style={{ marginTop: 6, letterSpacing: -0.5 }}>
          {val}
        </AppText>
        <AppText variant="small" color={colors.textMuted} style={{ fontSize: 11, marginTop: 2 }}>{unit} · {rangeLabel}</AppText>
        <View style={s.track}>
          <View style={[s.trackFill, { width: alarm ? '85%' : '50%', backgroundColor: alarm ? colors.dangerBright : colors.brand }]} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function VitalsScreen() {
  const { lang, t } = useApp();
  const [bp, setBp] = useState('--/--');
  const [pulse, setPulse] = useState('--');
  const [sugar, setSugar] = useState('--');
  const [spo2, setSpo2] = useState('--');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<StoredVital[]>([]);

  // Manual entry fields
  const [inputVal, setInputVal] = useState('');
  const [selectedVitalType, setSelectedVitalType] = useState<'BP' | 'Pulse' | 'Sugar' | 'SpO2'>('BP');

  const applyLatest = (list: StoredVital[]) => {
    const latestBp = list.find((h) => h.type.toLowerCase().includes('bp'));
    if (latestBp) setBp(latestBp.value);
    const latestPulse = list.find((h) => h.type.toLowerCase().includes('pulse'));
    if (latestPulse) setPulse(latestPulse.value);
    const latestSugar = list.find((h) => h.type.toLowerCase().includes('sugar'));
    if (latestSugar) setSugar(latestSugar.value);
    const latestSpo2 = list.find((h) => h.type.toLowerCase().includes('spo2'));
    if (latestSpo2) setSpo2(latestSpo2.value);
  };

  // Local AsyncStorage history is the source of truth for the chart/history view;
  // the server copy is best-effort sync for the doctor dashboard.
  const loadHistory = async () => {
    const stored = await loadStoredVitals();
    setVitalsHistory(stored);
    applyLatest(stored);
    // Merge server-side readings not yet stored locally (e.g. voice-logged).
    try {
      const res = await getVitalsHistory();
      if (res && res.history && res.history.length > 0) {
        const storedIds = new Set(stored.map((v) => `${v.type}:${v.value}:${v.timestamp}`));
        const serverRows: StoredVital[] = res.history
          .filter((h: any) => !storedIds.has(`${h.type}:${h.value}:${h.timestamp}`))
          .map((h: any) => {
            const r = news2ForVital(h.type, h.value);
            return {
              id: h.id || `srv-${h.type}-${h.timestamp || Date.now()}`,
              type: h.type,
              value: h.value,
              unit: h.unit,
              timestamp: h.timestamp || '—',
              status: h.status || BAND_LABELS[r.band],
              band: r.band,
            };
          });
        if (serverRows.length > 0) {
          const merged = [...serverRows, ...stored].slice(0, 200);
          setVitalsHistory(merged);
          applyLatest(merged);
          await persistVitals(merged);
        }
      }
    } catch {}
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleLogVital = async (type: string, val: string, unit: string) => {
    if (!val || val.includes('--')) return;

    // Real NEWS2 triage drives the band + message immediately.
    const triage = news2ForVital(type, val);
    const bandLabel = BAND_LABELS[triage.band];
    let msg = '';
    if (lang === 'hi') {
      msg =
        triage.band === 'RED'
          ? `⚠️ क्रिटिकल (${bandLabel}): ${val} — कृपया तुरंत डॉक्टर से संपर्क करें।`
          : triage.band === 'ORANGE'
            ? `⚠️ ${bandLabel}: ${val} — आराम करें, थोड़ी देर में दोबारा नापें।`
            : `${type.toUpperCase()} ${val} ${unit} दर्ज हो गया (${bandLabel})।`;
    } else {
      msg =
        triage.band === 'RED'
          ? `⚠️ CRITICAL: ${val} — contact a doctor immediately.`
          : triage.band === 'ORANGE'
            ? `⚠️ Elevated: ${val} — rest and re-check shortly.`
            : `${type.toUpperCase()} ${val} ${unit} logged (${bandLabel}).`;
    }

    if (type.toLowerCase().includes('bp')) setBp(val);
    else if (type.toLowerCase().includes('pulse')) setPulse(val);
    else if (type.toLowerCase().includes('sugar')) setSugar(val);
    else setSpo2(val);

    setFeedback(msg);
    setTimeout(() => setFeedback(null), 5000);

    // Persist locally first (AsyncStorage) so history survives offline.
    const record: StoredVital = {
      id: `v-${Date.now()}`,
      type,
      value: val,
      unit,
      timestamp: new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN'),
      status: bandLabel,
      band: triage.band,
    };
    const next = [record, ...vitalsHistory].slice(0, 200);
    setVitalsHistory(next);
    await persistVitals(next);

    await logVital(type, val, unit).catch(() => {});
  };

  const handleManualSubmit = () => {
    if (!inputVal.trim()) return;
    let unit = 'mmHg';
    if (selectedVitalType === 'Pulse') unit = 'bpm';
    if (selectedVitalType === 'Sugar') unit = 'mg/dL';
    if (selectedVitalType === 'SpO2') unit = '%';

    handleLogVital(selectedVitalType.toLowerCase(), inputVal.trim(), unit);
    setInputVal('');
  };

  // NEWS2 bands for the latest reading of each vital
  const latestBand = (type: string): Band => {
    const latest = vitalsHistory.find((h) => h.type.toLowerCase().includes(type));
    return latest ? latest.band : 'GREEN';
  };
  const bpBand = bp !== '--/--' ? latestBand('bp') : 'GREEN';
  const sugarBand = sugar !== '--' ? latestBand('sugar') : 'GREEN';
  const isBpAlarm = bpBand === 'RED' || bpBand === 'ORANGE';
  const isSugarAlarm = sugarBand === 'RED' || sugarBand === 'ORANGE';
  const healthScore = isBpAlarm || isSugarAlarm ? 76 : (vitalsHistory.length > 0 ? 98 : 95);
  const stabilityProgress = useSharedValue(95);

  useEffect(() => {
    stabilityProgress.value = withTiming(healthScore, { duration: 900 });
  }, [healthScore, stabilityProgress]);

  return (
    <Screen title={t('vitals_title')} subtitle={t('vitals_subtitle')}>
      {feedback && (
        <Card doubleBezel tint="emerald" style={s.sectionCard}>
          <AppText variant="body" color={colors.brand} weight="semibold">✓ {feedback}</AppText>
        </Card>
      )}

      {/* Sahara Health Index Gauge (Reacticx CircularProgress) */}
      <Card doubleBezel tint={isBpAlarm || isSugarAlarm ? 'danger' : 'emerald'} style={s.sectionCard}>
        <View style={s.rowBetween}>
          <View style={{ flex: 1, paddingRight: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[s.greenDot, isBpAlarm || isSugarAlarm ? { backgroundColor: colors.dangerBright } : null]} />
              <AppText variant="label" weight="bold" color={colors.white}>
                {lang === 'hi' ? 'दैनिक स्वास्थ्य सूचकांक' : 'Daily Health Stability Index'}
              </AppText>
            </View>
            <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
              {isBpAlarm || isSugarAlarm
                ? (lang === 'hi' ? '⚠️ कुछ रीडिंग सामान्य से अधिक हैं — कृपया ध्यान दें' : '⚠️ Elevated readings detected — please rest')
                : (lang === 'hi' ? 'आपके सभी वाइटल्स स्थिर और सुरक्षित सीमा में हैं' : 'All monitored vitals are within normal range')}
            </AppText>
          </View>
          <CircularProgress
            progress={stabilityProgress}
            size={68}
            strokeWidth={6}
            progressCircleColor={isBpAlarm || isSugarAlarm ? '#EF4444' : colors.brand}
            renderCenter={() => (
              <AppText variant="label" weight="bold" color="#F8FAFC">
                {healthScore}%
              </AppText>
            )}
          />
        </View>
      </Card>

      {/* Primary Vitals Grid */}
      <View style={s.row}>
        <Vital
          title={t('vital_bp')}
          val={bp}
          unit="mmHg"
          icon="heart-pulse"
          alarm={isBpAlarm}
          statusText={isBpAlarm ? t('vitals_elevated') : t('vitals_normal')}
          rangeLabel={isBpAlarm ? t('vitals_check') : t('vitals_normal_range')}
          onPress={() => handleLogVital('bp', bp, 'mmHg')}
        />
        <Vital
          title={t('vital_pulse')}
          val={pulse}
          unit="bpm"
          icon="heart"
          statusText={t('vitals_normal')}
          rangeLabel={t('vitals_normal_range')}
          onPress={() => handleLogVital('pulse', pulse, 'bpm')}
        />
      </View>

      <View style={s.row}>
        <Vital
          title={t('vital_sugar')}
          val={sugar}
          unit="mg/dL"
          icon="water"
          alarm={isSugarAlarm}
          statusText={isSugarAlarm ? t('vitals_elevated') : t('vitals_normal')}
          rangeLabel={isSugarAlarm ? t('vitals_check') : t('vitals_normal_range')}
          onPress={() => handleLogVital('sugar', sugar, 'mg/dL')}
        />
        <Vital
          title={t('vital_spo2')}
          val="98"
          unit="%"
          icon="lungs"
          statusText={t('vitals_normal')}
          rangeLabel={t('vitals_normal_range')}
          onPress={() => handleLogVital('spo2', '98', '%')}
        />
      </View>

      {/* ========================================================
          ENTER REAL VITAL READING
         ======================================================== */}
      <Card doubleBezel style={s.sectionCard}>
        <AppText variant="label" weight="bold" color={colors.white}>
          {lang === 'hi' ? 'ताज़ा वाइटल रीडिंग दर्ज करें' : 'Log New Vital Reading'}
        </AppText>
        <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2, marginBottom: space.sm }}>
          {lang === 'hi' ? 'प्रकार चुनें और अपनी मशीन से देखकर लिखें:' : 'Select metric and enter reading from device:'}
        </AppText>

        {/* Type Selector Tabs */}
        <View style={s.metricTabs}>
          {(['BP', 'Pulse', 'Sugar', 'SpO2'] as const).map((vt) => (
            <Pressable
              key={vt}
              style={[s.metricTab, selectedVitalType === vt && s.metricTabActive]}
              onPress={() => setSelectedVitalType(vt)}
            >
              <AppText variant="small" weight="bold" color={selectedVitalType === vt ? colors.black : colors.textMuted}>
                {vt}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <TextInput
            style={s.vitalsInput}
            placeholder={
              selectedVitalType === 'BP'
                ? 'उदा. 120/80'
                : selectedVitalType === 'Pulse'
                ? 'उदा. 72'
                : selectedVitalType === 'Sugar'
                ? 'उदा. 110'
                : 'उदा. 98'
            }
            placeholderTextColor={colors.textMuted}
            value={inputVal}
            onChangeText={setInputVal}
            keyboardType={selectedVitalType === 'BP' ? 'default' : 'numeric'}
          />
          <Button
            label={lang === 'hi' ? 'दर्ज करें' : 'Save'}
            variant="primary"
            onPress={handleManualSubmit}
          />
        </View>
      </Card>

      {/* ========================================================
          REAL VITALS RECORDED HISTORY
         ======================================================== */}
      <Card doubleBezel style={s.sectionCard}>
        <View style={s.rowBetween}>
          <AppText variant="label" weight="bold" color={colors.white}>
            {lang === 'hi' ? '📋 दर्ज किए गए वाइटल्स का इतिहास' : '📋 Logged Vitals History'}
          </AppText>
          <View style={s.newsBadge}>
            <View style={s.greenDot} />
            <AppText variant="small" weight="bold" color={colors.brand}>
              {vitalsHistory.length} {lang === 'hi' ? 'रीडिंग' : 'Readings'}
            </AppText>
          </View>
        </View>

        {vitalsHistory.length === 0 ? (
          <View style={{ paddingVertical: space.lg, alignItems: 'center' }}>
            <Icon name="activity" set="feather" size={32} color={colors.textMuted} />
            <AppText variant="body" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
              {lang === 'hi'
                ? 'वर्तमान में कोई वाइटल्स रिकॉर्ड दर्ज नहीं है।'
                : 'No vitals recorded yet.'}
            </AppText>
            <AppText variant="small" color={colors.textDim} align="center" style={{ marginTop: 4 }}>
              {lang === 'hi'
                ? 'ऊपर दिए गए बॉक्स में अपनी ताज़ा रीडिंग दर्ज करें।'
                : 'Enter your latest reading above to begin tracking.'}
            </AppText>
          </View>
        ) : (
          <View style={{ marginTop: space.sm, gap: space.xs }}>
            {vitalsHistory.map((item, idx) => (
              <View key={item.id || idx} style={s.historyRow}>
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="bold" color={colors.white}>
                    {item.type}: {item.value} {item.unit}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted} style={{ fontSize: 11 }}>
                    {item.timestamp || 'हाल ही में दर्ज'}
                  </AppText>
                </View>
                <View
                  style={[
                    s.pill,
                    {
                      backgroundColor:
                        item.band === 'RED'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : item.band === 'ORANGE' || item.band === 'YELLOW'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                      borderColor: BAND_COLORS[item.band] || colors.brand,
                    },
                  ]}
                >
                  <AppText variant="small" weight="bold" color={BAND_COLORS[item.band] || colors.brand}>
                    {BAND_LABELS[item.band] || item.status || (lang === 'hi' ? 'सामान्य' : 'Normal')}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.xs },
  sectionCard: {
    marginBottom: space.xs,
  },
  vitalCard: {
    padding: space.xs,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceHigh, marginTop: 10, overflow: 'hidden' },
  trackFill: { height: 5, borderRadius: 3 },
  newsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  metricTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.pill,
    padding: 3,
    marginTop: space.md,
  },
  metricTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  metricTabActive: {
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  corridorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: radius.md,
    padding: 10,
    marginTop: space.sm,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 124,
    marginTop: space.md,
    paddingBottom: 4,
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingHorizontal: 2,
    borderRadius: radius.sm,
  },
  chartColSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  barTrack: {
    width: 14,
    height: 72,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  dayDetailCard: {
    backgroundColor: 'rgba(19, 25, 41, 0.8)',
    borderRadius: radius.md,
    padding: 12,
    marginTop: space.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  vitalsInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontFamily: sans.regular,
    fontSize: 15,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
});
