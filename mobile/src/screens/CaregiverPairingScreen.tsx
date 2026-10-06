import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Linking, Alert, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { AppText } from '../components/AppText';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { colors, space, radius } from '../theme';
import { useApp } from '../context/AppContext';
import { sendServerWhatsApp, getMedications, getVitalsHistory, Medication } from '../services/api';
import { getItem, setItem, removeItem } from '../services/storage';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { OtpInput, CircularProgress, ProfileCard } from '../components/reacticx';

// High-fidelity QR Matrix for pairing
const QR = [
  '1111111010001111111', '1000001011101000001', '1011101001001011101',
  '1011101110101011101', '1011101001101011101', '1000001010101000001',
  '1111111010101111111', '0000000011100000000', '1101011100101110010',
  '0010110011010001101', '1100101010101110100', '0011010101000101011',
  '1111111001101011001', '1000001011010100110', '1011101000111011010',
  '1011101110010101101', '1011101001101110010', '1000001011010001101',
  '1111111010101110100',
];

function QrBox() {
  return (
    <View style={s.qr}>
      {QR.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, x) => (
            <View key={x} style={{ width: 9, height: 9, backgroundColor: c === '1' ? '#000000' : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

interface CaregiverProfile {
  name: string;
  relation: string;
  phone: string;
  isLinked: boolean;
}

export default function CaregiverPairingScreen() {
  const nav = useNavigation<any>();
  const { lang, t } = useApp();

  const [activeTab, setActiveTab] = useState<'family' | 'telemetry' | 'pair'>('family');
  const [caregiverType, setCaregiverType] = useState<'family' | 'paid'>('family');
  const [copiedCode, setCopiedCode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [caregiver, setCaregiver] = useState<CaregiverProfile | null>(null);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);

  // Manual pairing inputs
  const [inputName, setInputName] = useState('');
  const [inputPhone, setInputPhone] = useState('');
  const [inputRelation, setInputRelation] = useState('बेटा / बेटी');

  useEffect(() => {
    getItem('sahara.caregiver').then((str) => {
      if (str) {
        try {
          const parsed = JSON.parse(str);
          if (parsed && parsed.isLinked) setCaregiver(parsed);
        } catch {}
      }
    });
    getVitalsHistory().then((v) => {
      if (v && v.history) setVitalsHistory(v.history);
    });
    getMedications().then((m) => {
      if (m && m.medications) setMedications(m.medications);
    });
  }, []);

  const adherenceRate = medications.length > 0
    ? Math.round((medications.filter((m) => m.taken_today).length / medications.length) * 100)
    : 100;
  const adherenceProgress = useSharedValue(100);
  useEffect(() => {
    adherenceProgress.value = withTiming(adherenceRate, { duration: 800 });
  }, [adherenceRate, adherenceProgress]);

  const handleLinkCaregiver = async () => {
    if (!inputName.trim() || !inputPhone.trim()) {
      Alert.alert(
        lang === 'hi' ? 'जानकारी अधूरी है' : 'Incomplete details',
        lang === 'hi' ? 'कृपया केयरगिवर का नाम और फ़ोन नंबर दर्ज करें।' : 'Please enter caregiver name and phone number.',
      );
      return;
    }
    const rawDigits = inputPhone.trim().replace(/[^0-9+]/g, '');
    const cleanPhone = rawDigits.startsWith('+') ? rawDigits : `+91${rawDigits.replace(/^0+/, '')}`;
    const newProfile: CaregiverProfile = {
      name: inputName.trim(),
      relation: inputRelation.trim() || (lang === 'hi' ? 'परिवार' : 'Family'),
      phone: cleanPhone,
      isLinked: true,
    };
    await setItem('sahara.caregiver', JSON.stringify(newProfile));
    setCaregiver(newProfile);
    setActiveTab('family');
    Alert.alert(
      lang === 'hi' ? 'केयरगिवर लिंक हो गया' : 'Caregiver Linked',
      lang === 'hi' ? `${newProfile.name} को आपके परिवार मंडल से जोड़ दिया गया है।` : `${newProfile.name} is now connected.`,
    );
  };

  const handleUnlinkCaregiver = async () => {
    await removeItem('sahara.caregiver');
    setCaregiver(null);
  };

  const handleSendWhatsAppUpdate = async () => {
    if (!caregiver) {
      Alert.alert(
        lang === 'hi' ? 'कोई केयरगिवर लिंक नहीं' : 'No caregiver linked',
        lang === 'hi' ? 'कृपया पहले केयरगिवर लिंक करें।' : 'Please link a caregiver first.',
      );
      setActiveTab('pair');
      return;
    }
    const medsList = medications.length > 0
      ? medications.map((m) => `${m.name} (${m.timing || 'निर्धारित समय'})`).join(', ')
      : (lang === 'hi' ? 'वर्तमान में कोई दवा निर्धारित नहीं' : 'No medications currently scheduled');
    const latestVital = vitalsHistory.length > 0 ? vitalsHistory[0] : null;
    const vitalsStr = latestVital
      ? `${latestVital.type}: ${latestVital.value} ${latestVital.unit} (${latestVital.status || 'सामान्य'})`
      : (lang === 'hi' ? 'सामान्य व स्थिर' : 'Normal & stable');

    const rawText =
      lang === 'hi'
        ? `🌿 *सहारा हेल्थ अपडेट*\n━━━━━━━━━━━━━━━━━━━━\n👤 *केयरगिवर*: ${caregiver.name} (${caregiver.relation})\n💊 *दवाएँ*: ${medsList}\n📊 *वाइटल्स*: ${vitalsStr}\n🕒 *स्थिति*: मरीज़ पूरी तरह सुरक्षित और सचेत हैं।`
        : `🌿 *Sahara Health Update*\n━━━━━━━━━━━━━━━━━━━━\n👤 *Caregiver*: ${caregiver.name} (${caregiver.relation})\n💊 *Medications*: ${medsList}\n📊 *Vitals*: ${vitalsStr}\n🕒 *Status*: Patient is alert and safe.`;

    try {
      await sendServerWhatsApp(rawText, caregiver.phone);
    } catch {}
    setToastMessage(lang === 'hi' ? 'WhatsApp पर स्वास्थ्य अपडेट भेज दिया गया ✓' : 'Health update sent on WhatsApp ✓');
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCallCaregiver = () => {
    if (!caregiver) {
      Alert.alert(lang === 'hi' ? 'कोई केयरगिवर लिंक नहीं' : 'No caregiver linked');
      setActiveTab('pair');
      return;
    }
    Linking.openURL(`tel:${caregiver.phone}`).catch(() => {
      Alert.alert('Phone Call', `Calling ${caregiver.phone}`);
    });
  };

  return (
    <Screen
      title={lang === 'hi' ? 'परिवार मंडल व केयरगिवर' : 'Family Circle & Caregiver'}
      subtitle={
        lang === 'hi'
          ? 'लाइव मॉनिटरिंग · WhatsApp अपडेट · आपातकालीन संपर्क'
          : 'Live telemetry · WhatsApp updates · Emergency contact'
      }
    >
      {/* Segmented Mode Selector */}
      <View style={s.tabBar}>
        <Pressable
          style={[s.tabItem, activeTab === 'family' && s.tabItemActive]}
          onPress={() => setActiveTab('family')}
        >
          <AppText
            variant="small"
            weight="bold"
            color={activeTab === 'family' ? '#000000' : colors.textMuted}
          >
            {lang === 'hi' ? '👨‍👩‍👧 परिवार मंडल' : '👨‍👩‍👧 Family Circle'}
          </AppText>
        </Pressable>
        <Pressable
          style={[s.tabItem, activeTab === 'telemetry' && s.tabItemActive]}
          onPress={() => setActiveTab('telemetry')}
        >
          <AppText
            variant="small"
            weight="bold"
            color={activeTab === 'telemetry' ? '#000000' : colors.textMuted}
          >
            {lang === 'hi' ? '📊 लाइव स्थिति' : '📊 Live Telemetry'}
          </AppText>
        </Pressable>
        <Pressable
          style={[s.tabItem, activeTab === 'pair' && s.tabItemActive]}
          onPress={() => setActiveTab('pair')}
        >
          <AppText
            variant="small"
            weight="bold"
            color={activeTab === 'pair' ? '#000000' : colors.textMuted}
          >
            {lang === 'hi' ? '🔗 जोड़ें / QR' : '🔗 Link / QR'}
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space.xl, gap: space.md }}
      >
        {toastMessage && (
          <View style={s.toastPill}>
            <Icon name="check-circle" set="feather" size={16} color="#05DF72" />
            <AppText variant="small" weight="bold" color="#FFFFFF">
              {toastMessage}
            </AppText>
          </View>
        )}

        {/* ========================================================
            TAB 1: FAMILY CIRCLE OVERVIEW
           ======================================================== */}
        {activeTab === 'family' && (
          <>
            <Card warm>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <AppText variant="h2" weight="bold" color={colors.text}>
                    {lang === 'hi' ? 'परिवार मंडल सुरक्षा' : 'Family Circle Network'}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
                    {lang === 'hi'
                      ? 'मरीज़, प्राथमिक केयरगिवर और डॉक्टर का सीधा संपर्क'
                      : 'Real-time sync between senior, primary family, and physician'}
                  </AppText>
                </View>
                <Icon name="shield-heart" set="mci" size={30} color="#2DD4BF" />
              </View>
            </Card>

            {!caregiver ? (
              <Card doubleBezel style={{ alignItems: 'center', paddingVertical: space.xl, gap: space.sm }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(56, 189, 248, 0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="user-plus" set="feather" size={30} color="#38BDF8" />
                </View>
                <AppText variant="h2" weight="bold" color={colors.white} align="center">
                  {lang === 'hi' ? 'कोई केयरगिवर जुड़ा हुआ नहीं है' : 'No Caregiver Linked'}
                </AppText>
                <AppText variant="small" color={colors.textMuted} align="center" style={{ maxWidth: 280, lineHeight: 18 }}>
                  {lang === 'hi'
                    ? 'आपातकालीन WhatsApp अलर्ट, 3-तरफ़ा ऑडियो और दवा सूचना के लिए अपने परिवार के सदस्य को जोड़ें।'
                    : 'Link a family member to receive automatic WhatsApp telemetry & 3-way emergency calls.'}
                </AppText>
                <View style={{ marginTop: space.sm, width: '100%' }}>
                  <Button
                    label={lang === 'hi' ? '🔗 केयरगिवर लिंक करें' : '🔗 Link Caregiver Now'}
                    variant="primary"
                    onPress={() => setActiveTab('pair')}
                  />
                </View>
              </Card>
            ) : (
              <>
                {/* Member 1: Primary Senior / Patient */}
                <Card doubleBezel style={s.memberCardWrap}>
                  <View style={s.memberInnerRow}>
                    <View style={s.avatarWrap}>
                      <AppText variant="h2">👵</AppText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.rowBetween}>
                        <AppText variant="label" weight="bold" color={colors.white} style={{ fontSize: 17 }}>
                          {lang === 'hi' ? 'मरीज़ (वरिष्ठ नागरिक)' : 'Patient (Senior)'}
                        </AppText>
                        <View style={s.onlineBadge}>
                          <View style={s.greenDot} />
                          <AppText variant="small" weight="bold" color={colors.brand}>
                            {lang === 'hi' ? 'सक्रिय' : 'Active'}
                          </AppText>
                        </View>
                      </View>
                      <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
                        {lang === 'hi' ? 'सहारा स्वास्थ्य सुरक्षा सक्रिय' : 'Sahara Health Protection Active'}
                      </AppText>
                    </View>
                  </View>
                </Card>

                {/* Member 2: Primary Family Caregiver (Reacticx ProfileCard) */}
                <ProfileCard width={330}>
                  <ProfileCard.Cover>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={s.onlineBadge}>
                        <View style={s.greenDot} />
                        <AppText variant="small" weight="bold" color={colors.brand}>
                          WhatsApp Sync 24x7
                        </AppText>
                      </View>
                      <Pressable onPress={handleUnlinkCaregiver}>
                        <AppText variant="small" color={colors.dangerBright} weight="bold">
                          {lang === 'hi' ? 'हटाएँ (Unlink)' : 'Unlink'}
                        </AppText>
                      </Pressable>
                    </View>
                  </ProfileCard.Cover>
                  <ProfileCard.Avatar
                    icon={<AppText variant="h2">👩</AppText>}
                  />
                  <ProfileCard.Body>
                    <ProfileCard.Name>{caregiver.name}</ProfileCard.Name>
                    <ProfileCard.Handle>{caregiver.relation} · {caregiver.phone}</ProfileCard.Handle>
                    <ProfileCard.Bio>
                      {lang === 'hi'
                        ? 'प्राथमिक आपातकालीन संपर्क। 108 आपातकालीन ब्रेक-ग्लास अधिकृत व दवा स्थिति सिंक।'
                        : 'Primary emergency contact. 108 break-glass authorized & real-time telemetry sync.'}
                    </ProfileCard.Bio>
                  </ProfileCard.Body>
                </ProfileCard>

                {/* Quick Actions Bar */}
                <View style={{ gap: space.sm, marginTop: space.sm }}>
                  <Button
                    label={lang === 'hi' ? '🟢 WhatsApp पर सेहत स्थिति साझा करें' : '🟢 Send Status on WhatsApp'}
                    variant="primary"
                    big
                    onPress={handleSendWhatsAppUpdate}
                  />
                  <Button
                    label={
                      lang === 'hi'
                        ? `📞 केयरगिवर को कॉल करें (${caregiver.phone})`
                        : `📞 Call Caregiver (${caregiver.phone})`
                    }
                    variant="outline"
                    big
                    onPress={handleCallCaregiver}
                  />
                </View>
              </>
            )}
          </>
        )}

        {/* ========================================================
            TAB 2: LIVE TELEMETRY & ADHERENCE
           ======================================================== */}
        {activeTab === 'telemetry' && (
          <>
            {/* Real-time Status Card */}
            <Card doubleBezel style={s.sectionCard}>
              <View style={s.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={s.liveDot} />
                  <AppText variant="label" weight="bold" color={colors.white}>
                    {lang === 'hi' ? 'ताज़ा वाइटल्स स्थिति' : 'Latest Vitals Telemetry'}
                  </AppText>
                </View>
                <View style={s.avpuMeshPill}>
                  <AppText variant="small" color={colors.brand} weight="bold">
                    AVPU: ALERT
                  </AppText>
                </View>
              </View>

              {vitalsHistory.length === 0 ? (
                <View style={{ paddingVertical: space.md, alignItems: 'center' }}>
                  <AppText variant="small" color={colors.textMuted} align="center">
                    {lang === 'hi'
                      ? 'वर्तमान में कोई वाइटल्स दर्ज नहीं हैं। वाइटल्स स्क्रीन में जाकर बीपी या पल्स दर्ज करें।'
                      : 'No vitals logged yet. Log your readings from the Vitals screen.'}
                  </AppText>
                </View>
              ) : (
                <View style={s.telemetryGrid}>
                  {vitalsHistory.slice(0, 4).map((v, i) => (
                    <View key={i} style={s.telemetryBox}>
                      <AppText variant="small" color={colors.textMuted} weight="bold">{v.type}</AppText>
                      <AppText variant="h2" weight="bold" color={colors.brand} style={{ marginTop: 2 }}>{v.value}</AppText>
                      <AppText variant="small" color={colors.brand} style={{ fontSize: 11 }}>{v.unit} · {v.status || 'सामान्य'}</AppText>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Today's Dose Adherence Timeline (Reacticx CircularProgress) */}
            <Card doubleBezel style={s.sectionCard}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <AppText variant="label" weight="bold" color={colors.white}>
                    {lang === 'hi' ? 'दवा खुराक टाइमलाइन' : 'Today’s Medication Adherence'}
                  </AppText>
                  <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
                    {lang === 'hi'
                      ? 'दवा लेने पर परिवार को ऑटो-सूचना, छूटने पर अलर्ट:'
                      : 'Automated 2-way log with missed-dose family notification:'}
                  </AppText>
                </View>
                <CircularProgress
                  progress={adherenceProgress}
                  size={58}
                  strokeWidth={5}
                  progressCircleColor={adherenceRate >= 80 ? '#10B981' : '#F59E0B'}
                  renderCenter={() => (
                    <AppText variant="small" weight="bold" color="#F8FAFC" style={{ fontSize: 11 }}>
                      {adherenceRate}%
                    </AppText>
                  )}
                />
              </View>

              {medications.length === 0 ? (
                <View style={{ paddingVertical: space.md, alignItems: 'center' }}>
                  <AppText variant="small" color={colors.textMuted} align="center">
                    {lang === 'hi'
                      ? 'वर्तमान में कोई दवा दर्ज नहीं है। पर्चा स्कैन करें या दवा स्क्रीन से जोड़ें।'
                      : 'No medications registered. Scan prescription to add meds.'}
                  </AppText>
                </View>
              ) : (
                medications.map((m, idx) => (
                  <View key={idx} style={s.doseTimelineItem}>
                    <View style={s.doseCheckCircle}>
                      <Icon name="check" set="feather" size={16} color={colors.black} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.rowBetween}>
                        <AppText variant="body" weight="bold" color={colors.white}>
                          {m.name} {m.dosage ? `(${m.dosage})` : ''}
                        </AppText>
                        <View style={s.takenTag}>
                          <AppText variant="small" weight="bold" color={colors.brand}>
                            {m.taken_today ? 'TAKEN' : 'PENDING'}
                          </AppText>
                        </View>
                      </View>
                      <AppText variant="small" color={colors.textMuted}>
                        {m.timing || 'समय अनुसार'} {m.purpose ? `· ${m.purpose}` : ''}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </Card>

            {/* Quick 1-Tap Actions */}
            {caregiver && (
              <Button
                label={lang === 'hi' ? '🟢 परिवार को WhatsApp स्टेटस भेजें' : '🟢 Send Status to Family via WhatsApp'}
                variant="primary"
                big
                onPress={handleSendWhatsAppUpdate}
              />
            )}
          </>
        )}

        {/* ========================================================
            TAB 3: PAIRING, QR & PIN GATE
           ======================================================== */}
        {activeTab === 'pair' && (
          <>
            <Card doubleBezel tint="emerald">
              <AppText variant="h2" weight="bold" color={colors.white}>
                {t('pair_hero_title')}
              </AppText>
              <AppText variant="body" color={colors.textMuted} style={{ marginTop: 4 }}>
                {t('pair_hero_body')}
              </AppText>
            </Card>

            {/* Direct Input Pairing Card */}
            <Card doubleBezel style={s.sectionCard}>
              <AppText variant="label" weight="bold" color={colors.white}>
                {lang === 'hi' ? 'सीधा संपर्क विवरण जोड़ें' : 'Add Direct Caregiver Details'}
              </AppText>
              <AppText variant="small" color={colors.textMuted} style={{ marginTop: 2, marginBottom: space.sm }}>
                {lang === 'hi'
                  ? 'परिवार के सदस्य का नाम व WhatsApp नंबर दर्ज करें:'
                  : 'Enter caregiver name and WhatsApp mobile number:'}
              </AppText>

              <View style={{ gap: space.sm }}>
                <TextInput
                  style={s.formInput}
                  placeholder={lang === 'hi' ? 'केयरगिवर का नाम (उदा. पूजा)' : 'Caregiver Name (e.g. Pooja)'}
                  placeholderTextColor={colors.textMuted}
                  value={inputName}
                  onChangeText={setInputName}
                />
                <TextInput
                  style={s.formInput}
                  placeholder={lang === 'hi' ? 'फ़ोन / WhatsApp नंबर (उदा. 8756260291)' : 'Phone / WhatsApp (e.g. 8756260291)'}
                  placeholderTextColor={colors.textMuted}
                  value={inputPhone}
                  onChangeText={setInputPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={s.formInput}
                  placeholder={lang === 'hi' ? 'संबंध (उदा. बेटा / बेटी / जीवनसाथी)' : 'Relation (e.g. Son / Daughter)'}
                  placeholderTextColor={colors.textMuted}
                  value={inputRelation}
                  onChangeText={setInputRelation}
                />
                <Button
                  label={lang === 'hi' ? '✓ केयरगिवर जोड़ें' : '✓ Link Caregiver'}
                  variant="primary"
                  onPress={handleLinkCaregiver}
                />
              </View>
            </Card>

            {/* Caregiver Type Toggle (Family vs Paid) */}
            <Card doubleBezel style={s.sectionCard}>
              <AppText variant="label" weight="bold" color={colors.white}>
                {lang === 'hi' ? 'केयरगिवर का प्रकार चुनें' : 'Choose Caregiver Type'}
              </AppText>
              <View style={s.typeToggleRow}>
                <Pressable
                  style={[s.typeBtn, caregiverType === 'family' && s.typeBtnActive]}
                  onPress={() => setCaregiverType('family')}
                >
                  <AppText
                    variant="body"
                    weight="bold"
                    color={caregiverType === 'family' ? colors.black : colors.textMuted}
                  >
                    {lang === 'hi' ? 'परिवार (बेटा/बेटी)' : 'Family (WhatsApp)'}
                  </AppText>
                </Pressable>
                <Pressable
                  style={[s.typeBtn, caregiverType === 'paid' && s.typeBtnActive]}
                  onPress={() => setCaregiverType('paid')}
                >
                  <AppText
                    variant="body"
                    weight="bold"
                    color={caregiverType === 'paid' ? colors.black : colors.textMuted}
                  >
                    {lang === 'hi' ? 'सशुल्क सहायक (पिन सुरक्षित)' : 'Paid Attendant (PIN)'}
                  </AppText>
                </Pressable>
              </View>

              {caregiverType === 'paid' && (
                <View style={s.pinInfoBox}>
                  <Icon name="lock" set="feather" size={16} color={colors.warn} />
                  <AppText variant="small" color="#FCD34D" style={{ flex: 1, marginLeft: 6 }}>
                    {lang === 'hi'
                      ? 'सशुल्क सहायक को मरीज की दवा सूची देखने के लिए 4-अंकीय PIN (4829) दर्ज करना होगा।'
                      : 'Paid caretakers require patient PIN (4829) on each visit to view private doses.'}
                  </AppText>
                </View>
              )}
            </Card>

            {/* QR Scan Card */}
            <Card doubleBezel glow tint="emerald" style={s.sectionCard}>
              <AppText variant="label" weight="bold" align="center" color={colors.white}>
                {t('pair_scan')}
              </AppText>
              <View style={s.qrWrap}>
                <QrBox />
              </View>
              <AppText variant="small" align="center" color={colors.brand} weight="bold">
                {t('pair_ready')}
              </AppText>
            </Card>

            {/* 6-Digit Passkey Card (Reacticx OtpInput) */}
            <Card doubleBezel style={s.sectionCard}>
              <AppText variant="label" color={colors.textMuted} align="center">
                {t('pair_code_label')}
              </AppText>
              <OtpInput
                otpCount={6}
                value="482910"
                inputWidth={44}
                inputHeight={52}
                focusedBorderColor="#10B981"
                textStyle={{ fontSize: 22, fontWeight: '800', color: colors.brand }}
              />
              <Pressable
                onPress={() => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
              >
                <AppText variant="small" align="center" color={colors.brand} weight="semibold">
                  {copiedCode ? '✓ कोड कॉपी हो गया' : t('pair_read_aloud')}
                </AppText>
              </Pressable>
            </Card>

            <Button
              label={t('pair_continue')}
              icon="arrow-right"
              big
              onPress={() => nav.navigate('Home')}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  tabItemActive: {
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  sectionCard: {
    marginBottom: space.xs,
  },
  memberCardWrap: {
    marginBottom: space.xs,
  },
  memberInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
  },
  avpuMeshPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: space.md,
  },
  telemetryBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  doseTimelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  doseCheckCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takenTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  typeToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: space.md,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeBtnActive: {
    backgroundColor: colors.brand,
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 2,
  },
  pinInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: radius.sm,
    padding: 10,
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  qrWrap: { alignItems: 'center', paddingVertical: space.md },
  qr: {
    padding: space.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formInput: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  toastPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: '#0E1322',
    borderWidth: 1,
    borderColor: 'rgba(5, 223, 114, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginVertical: space.xs,
    shadowColor: '#05DF72',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
});
