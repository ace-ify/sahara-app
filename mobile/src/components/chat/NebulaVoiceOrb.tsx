import React from 'react';
import { NebulaOrb } from '../reacticx/organisms/nebula-orb';
import { NebulaVoiceOrbCore } from './NebulaVoiceOrbCore';
import type { VoiceOrbProps } from './NebulaVoiceOrbCore';

// Native — Skia's JSI backend is ready at launch, so the nebula shader orb
// loads statically.
export function NebulaVoiceOrb(props: VoiceOrbProps) {
  return <NebulaVoiceOrbCore {...props} Orb={NebulaOrb} />;
}
