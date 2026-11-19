export type RGBA = [number, number, number, number];
export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgba(hex: string, alpha = 255): RGBA {
  const [r, g, b] = hexToRgb(hex);
  return [r, g, b, alpha];
}

export function rgbToHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

export function mix(a: number[], b: number[], t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function darken(c: number[], f: number): RGB {
  return [c[0] * (1 - f), c[1] * (1 - f), c[2] * (1 - f)];
}

/** A palette of distinguishable faction colours. */
export const FACTION_PALETTE = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#a9a9a9',
];

export function paletteColor(i: number): string {
  if (i < FACTION_PALETTE.length) return FACTION_PALETTE[i];
  // golden-angle hue rotation beyond the base palette
  const h = (i * 137.508) % 360;
  return hslToHex(h, 65, 55);
}

export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** Sequential colour ramps for data layers (low → high). */
export const RAMPS: Record<string, string[]> = {
  inferno: ['#000004', '#320a5e', '#781b6c', '#bb3654', '#ec6824', '#fbb41a', '#fcffa4'],
  viridis: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
  ocean: ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#caf0f8'],
  fire: ['#330000', '#880000', '#dd2200', '#ff7700', '#ffcc00', '#ffffaa'],
  ice: ['#081d58', '#225ea8', '#41b6c4', '#c7e9b4', '#ffffff'],
  mono: ['#222222', '#666666', '#aaaaaa', '#ffffff'],
};

export function rampColors(name: string): RGB[] {
  return (RAMPS[name] ?? RAMPS.inferno).map(hexToRgb);
}
