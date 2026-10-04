import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

export interface VoiceOrbProps {
  size?: number;
  active?: boolean;
  speaking?: boolean;
  state?: string;
  audioLevel?: number;
  theme?: string;
  onClick?: () => void;
}

interface NebulaVoiceOrbCoreProps extends VoiceOrbProps {
  /** The Skia nebula orb component — injected per platform so web can load
   *  it lazily after the CanvasKit WASM backend is ready. */
  Orb: any | null;
}

/**
 * Sahara voice orb — reacticx NebulaOrb (Skia shader) with a duplex-call
 * micro-interaction layer:
 * - Idle: deep-space emerald nebula, slow calm drift.
 * - Tap: press-in scale bounce + the nebula ignites (faster, brighter).
 * - Listening: emerald aurora that reacts to the caller's mic level.
 * - Thinking: cyan swirl, faster turbulence.
 * - Speaking: bright aqua nebula pulsing with the agent's voice level.
 */
export function NebulaVoiceOrbCore({
  size = 220,
  active = false,
  speaking = false,
  state = 'idle',
  audioLevel = 0,
  onClick,
  Orb,
}: NebulaVoiceOrbCoreProps) {
  const isSpeaking = state === 'speaking' || speaking;
  const isListening = state === 'listening' || (active && !isSpeaking && state !== 'thinking' && state !== 'connecting');
  const isThinking = state === 'thinking';
  const isConnecting = state === 'connecting';
  const isEmergency = state === 'emergency';
  const isActive = active || state !== 'idle';

  const level = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.3)).current;
  const press = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  // Audio level → smooth spring (mirrors the old orb normalization)
  useEffect(() => {
    Animated.spring(level, {
      toValue: Math.min(Math.max(audioLevel || 0, 0), 1),
      useNativeDriver: true,
      friction: 5,
      tension: 70,
    }).start();
  }, [audioLevel, level]);

  // Breathing + glow — cadence accelerates with call state
  useEffect(() => {
    const dur = isSpeaking ? 850 : isThinking ? 1100 : isConnecting ? 650 : 2400;
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(breathe, {
            toValue: isSpeaking ? 1.08 : isThinking ? 1.05 : isActive ? 1.045 : 1.025,
            duration: dur,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breathe, {
            toValue: 0.985,
            duration: dur,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: isSpeaking ? 0.95 : isThinking ? 0.8 : isActive ? 0.65 : 0.4, duration: dur, useNativeDriver: true }),
          Animated.timing(glow, { toValue: isActive ? 0.42 : 0.3, duration: dur, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isSpeaking, isThinking, isConnecting, isActive, breathe, glow]);

  // Expanding sonar ripple while the call is live
  useEffect(() => {
    if (!isActive) {
      ripple.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ripple, {
          toValue: 1,
          duration: isSpeaking ? 1000 : isThinking ? 1400 : 1700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ripple, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isActive, isSpeaking, isThinking, isConnecting, ripple]);

  const rippleScale = ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const rippleOpacity = ripple.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  // Audio-reactive scale (voice → orb swells)
  const levelScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, isActive ? 1.08 : 1.03] });
  const glowScale = level.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });

  const palette = useMemo(() => {
    if (isEmergency) return { color: '#7F1D1D', highlight: '#FCA5A5', ripple: 'rgba(239, 68, 68, 0.5)', halo: 'rgba(239, 68, 68, 0.22)' };
    if (isSpeaking) return { color: '#0FD3AC', highlight: '#EAFFFB', ripple: 'rgba(15, 211, 172, 0.5)', halo: 'rgba(15, 211, 172, 0.24)' };
    if (isThinking) return { color: '#0E7490', highlight: '#C9F7FF', ripple: 'rgba(6, 182, 212, 0.45)', halo: 'rgba(6, 182, 212, 0.2)' };
    if (isConnecting) return { color: '#059669', highlight: '#D9FFFB', ripple: 'rgba(52, 211, 153, 0.45)', halo: 'rgba(16, 185, 129, 0.2)' };
    if (isListening) return { color: '#0E9F8A', highlight: '#B4FFF0', ripple: 'rgba(16, 185, 129, 0.4)', halo: 'rgba(16, 185, 129, 0.18)' };
    return { color: '#0B4F43', highlight: '#8CF7DF', ripple: 'rgba(16, 185, 129, 0.3)', halo: 'rgba(16, 185, 129, 0.12)' };
  }, [isSpeaking, isThinking, isConnecting, isListening, isEmergency]);

  // Shader intensity — the nebula itself becomes the audio visualiser
  const baseTurbulence = isSpeaking ? 1.5 : isThinking ? 1.7 : isConnecting ? 1.6 : isListening ? 1.3 : 1.0;
  const baseSpeed = isSpeaking ? 2.1 : isThinking ? 2.4 : isConnecting ? 2.6 : isListening ? 1.3 : 0.55;
  const lvl = Math.min(Math.max(audioLevel || 0, 0), 1);

  const handlePressIn = () => {
    Animated.spring(press, { toValue: 0.92, useNativeDriver: true, friction: 7, tension: 220 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
  };

  return (
    <Pressable
      onPress={onClick}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onClick}
      accessibilityRole={onClick ? 'button' : undefined}
      accessibilityLabel="Sahara voice call orb"
      accessibilityState={{ selected: isActive }}
      style={[styles.container, { width: size, height: size }]}
    >
      {/* Ambient halo — swells with voice */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: (size * 1.35) / 2,
            backgroundColor: palette.halo,
            opacity: Animated.multiply(glow, Animated.add(1, 0)),
          },
          { transform: [{ scale: Animated.multiply(breathe, glowScale) }] },
        ]}
      />

      {/* Sonar ripple — call is live */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.layer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: Math.max(1.5, size * 0.014),
            borderColor: palette.ripple,
            opacity: isActive ? Animated.multiply(rippleOpacity, 1) : 0,
            transform: [{ scale: rippleScale }],
          },
        ]}
      />

      {/* Nebula core — Skia shader, breathes + swells with voice */}
      <Animated.View style={{ transform: [{ scale: Animated.multiply(breathe, Animated.multiply(press, levelScale)) }] }}>
        {Orb ? (
          <Orb
            size={size}
            color={palette.color}
            highlightColor={palette.highlight}
            speed={baseSpeed + lvl * 1.6}
            turbulence={baseTurbulence + lvl * 1.2}
            detail={1}
            contrast={0.8 + lvl * 0.35}
            edgeSoftness={0.012}
            paused={false}
          />
        ) : (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: palette.color,
              opacity: 0.9,
            }}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    alignSelf: 'center',
  },
});
