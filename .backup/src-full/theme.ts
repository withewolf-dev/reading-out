import { Platform } from 'react-native';

/** Design tokens — exact values from PRODUCT.md §18. Dark only, by design. */

/**
 * Light theme. This reverses §18's dark-first, artwork-led direction, so the
 * ink scale is black-on-white rather than white-on-black; the cover tint in the
 * reader became a pale wash instead of a deep field for the same reason.
 */
export const Colors = {
  ground: '#FFFFFF',
  /** ink scale */
  primary: 'rgba(0,0,0,0.92)',
  secondary: 'rgba(0,0,0,0.62)',
  inactive: 'rgba(0,0,0,0.45)',
  faint: 'rgba(0,0,0,0.26)',
  /** filled surfaces: cards, chips, wells */
  surface: 'rgba(0,0,0,0.045)',
  surfaceStrong: 'rgba(0,0,0,0.08)',
  highlightFill: 'rgba(0,0,0,0.06)',
  stroke: 'rgba(0,0,0,0.10)',
  cardTop: 'rgba(0,0,0,0.05)',
  cardBottom: 'rgba(0,0,0,0.02)',
  trackEmpty: 'rgba(0,0,0,0.13)',
  trackFill: 'rgba(0,0,0,0.72)',
  accent: '#007AFF',
  /** word highlight: accent behind the spoken word */
  wordHighlight: 'rgba(0,122,255,0.22)',
  /** dims the screen behind a blocking state */
  scrim: 'rgba(0,0,0,0.28)',
  danger: '#FF3B30',
} as const;

export const Radius = {
  hero: 14,
  card: 14,
  miniPlayer: 18,
  shelfCover: 9,
  thumb: 7,
  thumbSmall: 5,
} as const;

/** 4pt grid */
export const Space = { xs: 4, s: 8, m: 12, ms: 14, l: 16, xl: 20 } as const;

export const Screen = { margin: 20, cardPadding: 16 } as const;

/** trade paperback */
export const COVER_ASPECT = 1 / 1.42;
export const CoverWidth = { shelf: 128, hero: 74, mini: 34 } as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal' },
})!;

export const Reader = {
  defaultFontSize: 19,
  minFontSize: 14,
  maxFontSize: 34,
  lineSpacing: 0.35,
} as const;

export const Track = { mini: 2, card: 3, resume: 5 } as const;

/** djb2 — stable across launches, unlike a per-launch-seeded hash (§17.22) */
export function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Deterministic hue for a reading — the cover and the reader's tint share it. */
export function coverHue(title: string): number {
  return djb2(title) % 360;
}

/** Deterministic two-stop fallback cover gradient for a title. */
export function coverColors(title: string): [string, string] {
  const hue = coverHue(title);
  return [hsl(hue, 0.52, 0.46), hsl(hue, 0.6, 0.26)];
}

/**
 * A surface in the reading's own colour. `brightness` is HSB, matching the
 * SwiftUI side so the header, page and dock land on one continuous field.
 */
export function tintedSurface(
  hue: number,
  saturation: number,
  brightness: number,
  alpha = 1
): string {
  return hsl(hue, saturation, brightness, alpha);
}

function hsl(h: number, s: number, b: number, alpha = 1): string {
  // HSB → CSS hsl(), matching the SwiftUI values in §18
  const l = (b * (2 - s)) / 2;
  const sl = l === 0 || l === 1 ? 0 : (b * s) / (1 - Math.abs(2 * l - 1));
  const parts = `${h}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%`;
  return alpha >= 1 ? `hsl(${parts})` : `hsla(${parts}, ${alpha})`;
}
