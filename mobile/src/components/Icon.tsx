import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

// Editorial line icons: Feather by default; MaterialCommunityIcons ('mci') for the few Feather lacks (pill, ambulance, robot, qr).
export function Icon({
  name,
  size = 22,
  color = colors.text,
  set = 'feather',
}: {
  name: string;
  size?: number;
  color?: string;
  set?: 'feather' | 'mci';
}) {
  if (set === 'mci') return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  return <Feather name={name as any} size={size} color={color} />;
}
