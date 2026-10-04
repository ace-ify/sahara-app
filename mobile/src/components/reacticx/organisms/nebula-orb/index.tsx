// @ts-check
import React, { memo, useEffect, useMemo, useReducer } from "react";
import { StyleSheet, View } from "react-native";
import {
  Canvas,
  Fill,
  Shader,
  Skia,
  type Uniforms,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

import { NEBULA_ORB_SHADER } from "./conf";
import {
  DEFAULT_COLOR,
  DEFAULT_CONTRAST,
  DEFAULT_DETAIL,
  DEFAULT_EDGE_SOFTNESS,
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_SIZE,
  DEFAULT_SPEED,
  DEFAULT_TURBULENCE,
  FALLBACK_FRAME_MS,
} from "./const";
import { toRgb } from "./helper";
import type { INebulaOrb } from "./types";

// The RuntimeEffect is created lazily: on web, Skia's CanvasKit backend is
// still loading at module scope, so an eager `Skia.RuntimeEffect.Make` crashes
// ("Cannot read properties of undefined"). Retry until the backend is ready.
let orbEffect: ReturnType<typeof Skia.RuntimeEffect.Make> | null = null;
let lastAttemptAt = 0;
function getOrbEffect() {
  if (orbEffect) return orbEffect;
  try {
    if (Skia && typeof Skia.RuntimeEffect?.Make === 'function') {
      orbEffect = Skia.RuntimeEffect.Make(NEBULA_ORB_SHADER) ?? null;
      if (orbEffect) return orbEffect;
    }
  } catch {
    // CanvasKit not ready yet — retry on a later render.
  }
  if (Date.now() - lastAttemptAt > 2000) {
    lastAttemptAt = Date.now();
  }
  return null;
}

const NebulaOrbBase: React.FC<INebulaOrb> &
  React.FunctionComponent<INebulaOrb> = ({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  highlightColor = DEFAULT_HIGHLIGHT_COLOR,
  speed = DEFAULT_SPEED,
  turbulence = DEFAULT_TURBULENCE,
  detail = DEFAULT_DETAIL,
  contrast = DEFAULT_CONTRAST,
  edgeSoftness = DEFAULT_EDGE_SOFTNESS,
  paused = false,
  style,
}: INebulaOrb): React.JSX.Element => {
  const time = useSharedValue<number>(0);

  // Web: re-render until the CanvasKit WASM backend is ready and the shader
  // compiles (the lazy getter below retries; nothing else triggers a render).
  const [, bumpShaderReady] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (orbEffect) return;
    const t = setInterval(() => {
      if (getOrbEffect()) {
        clearInterval(t);
        bumpShaderReady();
      }
    }, 300);
    return () => clearInterval(t);
  }, []);

  const frame = useFrameCallback((info) => {
    time.value += (info.timeSincePreviousFrame ?? FALLBACK_FRAME_MS) / 1000;
  }, false);

  useEffect(() => {
    frame.setActive(!paused);
  }, [frame, paused]);

  const colorRgb = useMemo(() => toRgb(color), [color]);
  const highlightRgb = useMemo(() => toRgb(highlightColor), [highlightColor]);

  const uniforms = useDerivedValue<Uniforms>(
    () => ({
      uResolution: [size, size],
      uTime: time.value * speed,
      uColor: colorRgb,
      uHighlight: highlightRgb,
      uTurbulence: turbulence,
      uScale: detail,
      uContrast: contrast,
      uEdgeSoftness: edgeSoftness,
    }),
    [
      size,
      speed,
      colorRgb,
      highlightRgb,
      turbulence,
      detail,
      contrast,
      edgeSoftness,
    ],
  );

  if (!getOrbEffect())
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: 0.85,
          },
          style,
        ]}
      />
    );

  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, style]}>
      <Canvas style={styles.canvas}>
        <Fill>
          <Shader source={getOrbEffect()!} uniforms={uniforms} />
        </Fill>
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
});

const NebulaOrb: React.NamedExoticComponent<INebulaOrb> =
  memo<INebulaOrb>(NebulaOrbBase);

export { NebulaOrb, NebulaOrbBase };
export type { INebulaOrb } from "./types";
export default NebulaOrb;
