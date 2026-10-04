import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { colors, radius, space } from '../theme';

export type ConvState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'emergency';

const MAP: Record<ConvState, { hi: string; en: string; dot: string; bg: string; fg: string }> = {
  idle:       { hi: 'दबाकर बोलें', en: 'Tap to talk',  dot: colors.textMuted, bg: colors.surfaceWarm, fg: colors.text },
  connecting: { hi: 'जुड़ रहा है…', en: 'Connecting',  dot: colors.teal,      bg: colors.tealTint,    fg: colors.tealDark },
  listening:  { hi: 'सुन रहा हूँ…', en: 'Listening',    dot: colors.teal,      bg: colors.tealTint,    fg: colors.tealDark },
  thinking:   { hi: 'सोच रहा हूँ…', en: 'Thinking',     dot: colors.saffron,   bg: '#F7ECE1',          fg: '#8A3E0C' },
  speaking:   { hi: 'बोल रहा हूँ…', en: 'Speaking',     dot: colors.teal,      bg: colors.tealTint,    fg: colors.tealDark },
  emergency:  { hi: 'आपातकाल',      en: 'Emergency',    dot: colors.white,     bg: colors.danger,      fg: colors.white },
};

export function StateBadge({ state }: { state: ConvState }) {
  const m = MAP[state];
  return (
    <View style={[s.pill, { backgroundColor: m.bg }]} accessibilityLabel={`${m.hi}, ${m.en}`}>
      <View style={[s.dot, { backgroundColor: m.dot }]} />
      <AppText variant="label" weight="semibold" color={m.fg}>{m.hi}</AppText>
      <AppText variant="small" color={m.fg} style={{ opacity: 0.8 }}>  ·  {m.en}</AppText>
    </View>
  );
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
