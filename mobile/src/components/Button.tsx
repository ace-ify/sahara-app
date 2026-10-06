import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, radius, touch, space } from '../theme';

type Variant = 'primary' | 'danger' | 'outline' | 'ghost' | 'glass';

export function Button({
  label,
  sub,
  icon,
  iconSet = 'feather',
  trailingIcon,
  onPress,
  variant = 'primary',
  big,
  disabled,
  style,
  accessibilityLabel,
}: {
  label: string;
  sub?: string;
  icon?: string;
  iconSet?: 'feather' | 'mci';
  trailingIcon?: string;
  onPress?: () => void;
  variant?: Variant;
  big?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${label}${sub ? ', ' + sub : ''}`}
      style={({ pressed }) => [
        s.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          minHeight: big ? 62 : touch.primary,
          transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
          opacity: disabled ? 0.5 : pressed ? 0.88 : 1,
        },
        variant === 'primary' && !disabled && s.primaryGlow,
        style,
      ]}
    >
      <View style={s.row}>
        {icon ? (
          <View style={[s.iconWrap, { backgroundColor: v.iconBg }]}>
            <Icon name={icon} set={iconSet} size={big ? 20 : 18} color={v.fg} />
          </View>
        ) : null}

        <View style={{ flexShrink: 1, alignItems: 'center' }}>
          <AppText
            variant={big ? 'h2' : 'label'}
            weight="bold"
            color={v.fg}
            align="center"
            style={{ letterSpacing: 0.2 }}
          >
            {label}
          </AppText>
          {sub ? (
            <AppText variant="small" color={v.fg} align="center" style={{ opacity: 0.9 }}>
              {sub}
            </AppText>
          ) : null}
        </View>

        {trailingIcon ? (
          <View style={[s.trailingCircle, { backgroundColor: v.iconBg }]}>
            <Icon name={trailingIcon} set={iconSet} size={16} color={v.fg} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const VARIANTS: Record<
  Variant,
  { bg: string; fg: string; border: string; iconBg: string }
> = {
  primary: {
    bg: colors.brand,
    fg: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.15)',
    iconBg: 'rgba(255, 255, 255, 0.20)',
  },
  danger: {
    bg: colors.danger,
    fg: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.15)',
    iconBg: 'rgba(255, 255, 255, 0.20)',
  },
  outline: {
    bg: 'rgba(255, 255, 255, 0.03)',
    fg: colors.tealDark,
    border: 'rgba(16, 185, 129, 0.40)',
    iconBg: 'rgba(16, 185, 129, 0.15)',
  },
  ghost: {
    bg: 'rgba(16, 185, 129, 0.12)',
    fg: colors.tealDark,
    border: 'transparent',
    iconBg: 'rgba(16, 185, 129, 0.18)',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.06)',
    fg: colors.text,
    border: 'rgba(255, 255, 255, 0.10)',
    iconBg: 'rgba(255, 255, 255, 0.10)',
  },
};

const s = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryGlow: {
    shadowColor: colors.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space.xs,
  },
});
