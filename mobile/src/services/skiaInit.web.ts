// Web — load Skia's CanvasKit WASM backend before any shader renders.
// The nebula orb retries lazily, so shaders appear as soon as this resolves.
// (require: skia's web src uses RN `global` typings that don't typecheck here)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadSkiaWeb } = require('@shopify/react-native-skia/src/web/LoadSkiaWeb') as {
  LoadSkiaWeb: (opts?: unknown) => Promise<void>;
};

export function initSkiaWeb(): Promise<void> {
  return LoadSkiaWeb().catch((e) => {
    console.warn('Skia web bootstrap failed:', e);
  });
}
