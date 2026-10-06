export enum BloopPaletteName {
  blue = "blue",
  emerald = "emerald",
  purple = "purple",
  amber = "amber",
  rose = "rose",
}

export interface BloopPalette {
  main: [number, number, number];
  low: [number, number, number];
  mid: [number, number, number];
  high: [number, number, number];
}

export const BLOOP_PALETTES: Record<BloopPaletteName, BloopPalette> = {
  [BloopPaletteName.blue]: {
    main: [0.1, 0.5, 1.0],
    low: [0.1, 0.2, 0.8],
    mid: [0.2, 0.4, 0.9],
    high: [0.5, 0.8, 1.0],
  },
  [BloopPaletteName.emerald]: {
    main: [0.06, 0.73, 0.51], // Sahārā emerald #10B981
    low: [0.02, 0.35, 0.28],  // Deep teal
    mid: [0.05, 0.65, 0.55],  // Jade
    high: [0.32, 0.95, 0.77], // Mint glow
  },
  [BloopPaletteName.purple]: {
    main: [0.65, 0.25, 0.95],
    low: [0.35, 0.1, 0.6],
    mid: [0.55, 0.2, 0.85],
    high: [0.85, 0.5, 1.0],
  },
  [BloopPaletteName.amber]: {
    main: [0.95, 0.6, 0.1],
    low: [0.7, 0.3, 0.05],
    mid: [0.9, 0.45, 0.08],
    high: [1.0, 0.8, 0.3],
  },
  [BloopPaletteName.rose]: {
    main: [0.95, 0.2, 0.4],
    low: [0.6, 0.1, 0.25],
    mid: [0.85, 0.15, 0.35],
    high: [1.0, 0.5, 0.65],
  },
};
