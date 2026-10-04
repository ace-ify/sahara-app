import React from 'react';
import { Text, TextProps } from 'react-native';
import { colors, type as T, fontFor } from '../theme';

type Variant = keyof typeof T;
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

export function AppText({
  variant = 'body',
  weight = 'regular',
  color = colors.text,
  align = 'left',
  style,
  ...rest
}: TextProps & {
  variant?: Variant;
  weight?: Weight;
  color?: string;
  align?: 'left' | 'center' | 'right';
}) {
  const isSerif = variant === 'display' || variant === 'h1' || variant === 'h2';
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: T[variant],
          fontFamily: fontFor(variant, weight),
          color,
          textAlign: align,
          lineHeight: T[variant] * (isSerif ? 1.25 : 1.4),
          letterSpacing: isSerif ? -0.3 : 0,
        },
        style,
      ]}
    />
  );
}
