export interface GpuGate {
  state: {
    lowPower: boolean;
    paused: boolean;
  };
  frameMs: number;
  dispose: () => void;
}

export function attachGpuGate(canvas: HTMLCanvasElement): GpuGate {
  let paused = false;
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  const lowPower =
    isMobile ||
    (typeof navigator !== "undefined" &&
      (navigator as any).hardwareConcurrency <= 4);
  const frameMs = lowPower ? 33 : 16;

  const handleVisibility = () => {
    if (typeof document !== "undefined") {
      paused = document.hidden;
    }
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibility);
  }

  return {
    state: {
      lowPower,
      get paused() {
        return paused;
      },
    },
    frameMs,
    dispose: () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    },
  };
}

export function deferUntilVisible(
  element: HTMLElement,
  callback: () => void,
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback();
    return () => {};
  }

  let called = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !called) {
          called = true;
          observer.disconnect();
          callback();
          break;
        }
      }
    },
    { threshold: 0.05 },
  );

  observer.observe(element);
  return () => observer.disconnect();
}
