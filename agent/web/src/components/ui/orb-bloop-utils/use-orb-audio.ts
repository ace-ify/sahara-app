import { useEffect, useRef } from "react";

export interface AudioAnalyzer {
  allAvg: number;
  lowAvg: number;
  midAvg: number;
  highAvg: number;
  update: () => void;
}

export function useOrbAudio(
  mode: "ambient" | "mic" | "file",
  audioElement?: React.RefObject<HTMLAudioElement | null>,
  audioSrc?: string,
) {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let ctx: AudioContext | null = null;
    let analyzer: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function setupAudio() {
      try {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        ctx = new AudioCtx();
        analyzer = ctx.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;

        if (mode === "mic") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled || !ctx) return;
          source = ctx.createMediaStreamSource(stream);
          source.connect(analyzer);
        } else if (mode === "file" && audioElement?.current) {
          source = ctx.createMediaElementSource(audioElement.current);
          source.connect(analyzer);
          analyzer.connect(ctx.destination);
        }

        const dataArray = new Uint8Array(analyzer.frequencyBinCount);

        analyzerRef.current = {
          allAvg: 0,
          lowAvg: 0,
          midAvg: 0,
          highAvg: 0,
          update: () => {
            if (!analyzer) return;
            analyzer.getByteFrequencyData(dataArray);
            const len = dataArray.length;
            const third = Math.floor(len / 3);

            let lowSum = 0;
            let midSum = 0;
            let highSum = 0;
            let totalSum = 0;

            for (let i = 0; i < len; i++) {
              const val = dataArray[i];
              totalSum += val;
              if (i < third) lowSum += val;
              else if (i < third * 2) midSum += val;
              else highSum += val;
            }

            analyzerRef.current!.allAvg = totalSum / len;
            analyzerRef.current!.lowAvg = lowSum / Math.max(1, third);
            analyzerRef.current!.midAvg = midSum / Math.max(1, third);
            analyzerRef.current!.highAvg = highSum / Math.max(1, len - third * 2);
          },
        };
      } catch (e) {
        // Fallback: stay in ambient audio mode without throwing
      }
    }

    if (mode === "mic" || mode === "file") {
      setupAudio();
    } else {
      analyzerRef.current = null;
    }

    return () => {
      cancelled = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (ctx) {
        ctx.close().catch(() => {});
      }
      analyzerRef.current = null;
    };
  }, [mode, audioElement, audioSrc]);

  return analyzerRef;
}

export function useCorsAudioSrc(src: string): string {
  return src;
}
