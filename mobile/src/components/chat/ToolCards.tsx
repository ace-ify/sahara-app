import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import { AppText } from '../AppText';
import { Icon } from '../Icon';
import { radius, space, colors } from '../../theme';
import { useApp } from '../../context/AppContext';

// ==========================================
// CLINICAL DESIGN TOKENS (ToolCards-local)
// Obsidian core + hairline border + calibrated accents.
// ==========================================
const T = {
  core: '#141B2D',                                // inner double-bezel core
  surface: colors.surface,                        // #0E1322 outer card
  hairline: 'rgba(255, 255, 255, 0.08)',          // 1px subtle border
  hairlineSoft: 'rgba(255, 255, 255, 0.05)',
  emerald: '#05DF72',                             // precision emerald accent
  emeraldDim: 'rgba(5, 223, 114, 0.12)',
  emeraldBorder: 'rgba(5, 223, 114, 0.30)',
  amber: '#F59E0B',                               // clinical amber
  amberDim: 'rgba(245, 158, 11, 0.10)',
  amberBorder: 'rgba(245, 158, 11, 0.30)',
  crimson: '#EF4444',                             // alert crimson (reserved)
  crimsonDim: 'rgba(239, 68, 68, 0.10)',
  crimsonBorder: 'rgba(239, 68, 68, 0.32)',
  text: '#F3F4F6',
  sub: '#94A3B8',
  dim: '#64748B',
} as const;

const BTN_H = 38; // standardized action-pill height

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {});
}

// Shared compact card shell — strict height budget keeps chat flow unblocked.
function CardShell({ accent, children }: { accent?: 'emerald' | 'amber' | 'crimson' | null; children: React.ReactNode }) {
  const border =
    accent === 'emerald' ? T.emeraldBorder : accent === 'amber' ? T.amberBorder : accent === 'crimson' ? T.crimsonBorder : T.hairline;
  return (
    <View style={s.shell}>
      <View style={[s.core, { borderColor: border }]}>
        {children}
      </View>
    </View>
  );
}

// Compact 2-slot header: icon + title + status pill
function CardHeader({ icon, iconColor, title, pill, pillColor }: { icon: string; iconColor: string; title: string; pill?: string; pillColor?: string }) {
  return (
    <View style={s.header}>
      <Icon name={icon} set="feather" size={16} color={iconColor} />
      <AppText variant="label" weight="bold" color={T.text} numberOfLines={1} style={{ flex: 1, marginLeft: 8 }}>
        {title}
      </AppText>
      {pill ? (
        <View style={[s.statusPill, pillColor ? { borderColor: pillColor } : null]}>
          <AppText variant="small" weight="bold" color={pillColor || T.emerald} style={{ fontSize: 10 }}>
            {pill}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

// Tactile Geo-Pill — replaces the bloated 120px static map. One tap → native maps.
function GeoPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={s.geoPill} onPress={onPress}>
      <Icon name="map-pin" set="feather" size={12} color={T.emerald} />
      <AppText variant="small" weight="semibold" color={T.text} numberOfLines={1} style={{ flex: 1, fontSize: 11 }}>
        {label}
      </AppText>
      <Icon name="arrow-up-right" set="feather" size={12} color={T.sub} />
    </Pressable>
  );
}

// Standard action row: 38px rounded pills.
function ActionRow({ children }: { children: React.ReactNode }) {
  return <View style={s.btnRow}>{children}</View>;
}

function ActionPill({
  icon,
  label,
  onPress,
  tone = 'emerald',
  flex = 1,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  tone?: 'emerald' | 'amber' | 'crimson' | 'neutral';
  flex?: number;
}) {
  const color = tone === 'amber' ? T.amber : tone === 'crimson' ? T.crimson : tone === 'neutral' ? T.sub : T.emerald;
  const border = tone === 'amber' ? T.amberBorder : tone === 'crimson' ? T.crimsonBorder : tone === 'neutral' ? T.hairline : T.emeraldBorder;
  const bg = tone === 'amber' ? T.amberDim : tone === 'crimson' ? T.crimsonDim : tone === 'neutral' ? 'rgba(255,255,255,0.03)' : T.emeraldDim;
  return (
    <Pressable style={[s.actionBtn, { height: BTN_H, borderColor: border, backgroundColor: bg, flex }]} onPress={onPress}>
      <Icon name={icon} set="feather" size={14} color={color} />
      <AppText variant="small" weight="bold" color={color} numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ==========================================
// 1. HOSPITAL & PHC FINDER CARD (Geo-Pill, no static map)
// ==========================================
export function HospitalCard({
  title,
  subtitle,
  doctor,
  phone = '108',
  directionsUrl,
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
  const displaySubtitle = subtitle ?? t('voice_card_sub');

  const mapsUrl =
    directionsUrl ||
    (latitude != null && longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayTitle)}`);

  const geoLabel = [
    '📍',
    distanceKm != null ? `${distanceKm} km` : 'नज़दीक',
    displayTitle.length > 26 ? 'नज़दीकी स्वास्थ्य केंद्र' : displayTitle,
    'Google Maps में देखें ↗',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={s.wrap}>
      <CardShell accent="emerald">
        <CardHeader
          icon="plus-square"
          iconColor={T.emerald}
          title={displayTitle}
          pill={t('card_open')}
          pillColor={T.emerald}
        />
        {displaySubtitle ? (
          <AppText variant="small" color={T.sub} numberOfLines={1} style={s.subLine}>
            {displaySubtitle}
          </AppText>
        ) : null}
        <GeoPill label={geoLabel} onPress={() => openUrl(mapsUrl)} />
        <ActionRow>
          <ActionPill
            icon="phone"
            label={t('card_call')}
            onPress={() => openUrl(`tel:${(phone || '108').replace(/\s+/g, '')}`)}
          />
          <ActionPill icon="navigation" label="रास्ता" onPress={() => openUrl(mapsUrl)} />
          <ActionPill
            icon="alert-octagon"
            label="108"
            tone="crimson"
            flex={0.5}
            onPress={() => (onCall108 ? onCall108() : openUrl('tel:108'))}
          />
        </ActionRow>
      </CardShell>
    </View>
  );
}

// ==========================================
// 2. MEDICATION CARD
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
    <View style={s.wrap}>
      <CardShell accent={taken ? 'emerald' : 'amber'}>
        <CardHeader
          icon="pill"
          iconColor={taken ? T.emerald : T.amber}
          title={name ?? t('med_amlo_name')}
          pill={taken ? t('card_taken') : t('card_pending')}
          pillColor={taken ? T.emerald : T.amber}
        />
        {timing ? (
          <AppText variant="small" color={T.sub} numberOfLines={1} style={s.subLine}>
            {t('card_time')}: {timing}
          </AppText>
        ) : null}
        {genericSavings ? (
          <View style={s.savingsChip}>
            <Icon name="tag" set="feather" size={11} color={T.emerald} />
            <AppText variant="small" weight="semibold" color={T.emerald} numberOfLines={1} style={{ fontSize: 11, flex: 1 }}>
              {genericSavings}
            </AppText>
          </View>
        ) : null}
        <ActionRow>
          <ActionPill
            icon={taken ? 'check-circle' : 'check'}
            label={taken ? t('card_marked_taken') : t('card_mark_take')}
            tone={taken ? 'emerald' : 'emerald'}
            onPress={() => setTaken(!taken)}
          />
        </ActionRow>
      </CardShell>
    </View>
  );
}

// ==========================================
// 2b. JAN AUSHADHI SAVINGS CARD (segmented price pills)
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
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Pradhan Mantri Jan Aushadhi Kendra')}`;
  const savings = savingsPercent || '';
  const isUnlisted = !genericPrice || genericPrice === '—';

  // Real numeric prices for the proportional bar: strip "₹35 (15 गोलियां)" → 35
  const rupees = (p?: string) => {
    const m = (p || '').match(/₹\s*(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  };
  const brandNum = rupees(brandPrice);
  const jaNum = rupees(genericPrice);
  const pct = (() => {
    const m = (savings || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })();
  const barPct = brandNum && jaNum && brandNum > 0 ? Math.round((1 - jaNum / brandNum) * 100) : pct;
  // सॉल्ट from the title ("Amlodipine 5mg - जन औषधि बचत") → cleaner header line
  const medName = (title || '').replace(/\s*[-–]\s*जन औषधि.*$/, '').trim();
  const saltLabel = genericName || medName;
  const brandLabel = (title || '').includes('जन औषधि') ? 'ब्रांडेड MRP' : 'ब्रांडेड';

  return (
    <View style={s.wrap}>
      <CardShell accent={isUnlisted ? 'amber' : 'emerald'}>
        <CardHeader
          icon="tag"
          iconColor={T.emerald}
          title={saltLabel || 'जन औषधि बचत'}
          pill={isUnlisted ? 'केंद्र पर पूछें' : savings ? `बचत ${savings}` : undefined}
          pillColor={T.emerald}
        />

        {/* Price ledger — big numbers, unit captions, aligned decimal-style */}
        <View style={s.ledgerRow}>
          <View style={s.ledgerCell}>
            <AppText variant="small" color={T.dim} style={{ fontSize: 10, letterSpacing: 0.5 }}>
              {brandLabel}
            </AppText>
            <AppText variant="h2" weight="bold" color={T.text} style={{ fontSize: 24, lineHeight: 30 }}>
              {brandNum != null ? `₹${brandNum % 1 ? brandNum.toFixed(1) : brandNum}` : '—'}
            </AppText>
            <AppText variant="small" color={T.dim} numberOfLines={1} style={{ fontSize: 9.5 }}>
              {(() => {
                const m = (brandPrice || '').match(/\(([^)]+)\)/);
                return m ? m[1] : '';
              })()}
            </AppText>
          </View>
          <View style={s.ledgerDivider} />
          <View style={[s.ledgerCell, { alignItems: 'flex-end' }]}>
            <AppText variant="small" color={T.emerald} style={{ fontSize: 10, letterSpacing: 0.5 }}>
              जन औषधि
            </AppText>
            <AppText variant="h2" weight="bold" color={T.emerald} style={{ fontSize: 24, lineHeight: 30 }}>
              {jaNum != null ? `₹${jaNum % 1 ? jaNum.toFixed(1) : jaNum}` : '—'}
            </AppText>
            <AppText variant="small" color={T.dim} numberOfLines={1} style={{ fontSize: 9.5 }}>
              {(() => {
                const m = (genericPrice || '').match(/\(([^)]+)\)/);
                return m ? m[1] : '';
              })()}
            </AppText>
          </View>
        </View>

        {/* Proportional savings bar — width IS the savings percent */}
        {barPct != null && barPct > 0 && !isUnlisted ? (
          <View style={s.saveTrack}>
            <View style={[s.saveFill, { width: `${Math.min(barPct, 96)}%` }]} />
            <View style={s.saveLabelWrap}>
              <Icon name="trending-down" set="feather" size={11} color={T.emerald} />
              <AppText variant="small" weight="bold" color={T.emerald} style={{ fontSize: 10 }}>
                {barPct}% तक बचत · समान गुणवत्ता
              </AppText>
            </View>
          </View>
        ) : null}

        {/* PMBJP provenance line — trust cue, not decoration */}
        <View style={s.provenanceRow}>
          <View style={s.jaDot} />
          <AppText variant="small" color={T.sub} numberOfLines={1} style={{ fontSize: 10, flex: 1 }}>
            PMBJP · भारत सरकार सत्यापित जेनेरिक
          </AppText>
          <AppText variant="small" color={T.dim} style={{ fontSize: 9, letterSpacing: 0.4 }}>
            जन औषधि केंद्र
          </AppText>
        </View>

        <ActionRow>
          <ActionPill icon="map-pin" label="नज़दीकी जन औषधि केंद्र" onPress={() => openUrl(storeUrl)} />
        </ActionRow>
      </CardShell>
    </View>
  );
}

// ==========================================
// 2c. GOVERNMENT SCHEME CARD
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
  return (
    <View style={s.wrap}>
      <CardShell accent="amber">
        <CardHeader
          icon="shield"
          iconColor={T.amber}
          title={scheme || 'आयुष्मान भारत (AB-PMJAY)'}
          pill="सरकारी योजना"
          pillColor={T.amber}
        />
        {coverageAmount ? (
          <View style={s.coverageChip}>
            <AppText variant="small" color={T.dim} style={{ fontSize: 10 }}>
              कवरेज
            </AppText>
            <AppText variant="label" weight="bold" color={T.emerald} style={{ fontSize: 14 }}>
              {coverageAmount}
            </AppText>
          </View>
        ) : null}
        {summary ? (
          <AppText variant="small" color={T.sub} numberOfLines={2} style={s.subLine}>
            {summary}
          </AppText>
        ) : null}
        {benefits && benefits.length > 0 ? (
          <View style={s.benefitCol}>
            {benefits.slice(0, 2).map((b, i) => (
              <View key={i} style={s.benefitRow}>
                <Icon name="check" set="feather" size={11} color={T.emerald} />
                <AppText variant="small" color={T.text} numberOfLines={1} style={{ flex: 1, fontSize: 11 }}>
                  {b}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <ActionRow>
          <ActionPill icon="phone-call" label={`हेल्पलाइन ${helpline}`} tone="amber" onPress={() => openUrl(`tel:${helpline}`)} />
          {portalUrl ? <ActionPill icon="external-link" label="पोर्टल" tone="neutral" flex={0.5} onPress={() => openUrl(portalUrl)} /> : null}
        </ActionRow>
      </CardShell>
    </View>
  );
}

// ==========================================
// 3. VITALS CARD (single reading + band)
// ==========================================
export function VitalsCard({
  bp = '--/--',
  sugar = '--',
  pulse = '--',
  spo2 = '--',
  status,
  band,
}: {
  bp?: string;
  sugar?: string;
  pulse?: string;
  spo2?: string;
  status?: string;
  band?: 'GREEN' | 'ORANGE' | 'YELLOW' | 'RED';
}) {
  const { t } = useApp();
  const bandLabel = band === 'RED' ? 'क्रिटिकल अलर्ट' : band === 'ORANGE' ? 'मध्यम जोखिम' : band === 'YELLOW' ? 'हल्का ध्यान' : 'सामान्य';
  const bandColor = band === 'RED' ? T.crimson : band === 'ORANGE' ? T.amber : band === 'YELLOW' ? T.amber : T.emerald;

  return (
    <View style={s.wrap}>
      <CardShell accent={band === 'RED' ? 'crimson' : band === 'ORANGE' || band === 'YELLOW' ? 'amber' : 'emerald'}>
        <CardHeader
          icon="activity"
          iconColor={bandColor}
          title={t('card_vitals_title')}
          pill={bandLabel}
          pillColor={bandColor}
        />
        <View style={s.vitalRow}>
          {[
            { k: t('card_bp'), v: bp },
            { k: t('card_sugar'), v: sugar },
            { k: t('card_pulse'), v: pulse },
            { k: t('card_spo2'), v: spo2 === '--' ? '--' : `${spo2}%` },
          ].map((x) => (
            <View key={x.k} style={s.vitalCell}>
              <AppText variant="small" color={T.dim} style={{ fontSize: 9 }}>
                {x.k}
              </AppText>
              <AppText variant="label" weight="bold" color={T.text} style={{ fontSize: 13 }}>
                {x.v}
              </AppText>
            </View>
          ))}
        </View>
        {status ? (
          <AppText variant="small" color={T.sub} numberOfLines={1} style={s.subLine}>
            {status}
          </AppText>
        ) : null}
      </CardShell>
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
    <View style={s.wrap}>
      <CardShell accent="crimson">
        <CardHeader icon="alert-triangle" iconColor={T.crimson} title={title ?? t('card_sos_title')} pill="SOS" pillColor={T.crimson} />
        {description ? (
          <AppText variant="small" color="#FECACA" numberOfLines={2} style={s.subLine}>
            {description}
          </AppText>
        ) : null}
        <ActionRow>
          <ActionPill icon="shield" label={t('card_sos_open')} tone="crimson" onPress={onOpenSOS || (() => {})} />
          <ActionPill
            icon="phone-call"
            label={t('card_call_108')}
            tone="crimson"
            onPress={() => (onCall108 ? onCall108() : openUrl('tel:108'))}
          />
        </ActionRow>
      </CardShell>
    </View>
  );
}

// ==========================================
// 5. CAREGIVER ESCALATION CARD
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
    `https://wa.me/${(phone || '+919876500001').replace(/\D/g, '')}?text=${encodeURIComponent(
      `सहारा केयर अलर्ट: सहायता की आवश्यकता है। स्थिति: ${reason || 'सहायता अनुरोध'}। कृपया संपर्क करें।`,
    )}`;
  const finalCall = callUrl || `tel:${(phone || '').replace(/\s+/g, '')}`;

  return (
    <View style={s.wrap}>
      <CardShell accent="emerald">
        <CardHeader
          icon="user-check"
          iconColor={T.emerald}
          title={caregiver}
          pill={urgency === 'high' ? 'अति आवश्यक' : 'अलर्ट'}
          pillColor={urgency === 'high' ? T.crimson : T.emerald}
        />
        {reason ? (
          <AppText variant="small" color={T.sub} numberOfLines={1} style={s.subLine}>
            {reason}
          </AppText>
        ) : null}
        <ActionRow>
          <ActionPill icon="message-circle" label="वॉट्सऐप" onPress={() => openUrl(finalWhatsapp)} />
          <ActionPill icon="phone" label="कॉल" onPress={() => openUrl(finalCall)} />
        </ActionRow>
      </CardShell>
    </View>
  );
}

// ==========================================
// 6. REMINDER CARD
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
  const clock = formattedTime || time;

  return (
    <View style={s.wrap}>
      <CardShell accent="amber">
        <CardHeader
          icon="bell"
          iconColor={T.amber}
          title={title}
          pill={isActive ? 'अलार्म चालू ✓' : 'बंद'}
          pillColor={isActive ? T.emerald : T.dim}
        />
        <View style={s.clockChip}>
          <Icon name="clock" set="feather" size={14} color={T.amber} />
          <AppText variant="label" weight="bold" color={T.amber} style={{ fontSize: 15 }}>
            {clock}
          </AppText>
        </View>
        <ActionRow>
          <ActionPill
            icon={isActive ? 'bell' : 'bell-off'}
            label={isActive ? 'रिमाइंडर सक्रिय' : 'पुनः सक्रिय करें'}
            tone={isActive ? 'amber' : 'neutral'}
            onPress={() => setIsActive(!isActive)}
          />
        </ActionRow>
      </CardShell>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginVertical: 4 },
  shell: {
    backgroundColor: T.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.hairline,
    padding: 1.5,
  },
  core: {
    backgroundColor: T.core,
    borderRadius: radius.md - 1,
    borderWidth: 1,
    borderColor: T.hairlineSoft,
    padding: 10,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  subLine: { fontSize: 11, lineHeight: 15 },
  geoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: T.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  btnRow: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
  },
  savingsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: T.emeraldDim,
    borderWidth: 1,
    borderColor: T.emeraldBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: T.hairlineSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ledgerCell: { flex: 1, gap: 1 },
  ledgerDivider: {
    width: 1,
    backgroundColor: T.hairline,
    marginHorizontal: 12,
    marginVertical: 2,
  },
  saveTrack: {
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: T.hairlineSoft,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  saveFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 223, 114, 0.22)',
    borderRightWidth: 1,
    borderRightColor: T.emerald,
  },
  saveLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
  },
  provenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jaDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: T.emerald,
    shadowColor: T.emerald,
    shadowOpacity: 0.7,
    shadowRadius: 4,
  },
  coverageChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    backgroundColor: T.emeraldDim,
    borderWidth: 1,
    borderColor: T.emeraldBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  benefitCol: { gap: 3 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  vitalRow: { flexDirection: 'row', gap: 4 },
  vitalCell: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: T.hairlineSoft,
    borderRadius: radius.sm,
    paddingVertical: 5,
    gap: 1,
  },
  clockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.amberDim,
    borderWidth: 1,
    borderColor: T.amberBorder,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
