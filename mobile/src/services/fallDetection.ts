// Fall detection (PROTOTYPE): watches the accelerometer for a hard jolt —
// free-fall (near-0 total g) followed by a high-g impact spike — then hands
// to the caller to ask "Are you okay?" by voice. Escalation if unanswered.
// ponytail: threshold heuristic, not ML gait analysis — tune SENSITIVITY if
// demo device varies; real product needs on-device inference.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

const IMPACT_G = 2.6; // impact spike threshold in g
const FREEFALL_G = 0.45; // near-free-fall threshold in g
const WINDOW_MS = 700; // free-fall → impact must land inside this window
const COOLDOWN_MS = 20000; // one detection per 20s — no repeat storm

export function useFallDetection(onFall: () => void, enabled = true) {
  const lastFireRef = useRef(0);
  const armedFreefallAtRef = useRef<number | null>(null);
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
        Accelerometer.setUpdateInterval(100);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const g = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (now - lastFireRef.current < COOLDOWN_MS) return;

          if (g < FREEFALL_G) {
            armedFreefallAtRef.current = now; // possible free-fall started
            return;
          }
          if (g >= IMPACT_G && armedFreefallAtRef.current) {
            const dt = now - armedFreefallAtRef.current;
            armedFreefallAtRef.current = null;
            if (dt <= WINDOW_MS) {
              lastFireRef.current = now;
              onFallRef.current();
            }
          } else if (g > 1.5 && g < 2.2) {
            // settled back to normal gravity — disarm stale free-fall arm
            armedFreefallAtRef.current = null;
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
