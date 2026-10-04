import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle } from 'react-native';

interface PressableScaleProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}

// Tactile press feedback — eases down on touch, springs back on release.
export function PressableScale({
  style,
  scaleTo = 0.96,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number, spring: boolean) => {
    if (spring) {
      Animated.spring(scale, { toValue: to, useNativeDriver: true, friction: 7, tension: 220 }).start();
    } else {
      Animated.timing(scale, { toValue: to, duration: 110, useNativeDriver: true }).start();
    }
  };

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        animate(scaleTo, false);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animate(1, true);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({});
