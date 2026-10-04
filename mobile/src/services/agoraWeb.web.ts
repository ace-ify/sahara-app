// Web-only Agora RTC SDK loader (resolved by Metro on web platforms only).
// Static top-level import of agora-rtc-sdk-ng must stay out of native bundles.
export function loadAgoraWeb(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('agora-rtc-sdk-ng');
  } catch (e) {
    console.warn('AgoraRTC web SDK load warning:', e);
    return null;
  }
}
