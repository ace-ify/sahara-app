import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, Easing } from 'react-native';
import { colors } from '../theme';

// Phase-1 amplitude visualizer: animated bars (cross-platform, no Skia/WASM).
// Phase-2: swap the bar heights to be driven by real Agora mic volume, or move to Skia.
const BARS = 21;

export function Waveform({ active, color = colors.teal, height = 72 }: { active: boolean; color?: string; height?: number }) {
  const vals = useRef([...Array(BARS)].map(() => new Animated.Value(0.1))).current;
  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    loops.current.forEach((l) => l.stop());
    loops.current = [];
    if (active) {
      vals.forEach((v, i) => {
        const envelope = Math.sin((i / (BARS - 1)) * Math.PI) * 0.75 + 0.25;
        const run = () => {
          const to = (0.3 + Math.random() * 0.7) * envelope;
          const dur = 200 + Math.random() * 250;
          const a = Animated.sequence([
            Animated.timing(v, { toValue: to, duration: dur, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
            Animated.timing(v, { toValue: 0.12 * envelope, duration: dur, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
          ]);
          const loop = Animated.loop(a);
          loops.current.push(loop);
          setTimeout(() => loop.start(), (i * 24) % 300);
        };
        run();
      });
    } else {
      vals.forEach((v, i) => {
        const envelope = Math.sin((i / (BARS - 1)) * Math.PI) * 0.5 + 0.5;
        Animated.timing(v, { toValue: 0.08 * envelope, duration: 300, useNativeDriver: false }).start();
      });
    }
    return () => loops.current.forEach((l) => l.stop());
  }, [active]);

  return (
    <View style={[s.row, { height }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {vals.map((v, i) => {
        const centerDist = Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const barOpacity = active ? Math.max(0.4, 1 - centerDist * 0.4) : 0.2;
        return (
          <Animated.View
            key={i}
            style={[
              s.bar,
              {
                backgroundColor: color,
                opacity: barOpacity,
                height: v.interpolate({ inputRange: [0, 1], outputRange: [4, height] }),
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 8 },
  bar: { width: 5, borderRadius: 999 },
});
