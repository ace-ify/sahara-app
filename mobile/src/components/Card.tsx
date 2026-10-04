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
    padding: space.lg,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  warm: {
    backgroundColor: colors.surfaceWarm,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  glow: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    shadowColor: colors.brand,
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  tintEmerald: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.30)',
  },
  tintCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderColor: 'rgba(6, 182, 212, 0.30)',
  },
  tintDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  tintAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.30)',
  },

  // Double-Bezel nested architecture
  shell: {
    borderRadius: radius.xl,
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  shellGlow: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    shadowColor: colors.brand,
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  shellEmerald: {
    borderColor: 'rgba(16, 185, 129, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  shellCyan: {
    borderColor: 'rgba(6, 182, 212, 0.35)',
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
  },
  shellDanger: {
    borderColor: 'rgba(239, 68, 68, 0.40)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  shellAmber: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  innerCore: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  warmCore: {
    backgroundColor: colors.surfaceWarm,
  },
});
