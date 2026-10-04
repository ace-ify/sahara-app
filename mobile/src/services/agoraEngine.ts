// Native-only Agora RTC engine loader (react-native-agora).
// This file is resolved ONLY on native platforms (Metro .web.ts override
// keeps it out of the web bundle — importing react-native-agora on web is a
// hard bundling error since it pulls native RN internals).
//
// The SDK is required LAZILY inside loadAgoraNative(): react-native-agora
// throws "The package 'react-native-agora' doesn't seem to be linked" at
// *module evaluation* time when the native module is absent (Expo Go, or a
// dev build that predates the install). A top-level import would crash the
// entire app red-screen before the voice-loop fallback in voice.ts could run.
import type { IRtcEngine } from 'react-native-agora';

type RtcEngineModule = typeof import('react-native-agora');

export interface AgoraNativeModule {
  createAgoraRtcEngine: RtcEngineModule['createAgoraRtcEngine'];
  ChannelProfileType: RtcEngineModule['ChannelProfileType'];
  ClientRoleType: RtcEngineModule['ClientRoleType'];
}

/**
 * Returns the native Agora RTC module, or null when it is not linked
 * (e.g. running in Expo Go). Callers should fall back to the voice loop.
 */
export function loadAgoraNative(): AgoraNativeModule | null {
  try {
    // Deferred require — only evaluated when a voice session actually starts,
    // inside this try/catch, never at app bootstrap.
    const agora: RtcEngineModule = require('react-native-agora');
    if (!agora || typeof agora.createAgoraRtcEngine !== 'function') return null;
    return {
      createAgoraRtcEngine: agora.createAgoraRtcEngine,
      ChannelProfileType: agora.ChannelProfileType,
      ClientRoleType: agora.ClientRoleType,
    };
  } catch (err) {
    console.warn(
      '[agora] react-native-agora native module not available — falling back to voice loop. ' +
        'For full duplex RTC, build a development client (npx expo run:android / run:ios).',
      err,
    );
    return null;
  }
}

// Re-exported for callers that want to type their engine ref without
// importing the SDK eagerly.
export type AgoraRtcEngine = IRtcEngine;
