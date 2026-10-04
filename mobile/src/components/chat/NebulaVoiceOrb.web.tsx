import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { initSkiaWeb } from '../../services/skiaInit';
import type { VoiceOrbProps } from './NebulaVoiceOrbCore';

// Web — react-native-skia's module graph must evaluate only AFTER the
// CanvasKit WASM backend is ready (otherwise `Skia` binds to an undefined
// CanvasKit and shaders can never compile). The nebula orb module is loaded
// dynamically once `initSkiaWeb()` resolves — the same contract as skia's
// official WithSkiaWeb helper.

let cachedImpl: { Core: any; Orb: any } | null = null;
let pendingImpl: Promise<{ Core: any; Orb: any }> | null = null;

function loadOrb(): Promise<{ Core: any; Orb: any }> {
  if (cachedImpl) return Promise.resolve(cachedImpl);
  pendingImpl =
    pendingImpl ||
    (async () => {
      await initSkiaWeb();
      const [coreMod, orbMod] = await Promise.all([
        import('./NebulaVoiceOrbCore'),
        import('../reacticx/organisms/nebula-orb'),
      ]);
      cachedImpl = { Core: coreMod.NebulaVoiceOrbCore, Orb: orbMod.NebulaOrb };
      return cachedImpl;
    })();
  return pendingImpl;
}

export function NebulaVoiceOrb(props: VoiceOrbProps) {
  const { size = 220, active = false, speaking = false, state = 'idle' } = props;
  const [impl, setImpl] = useState<{ Core: any; Orb: any } | null>(cachedImpl);

  useEffect(() => {
    if (impl) return;
    let alive = true;
    loadOrb()
      .then((m) => {
        if (alive) setImpl(m);
      })
      .catch((e) => console.warn('Nebula orb web load failed:', e));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!impl) {
    // Placeholder while CanvasKit initializes — palette-matched so the
    // transition to the shader is seamless.
    const color = state === 'speaking' || speaking ? '#0FD3AC' : active ? '#0E9F8A' : '#0B4F43';
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: 0.9,
        }}
      />
    );
  }

  const { Core, Orb } = impl;
  return <Core {...props} Orb={Orb} />;
}
