import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radius, space } from '../theme';

export interface CardProps extends ViewProps {
  warm?: boolean;
  doubleBezel?: boolean;
  glow?: boolean;
  tint?: 'emerald' | 'cyan' | 'danger' | 'amber';
}

export function Card({
  style,
  warm,
  doubleBezel,
  glow,
  tint,
  children,
  ...rest
}: CardProps) {
  if (doubleBezel) {
    return (
      <View
        style={[
          s.shell,
          glow && s.shellGlow,
          tint === 'emerald' && s.shellEmerald,
          tint === 'cyan' && s.shellCyan,
          tint === 'danger' && s.shellDanger,
          tint === 'amber' && s.shellAmber,
          style,
        ]}
      >
        <View
          {...rest}
          style={[
            s.innerCore,
            warm && s.warmCore,
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      {...rest}
      style={[
        s.card,
        warm && s.warm,
        glow && s.glow,
        tint === 'emerald' && s.tintEmerald,
        tint === 'cyan' && s.tintCyan,
        tint === 'danger' && s.tintDanger,
        tint === 'amber' && s.tintAmber,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  warm: {
    backgroundColor: colors.surfaceWarm,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  glow: {
    borderColor: colors.borderActive,
    shadowColor: colors.brand,
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  tintEmerald: {
    backgroundColor: 'rgba(5, 223, 114, 0.06)',
    borderColor: 'rgba(5, 223, 114, 0.28)',
  },
  tintCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    borderColor: 'rgba(6, 182, 212, 0.28)',
  },
  tintDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  tintAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },

  // Double-Bezel nested architecture
  shell: {
    borderRadius: radius.xl,
    padding: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  shellGlow: {
    borderColor: colors.borderActive,
    shadowColor: colors.brand,
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  shellEmerald: {
    borderColor: 'rgba(5, 223, 114, 0.30)',
    backgroundColor: 'rgba(5, 223, 114, 0.05)',
  },
  shellCyan: {
    borderColor: 'rgba(6, 182, 212, 0.30)',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  shellDanger: {
    borderColor: 'rgba(239, 68, 68, 0.40)',
    backgroundColor: 'rgba(239, 68, 68, 0.07)',
  },
  shellAmber: {
    borderColor: 'rgba(245, 158, 11, 0.30)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  innerCore: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.02)',
  },
  warmCore: {
    backgroundColor: colors.surfaceWarm,
  },
});
