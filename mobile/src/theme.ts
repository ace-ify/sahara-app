// Sahārā design tokens — ChatGPT-style dark UI.
// Pure-black canvas, #2F2F2F composer, teal brand accent, deep-green user bubbles.
// Devanagari-safe typography (Noto Sans / Noto Serif Devanagari).

export const colors = {
  // canvas / surfaces (Ethereal Clinical OLED Obsidian)
  bg: '#06080D',                 // Deep OLED obsidian canvas
  surface: '#0E1322',            // Clinical obsidian surface
  surfaceWarm: '#13192B',        // Elevated secondary clinical card
  surfaceContainer: '#172036',   // Surface container for nested groups
  surfaceHigh: '#1E2942',        // Interactive button & chip surface
  border: 'rgba(255, 255, 255, 0.08)', // Ultra-refined hairline border
  borderSubtle: 'rgba(255, 255, 255, 0.05)',
  borderActive: 'rgba(16, 185, 129, 0.35)',
  outline: '#64748B',
  text: '#F8FAFC',               // Crisp white-slate primary text
  textMuted: '#94A3B8',          // Balanced secondary clinical text
  textDim: '#64748B',            // Tertiary muted caption text

  // brand: Bioluminescent Precision Emerald
  brand: '#05DF72',              // Luminous high-contrast clinical emerald
  brandDeep: '#10B981',
  brandTint: 'rgba(5, 223, 114, 0.12)',
  onBrand: '#000000',
  teal: '#10B981',
  tealDeep: '#059669',
  tealDark: '#34D399',
  tealTint: 'rgba(16, 185, 129, 0.14)',
  cyan: '#06B6D4',
  cyanTint: 'rgba(6, 182, 212, 0.14)',
  green: '#05DF72',
  saffron: '#F59E0B',

  // emergency (isolated high-visibility crimson - strictly reserved for alerts)
  danger: '#EF4444',
  dangerDeep: '#DC2626',
  dangerDark: '#991B1B',
  dangerTint: 'rgba(239, 68, 68, 0.16)',
  dangerBright: '#F87171',

  // status & utility
  success: '#05DF72',
  successTint: 'rgba(5, 223, 114, 0.12)',
  warn: '#F59E0B',
  warnTint: 'rgba(245, 158, 11, 0.14)',
  white: '#FFFFFF',
  black: '#000000',
  brandSecondary: '#06B6D4',

  // chat-specific tokens
  chatBg: '#06080D',
  composer: '#0E1322',
  iconBtn: '#1E2942',
  bubbleUser: 'rgba(5, 223, 114, 0.15)',
  bubbleUserText: '#F0FDF4',
  bubbleUserBorder: 'rgba(5, 223, 114, 0.28)',
  accent: '#05DF72',
  orbTop: '#05DF72',
  orbMid: '#06B6D4',
  orbBottom: '#0284C7',
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
