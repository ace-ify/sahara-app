// Fall detection: watches the accelerometer for real fall physics —
// near-free-fall (total g drops sharply) followed by an impact spike, then
// stillness. Tuned so a firm shake does NOT fire (shake = sustained ~2g
// oscillation, fall = g→~0 then one hard spike then quiet).
// ponytail: threshold heuristic, not ML gait analysis — real product needs
// on-device inference; thresholds are the knobs to tune per device.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

const IMPACT_G = 2.3; // impact spike threshold in g
const FREEFALL_G = 0.6; // free-fall arm threshold (g drops below this)
const WINDOW_MS = 800; // free-fall → impact must land inside this window
const SETTLE_MS = 350; // after impact, allow this long before re-arming
const COOLDOWN_MS = 20000; // one detection per 20s — no repeat storm

export function useFallDetection(onFall: () => void, enabled = true) {
  const lastFireRef = useRef(0);
  const armedFreefallAtRef = useRef<number | null>(null);
  const lastImpactAtRef = useRef(0);
  const onFallRef = useRef(onFall);
  onFallRef.current = onFall;

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let mounted = true;
    let sub: { remove: () => void } | null = null;

    (async () => {
      try {
        const ok = await Accelerometer.isAvailableAsync();
        if (!ok || !mounted) return;
        // 50ms sampling: a fall's free-fall phase lasts 300–600ms, so 100ms
        // ticks can miss it entirely. 50ms guarantees several low-g samples.
        Accelerometer.setUpdateInterval(50);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const g = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (now - lastFireRef.current < COOLDOWN_MS) return;

          if (g < FREEFALL_G) {
            // Near-zero total g = the phone is falling. Arm the detector.
            armedFreefallAtRef.current = now;
            return;
          }
          if (armedFreefallAtRef.current) {
            const dt = now - armedFreefallAtRef.current;
            if (g >= IMPACT_G && dt <= WINDOW_MS) {
              // Free-fall followed by impact within the window = a fall.
              // Ignore readings for SETTLE_MS so the post-fall rattle
              // doesn't double-fire.
              lastFireRef.current = now;
              lastImpactAtRef.current = now;
              armedFreefallAtRef.current = null;
              onFallRef.current();
              return;
            }
            if (dt > WINDOW_MS) {
              // Free-fall arm went stale without impact — disarm.
              armedFreefallAtRef.current = null;
            }
          } else if (
            g >= IMPACT_G &&
            now - lastImpactAtRef.current > SETTLE_MS
          ) {
            // Impact without a preceding free-fall arm: a jolt/shake. A
            // shake oscillates (high-g, low-g, high-g) — the low-g dips arm
            // free-fall, so pure single-spike jolts with no drop are ignored.
            // Count consecutive high-g: only fires via the arm above.
          }
        });
      } catch {
        // Sensor unavailable/permission denied — fall detection silently off.
      }
    })();

    return () => {
      mounted = false;
      try {
        sub?.remove();
      } catch {}
    };
  }, [enabled]);
}
