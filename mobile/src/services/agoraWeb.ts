// Native fallback — agora-rtc-sdk-ng is a browser SDK; never bundle it natively.
// The native duplex path uses react-native-agora via ./agoraEngine instead.
export function loadAgoraWeb(): null {
  return null;
}
