// Sahārā design tokens — ChatGPT-style dark UI.
// Pure-black canvas, #2F2F2F composer, teal brand accent, deep-green user bubbles.
// Devanagari-safe typography (Noto Sans / Noto Serif Devanagari).

export const colors = {
  // canvas / surfaces (Ethereal Medical Dark OLED Obsidian)
  bg: '#05070A',                 // deep OLED obsidian canvas
  surface: '#0E131F',            // deep clinical surface
  surfaceWarm: '#131929',        // subtle secondary elevated surface
  surfaceContainer: '#172033',   // container surface
  surfaceHigh: '#1E293B',        // composer + icon circles
  border: '#1E293B',             // refined hairline border
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  outline: '#64748B',
  text: '#F8FAFC',               // crisp white-slate text
  textMuted: '#94A3B8',          // high-readability secondary text
  textDim: '#64748B',

  // brand: Bioluminescent Emerald + Electric Cyan
  brand: '#10B981',              // luminous clinical emerald
  brandDeep: '#059669',
  brandTint: 'rgba(16, 185, 129, 0.14)',
  onBrand: '#FFFFFF',
  teal: '#10B981',
  tealDeep: '#059669',
  tealDark: '#34D399',
  tealTint: 'rgba(16, 185, 129, 0.14)',
  cyan: '#06B6D4',
  cyanTint: 'rgba(6, 182, 212, 0.14)',
  green: '#10B981',
  saffron: '#F59E0B',

  // emergency (isolated high-visibility crimson)
  danger: '#EF4444',
  dangerDeep: '#DC2626',
  dangerDark: '#991B1B',
  dangerTint: 'rgba(239, 68, 68, 0.18)',

  // status
  success: '#10B981',
  successTint: 'rgba(16, 185, 129, 0.14)',
  warn: '#F59E0B',
  warnTint: 'rgba(245, 158, 11, 0.14)',
  white: '#FFFFFF',
  black: '#000000',
  dangerBright: '#F87171',
  brandSecondary: '#06B6D4',

  // chat-specific tokens
  chatBg: '#05070A',
  composer: '#0E131F',
  iconBtn: '#1E293B',
  bubbleUser: 'rgba(16, 185, 129, 0.20)',
  bubbleUserText: '#ECFDF5',
  accent: '#10B981',
  orbTop: '#34D399',
  orbMid: '#06B6D4',
  orbBottom: '#0E7490',
} as const;

// variants whose headlines render in SERIF (editorial voice); rest are sans.
export const type = {
  display: 30, h1: 24, h2: 20, body: 17, label: 15, small: 13, number: 36,
} as const;
export const serifVariants = ['display', 'h1', 'h2'] as const;

export const serif = {
  semibold: 'NotoSerifDevanagari_600SemiBold',
  bold: 'NotoSerifDevanagari_700Bold',
} as const;
export const sans = {
  regular: 'NotoSansDevanagari_400Regular',
  medium: 'NotoSansDevanagari_500Medium',
  semibold: 'NotoSansDevanagari_600SemiBold',
  bold: 'NotoSansDevanagari_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const touch = { min: 48, primary: 56 } as const;

// ChatGPT-style: everything is sans. (Serif fonts are still loaded for any
// future editorial surface, but the product UI is now uniformly sans.)
export function fontFor(_variant: keyof typeof type, weight: 'regular' | 'medium' | 'semibold' | 'bold') {
  return sans[weight];
}

export const theme = { colors, type, serif, sans, space, radius, touch };
