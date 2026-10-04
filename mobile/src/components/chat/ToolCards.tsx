import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Linking, Image } from 'react-native';
import { AppText } from '../AppText';
import { Icon } from '../Icon';
import { radius, space, colors } from '../../theme';
import { useApp } from '../../context/AppContext';
import { ReceiptCard } from '../reacticx';

// ==========================================
// 1. HOSPITAL & PHC FINDER CARD
// ==========================================
export function HospitalCard({
  title,
  subtitle,
  doctor,
  phone = '9876543210',
  directionsUrl,
  staticMapUrl,
  latitude,
  longitude,
  address,
  travelTime,
  distanceKm,
  onCall108,
}: {
  title?: string;
  subtitle?: string;
  doctor?: string;
  phone?: string;
  directionsUrl?: string;
  staticMapUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  travelTime?: string;
  distanceKm?: number;
  onCall108?: () => void;
}) {
  const { t } = useApp();
  const displayTitle = title ?? t('voice_card_facility_title');
  const displaySubtitle = subtitle ?? t('voice_card_facility_sub');

  const handleDirections = () => {
    if (directionsUrl) {
      Linking.openURL(directionsUrl).catch(() => {});
    } else if (latitude && longitude) {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
      ).catch(() => {});
    } else {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayTitle)}`,
      ).catch(() => {});
    }
  };

  return (
    <View style={s.cardContainer}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeHospital}>
          <Icon name="hospital-building" set="mci" size={20} color="#2DD4BF" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowBetween}>
            <AppText variant="label" weight="bold" color="#F3F4F6">
              {displayTitle}
            </AppText>
            <View style={s.openBadge}>
              <AppText variant="small" weight="bold" color="#10B981">
                {t('card_open')}
              </AppText>
            </View>
          </View>
          <AppText variant="small" color="#9CA3AF" style={{ marginTop: 2 }}>
            {displaySubtitle}
          </AppText>
        </View>
      </View>

      {address ? (
        <View style={s.addressRow}>
          <Icon name="map-pin" set="feather" size={13} color="#9CA3AF" />
          <AppText variant="small" color="#9CA3AF" numberOfLines={1} style={{ flex: 1 }}>
            {address}
          </AppText>
        </View>
      ) : null}

      {doctor ? (
        <View style={s.infoPill}>
          <Icon name="doctor" set="mci" size={16} color="#A78BFA" />
          <AppText variant="small" weight="medium" color="#E5E7EB">
            डॉक्टर: {doctor}
          </AppText>
        </View>
      ) : null}

      {/* Mini-Map Visual Preview */}
      <Pressable onPress={handleDirections} style={s.mapPreviewWrap}>
        <Image
          source={{
            uri:
              staticMapUrl ||
              (latitude && longitude
                ? `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=400x160&markers=${latitude},${longitude},ol-marker`
                : `https://staticmap.openstreetmap.de/staticmap.php?center=28.6139,77.2090&zoom=14&size=400x160`),
          }}
          style={s.mapImage}
          resizeMode="cover"
        />
        <View style={s.mapBadgeOverlay}>
          <Icon name="navigation" set="feather" size={12} color="#FFFFFF" />
          <AppText variant="small" weight="bold" color="#FFFFFF" style={{ fontSize: 11 }}>
            {distanceKm ? `${distanceKm} km` : 'नज़दीक'} {travelTime ? `· ${travelTime}` : ''}
          </AppText>
        </View>
        <View style={s.mapTapHint}>
          <AppText variant="small" color="#E2E8F0" style={{ fontSize: 10, fontWeight: '600' }}>
            Google Maps में रास्ता देखें →
          </AppText>
        </View>
      </Pressable>

      <View style={s.btnRow}>
        <Pressable
          style={[s.actionBtn, s.primaryActionBtn]}
          onPress={() => Linking.openURL(`tel:${phone}`).catch(() => {})}
        >
          <Icon name="phone" set="feather" size={15} color="#FFFFFF" />
          <AppText variant="small" weight="bold" color="#FFFFFF">
            {t('card_call')}
          </AppText>
        </Pressable>

        <Pressable
          style={[s.actionBtn, s.secondaryActionBtn]}
          onPress={handleDirections}
        >
          <Icon name="navigation" set="feather" size={15} color="#2DD4BF" />
          <AppText variant="small" weight="bold" color="#2DD4BF">
            दिशा निर्देश (Map)
          </AppText>
        </Pressable>

        <Pressable
          style={[s.actionBtn, s.emergencyActionBtn]}
          onPress={() => {
            if (onCall108) onCall108();
            else Linking.openURL('tel:108').catch(() => {});
          }}
        >
          <Icon name="alert-octagon" set="feather" size={15} color="#EF4444" />
          <AppText variant="small" weight="bold" color="#EF4444">
            108
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

// ==========================================
// 2. MEDICATION & JAN AUSHADHI CARD
// ==========================================
export function MedicationCard({
  name,
  timing,
  genericSavings,
  initialTaken = false,
}: {
  name?: string;
  timing?: string;
  genericSavings?: string;
  initialTaken?: boolean;
}) {
  const { t } = useApp();
  const [taken, setTaken] = useState(initialTaken);

  return (
    <View style={s.cardContainer}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeMeds}>
          <Icon name="pill" set="mci" size={20} color="#38BDF8" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowBetween}>
            <AppText variant="label" weight="bold" color="#F3F4F6">
              {name ?? t('med_amlo_name')}
            </AppText>
            <View style={taken ? s.takenBadge : s.pendingBadge}>
              <AppText variant="small" weight="bold" color={taken ? '#10B981' : '#F59E0B'}>
                {taken ? t('card_taken') : t('card_pending')}
              </AppText>
            </View>
          </View>
          <AppText variant="small" color="#9CA3AF" style={{ marginTop: 2 }}>
            {t('card_time')}: {timing ?? t('med_amlo_time')}
          </AppText>
        </View>
      </View>

      {genericSavings ? (
        <View style={s.savingsBanner}>
          <Icon name="tag-outline" set="mci" size={16} color="#10B981" />
          <AppText variant="small" weight="semibold" color="#10B981">
            {genericSavings}
          </AppText>
        </View>
      ) : null}

      <Pressable
        style={[s.fullWidthBtn, taken ? s.btnTaken : s.btnNotTaken]}
        onPress={() => setTaken(!taken)}
      >
        <Icon
          name={taken ? 'check-circle' : 'check'}
          set="feather"
          size={18}
          color={taken ? '#10B981' : '#FFFFFF'}
        />
        <AppText variant="label" weight="bold" color={taken ? '#10B981' : '#FFFFFF'}>
          {taken ? t('card_marked_taken') : t('card_mark_taken')}
        </AppText>
      </Pressable>
    </View>
  );
}

// ==========================================
// 2b. JAN AUSHADHI GENERIC SAVINGS CARD
// ==========================================
export function SavingsCard({
  title,
  subtitle,
  savingsPercent,
  brandPrice,
  genericPrice,
  genericName,
  findStoreUrl,
}: {
  title?: string;
  subtitle?: string;
  savingsPercent?: string;
  brandPrice?: string;
  genericPrice?: string;
  genericName?: string;
  findStoreUrl?: string;
}) {
  const storeUrl =
    findStoreUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Pradhan Mantri Jan Aushadhi Kendra near me')}`;

  return (
    <View style={{ marginVertical: 6, alignItems: 'center' }}>
      <ReceiptCard dark width={310}>
        <ReceiptCard.TornEdge side="top" />
        <ReceiptCard.Header>
          <ReceiptCard.Store>जन औषधि केंद्र</ReceiptCard.Store>
          <ReceiptCard.Meta>PRADHAN MANTRI BHARTIYA JANAUSHADHI</ReceiptCard.Meta>
        </ReceiptCard.Header>
        <ReceiptCard.Separator variant="dashed" />
        <ReceiptCard.Items>
          {brandPrice ? (
            <ReceiptCard.Item
              label="ब्रांडेड MRP"
              value={brandPrice}
              sublabel={genericName ? `सॉल्ट: ${genericName}` : undefined}
            />
          ) : null}
          {genericPrice ? (
            <ReceiptCard.Item
              label="जन औषधि जेनेरिक"
              value={genericPrice}
              valueStyle={{ color: '#10B981', fontWeight: '800' }}
            />
          ) : null}
        </ReceiptCard.Items>
        <ReceiptCard.Separator variant="dashed" />
        <ReceiptCard.Total
          label="कुल बचत"
          value={savingsPercent ? `${savingsPercent} छूट` : '80% तक बचत'}
          saving="सरकारी प्रमाण पत्र ✓"
        />
        <ReceiptCard.Barcode code="PMBJP-SAHARA-Rx" />
        <ReceiptCard.TornEdge side="bottom" />
      </ReceiptCard>

      <Pressable
        style={[s.actionBtn, s.primaryActionBtn, { width: 310, marginTop: 6 }]}
        onPress={() => Linking.openURL(storeUrl).catch(() => {})}
      >
        <Icon name="map-pin" set="feather" size={15} color="#FFFFFF" />
        <AppText variant="small" weight="bold" color="#FFFFFF">
          नज़दीकी केंद्र खोजें (Jan Aushadhi)
        </AppText>
      </Pressable>
    </View>
  );
}

// ==========================================
// 2c. GOVERNMENT HEALTH SCHEME CARD
// ==========================================
export function SchemeCard({
  scheme,
  summary,
  coverageAmount,
  benefits,
  eligibility,
  helpline = '14555',
  portalUrl,
}: {
  scheme?: string;
  summary?: string;
  coverageAmount?: string;
  benefits?: string[];
  eligibility?: string;
  helpline?: string;
  portalUrl?: string;
}) {
  const displayTitle = scheme ?? 'आयुष्मान भारत (AB-PMJAY)';
  const displaySub = summary ?? 'सरकारी स्वास्थ्य कल्याण योजना';

  return (
    <View style={[s.cardContainer, s.schemeContainer]}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeScheme}>
          <Icon name="shield" set="feather" size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowBetween}>
            <AppText variant="label" weight="bold" color="#FDE68A" numberOfLines={1} style={{ flex: 1 }}>
              {displayTitle}
            </AppText>
            <View style={s.schemeBadge}>
              <AppText variant="small" weight="bold" color="#F59E0B">
                सरकारी योजना
              </AppText>
            </View>
          </View>
          <AppText variant="small" color="#D1D5DB" style={{ marginTop: 2 }}>
            {displaySub}
          </AppText>
        </View>
      </View>

      {coverageAmount ? (
        <View style={s.coverageBox}>
          <AppText variant="small" color="#9CA3AF">वित्तीय सुरक्षा / कवरेज</AppText>
          <AppText variant="label" weight="bold" color="#10B981" style={{ fontSize: 16, marginTop: 2 }}>
            {coverageAmount}
          </AppText>
        </View>
      ) : null}

      {benefits && benefits.length > 0 ? (
        <View style={{ marginTop: space.sm }}>
          {benefits.slice(0, 3).map((b, idx) => (
            <View key={idx} style={s.benefitRow}>
              <View style={{ marginTop: 2 }}>
                <Icon name="check-circle" set="feather" size={13} color="#10B981" />
              </View>
              <AppText variant="small" color="#E5E7EB" style={{ flex: 1 }}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      {eligibility ? (
        <View style={s.infoPill}>
          <Icon name="info" set="feather" size={14} color="#F59E0B" />
          <AppText variant="small" color="#D1D5DB" numberOfLines={2} style={{ flex: 1 }}>
            पात्रता: {eligibility}
          </AppText>
        </View>
      ) : null}

      <View style={s.btnRow}>
        <Pressable
          style={[s.actionBtn, s.schemeHelplineBtn]}
          onPress={() => Linking.openURL(`tel:${helpline}`).catch(() => {})}
        >
          <Icon name="phone-call" set="feather" size={15} color="#FFFFFF" />
          <AppText variant="small" weight="bold" color="#FFFFFF">
            हेल्पलाइन {helpline}
          </AppText>
        </Pressable>

        {portalUrl ? (
          <Pressable
            style={[s.actionBtn, s.secondaryActionBtn]}
            onPress={() => Linking.openURL(portalUrl).catch(() => {})}
          >
            <Icon name="external-link" set="feather" size={15} color="#F59E0B" />
            <AppText variant="small" weight="bold" color="#F59E0B">
              पोर्टल देखें
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ==========================================
// 3. VITALS TELEMETRY BENTO CARD
// ==========================================
export function VitalsCard({
  bp = '120/80',
  sugar = '110',
  pulse = '72',
  spo2 = '98',
  status,
}: {
  bp?: string;
  sugar?: string;
  pulse?: string;
  spo2?: string;
  status?: string;
}) {
  const { t } = useApp();
  return (
    <View style={s.cardContainer}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeVitals}>
          <Icon name="heart-pulse" set="mci" size={20} color="#F43F5E" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" weight="bold" color="#F3F4F6">
            {t('card_vitals_title')}
          </AppText>
          <AppText variant="small" color="#9CA3AF">
            {t('card_vitals_sub')}
          </AppText>
        </View>
      </View>

      <View style={s.bentoGrid}>
        <View style={s.bentoCell}>
          <AppText variant="small" color="#9CA3AF">{t('card_bp')}</AppText>
          <AppText variant="h2" weight="bold" color="#F3F4F6">{bp}</AppText>
          <AppText variant="small" weight="medium" color="#10B981">
            mmHg · {t('card_normal')}
          </AppText>
        </View>

        <View style={s.bentoCell}>
          <AppText variant="small" color="#9CA3AF">{t('card_sugar')}</AppText>
          <AppText variant="h2" weight="bold" color="#F3F4F6">{sugar}</AppText>
          <AppText variant="small" weight="medium" color="#10B981">
            mg/dL · {t('card_fasting')}
          </AppText>
        </View>

        <View style={s.bentoCell}>
          <AppText variant="small" color="#9CA3AF">{t('card_pulse')}</AppText>
          <AppText variant="h2" weight="bold" color="#F3F4F6">{pulse}</AppText>
          <AppText variant="small" weight="medium" color="#38BDF8">
            bpm · {t('card_stable')}
          </AppText>
        </View>

        <View style={s.bentoCell}>
          <AppText variant="small" color="#9CA3AF">{t('card_spo2')}</AppText>
          <AppText variant="h2" weight="bold" color="#F3F4F6">{spo2}%</AppText>
          <AppText variant="small" weight="medium" color="#10B981">
            {t('card_healthy')}
          </AppText>
        </View>
      </View>

      <View style={s.statusPill}>
        <Icon name="check-circle" set="feather" size={14} color="#10B981" />
        <AppText variant="small" weight="medium" color="#E5E7EB">
          {status || t('card_vitals_status')}
        </AppText>
      </View>
    </View>
  );
}

// ==========================================
// 4. EMERGENCY TRIAGE CARD
// ==========================================
export function EmergencyCard({
  title,
  description,
  onOpenSOS,
  onCall108,
}: {
  title?: string;
  description?: string;
  onOpenSOS?: () => void;
  onCall108?: () => void;
}) {
  const { t } = useApp();
  return (
    <View style={[s.cardContainer, s.emergencyContainer]}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeEmergency}>
          <Icon name="alert-triangle" set="feather" size={22} color="#EF4444" />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="label" weight="bold" color="#FCA5A5">
            {title ?? t('card_sos_title')}
          </AppText>
          <AppText variant="small" color="#FECACA" style={{ marginTop: 2 }}>
            {description ?? t('card_sos_desc')}
          </AppText>
        </View>
      </View>

      <View style={s.btnRow}>
        <Pressable style={[s.actionBtn, s.emergencyPrimaryBtn]} onPress={onOpenSOS}>
          <Icon name="shield" set="feather" size={16} color="#FFFFFF" />
          <AppText variant="small" weight="bold" color="#FFFFFF">
            {t('card_sos_open')}
          </AppText>
        </Pressable>

        <Pressable
          style={[s.actionBtn, s.emergencySecondaryBtn]}
          onPress={() => {
            if (onCall108) onCall108();
            else Linking.openURL('tel:108').catch(() => {});
          }}
        >
          <Icon name="phone-call" set="feather" size={16} color="#EF4444" />
          <AppText variant="small" weight="bold" color="#EF4444">
            {t('card_call_108')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

// ==========================================
// 5. CAREGIVER ESCALATION CARD (WhatsApp & Call, NO SMS)
// ==========================================
export function CaregiverEscalationCard({
  caregiver = 'रमेश (बेटा / Caregiver)',
  phone = '+91 98765 00001',
  reason,
  urgency = 'medium',
  whatsappUrl,
  callUrl,
}: {
  caregiver?: string;
  phone?: string;
  reason?: string;
  urgency?: string;
  whatsappUrl?: string;
  callUrl?: string;
}) {
  const finalWhatsapp =
    whatsappUrl ||
    `https://wa.me/919876500001?text=${encodeURIComponent(
      `🚨 सहारा केयर अलर्ट: रामपाल जी को सहायता की आवश्यकता है। स्थिति: ${reason || 'सहायता अनुरोध'}। कृपया संपर्क करें।`
    )}`;
  const finalCall = callUrl || `tel:${phone.replace(/\s+/g, '')}`;

  return (
    <View style={[s.cardContainer, s.caregiverContainer]}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeCaregiver}>
          <Icon name="user-check" set="feather" size={20} color="#10B981" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowBetween}>
            <AppText variant="label" weight="bold" color="#F3F4F6">
              {caregiver}
            </AppText>
            <View style={s.whatsappActiveBadge}>
              <Icon name="message-circle" set="feather" size={12} color="#25D366" />
              <AppText variant="small" weight="bold" color="#25D366">
                वॉट्सऐप अलर्ट
              </AppText>
            </View>
          </View>
          <AppText variant="small" color="#9CA3AF" style={{ marginTop: 2 }}>
            {phone} · परिवार सहायता
          </AppText>
        </View>
      </View>

      {reason ? (
        <View style={s.infoPill}>
          <Icon name="info" set="feather" size={14} color="#60A5FA" />
          <AppText variant="small" color="#E5E7EB" numberOfLines={2} style={{ flex: 1 }}>
            कारण: {reason}
          </AppText>
        </View>
      ) : null}

      <View style={s.privacyTagRow}>
        <Icon name="shield-check" set="mci" size={14} color="#10B981" />
        <AppText variant="small" color="#9CA3AF">
          त्वरित वॉट्सऐप व डायरेक्ट कॉल (SMS मुक्त · 100% निःशुल्क)
        </AppText>
      </View>

      <View style={s.btnRow}>
        <Pressable
          style={[s.actionBtn, s.whatsappBtn]}
          onPress={() => Linking.openURL(finalWhatsapp).catch(() => {})}
        >
          <Icon name="message-circle" set="feather" size={16} color="#FFFFFF" />
          <AppText variant="small" weight="bold" color="#FFFFFF">
            वॉट्सऐप खोलें
          </AppText>
        </Pressable>

        <Pressable
          style={[s.actionBtn, s.caregiverCallBtn]}
          onPress={() => Linking.openURL(finalCall).catch(() => {})}
        >
          <Icon name="phone" set="feather" size={16} color="#FFFFFF" />
          <AppText variant="small" weight="bold" color="#FFFFFF">
            सीधे कॉल करें
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

// ==========================================
// 6. CLOCK-AWARE REMINDER CARD
// ==========================================
export function ReminderCard({
  title = 'दवा की खुराक',
  time = 'समय पर',
  formattedTime,
  active = true,
}: {
  title?: string;
  time?: string;
  formattedTime?: string;
  active?: boolean;
}) {
  const [isActive, setIsActive] = useState(active);

  return (
    <View style={[s.cardContainer, s.reminderContainer]}>
      <View style={s.cardHeader}>
        <View style={s.iconBadgeReminder}>
          <Icon name="bell" set="feather" size={20} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.rowBetween}>
            <AppText variant="label" weight="bold" color="#F3F4F6">
              {title}
            </AppText>
            <View style={isActive ? s.alarmActiveBadge : s.alarmOffBadge}>
              <AppText variant="small" weight="bold" color={isActive ? '#10B981' : '#9CA3AF'}>
                {isActive ? 'अलार्म चालू ✓' : 'बंद'}
              </AppText>
            </View>
          </View>
          <AppText variant="small" color="#9CA3AF" style={{ marginTop: 2 }}>
            नियत समय: {formattedTime || time}
          </AppText>
        </View>
      </View>

      <View style={s.reminderClockBox}>
        <Icon name="clock" set="feather" size={18} color="#F59E0B" />
        <AppText variant="h2" weight="bold" color="#F59E0B">
          {formattedTime || time}
        </AppText>
        <AppText variant="small" color="#9CA3AF" style={{ marginLeft: 'auto' }}>
          IST लाइव क्लॉक
        </AppText>
      </View>

      <Pressable
        style={[s.fullWidthBtn, isActive ? s.btnAlarmActive : s.btnAlarmOff]}
        onPress={() => setIsActive(!isActive)}
      >
        <Icon
          name={isActive ? 'bell' : 'bell-off'}
          set="feather"
          size={16}
          color={isActive ? '#FFFFFF' : '#9CA3AF'}
        />
        <AppText variant="small" weight="bold" color={isActive ? '#FFFFFF' : '#9CA3AF'}>
          {isActive ? 'फोन में रिमाइंडर सक्रिय (घंटी बजेगी)' : 'रिमाइंडर पुनः सक्रिय करें'}
        </AppText>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  cardContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    marginVertical: space.xs,
  },
  emergencyContainer: { backgroundColor: colors.dangerTint, borderColor: colors.dangerDeep },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBadgeHospital: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeMeds: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeSavings: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeVitals: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeEmergency: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  pendingBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  takenBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#262626',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    marginTop: space.sm,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  btnRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  primaryActionBtn: { backgroundColor: colors.accent },
  secondaryActionBtn: { backgroundColor: '#262626', borderWidth: 1, borderColor: '#374151' },
  emergencyActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    flex: 0.6,
  },
  fullWidthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.pill,
    marginTop: space.sm,
  },
  btnNotTaken: { backgroundColor: colors.accent },
  btnTaken: { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: '#10B981' },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.sm },
  bentoCell: {
    width: '48.5%',
    backgroundColor: colors.surfaceContainer,
    borderRadius: radius.sm,
    padding: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 8,
    marginTop: space.sm,
  },
  emergencyPrimaryBtn: { backgroundColor: '#DC2626' },
  emergencySecondaryBtn: { backgroundColor: '#262626', borderWidth: 1, borderColor: '#7F1D1D' },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  iconBadgeScheme: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schemeContainer: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: '#1C1917',
  },
  schemeBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  coverageBox: {
    backgroundColor: '#292524',
    borderRadius: radius.sm,
    padding: space.sm,
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  schemeHelplineBtn: {
    backgroundColor: '#D97706',
  },
  priceGrid: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.sm,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#262626',
    borderRadius: radius.sm,
    padding: space.sm,
    borderWidth: 1,
    borderColor: '#374151',
  },
  priceBoxGeneric: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  caregiverContainer: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: '#0F1F17',
  },
  iconBadgeCaregiver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  privacyTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
  },
  caregiverCallBtn: {
    backgroundColor: '#2563EB',
  },
  reminderContainer: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: '#1C1917',
  },
  iconBadgeReminder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alarmActiveBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  alarmOffBadge: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  reminderClockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#262626',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  btnAlarmActive: {
    backgroundColor: '#D97706',
  },
  btnAlarmOff: {
    backgroundColor: '#262626',
    borderWidth: 1,
    borderColor: '#374151',
  },
  mapPreviewWrap: {
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.3)',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapBadgeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  mapTapHint: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
});
