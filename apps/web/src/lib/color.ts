function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

// Whichever of ink/white has the higher WCAG contrast against the accent.
export function accentTextColor(hex: string): "#111111" | "#ffffff" {
  const l = luminance(hex);
  if (l === null) return "#111111";
  const ink = (l + 0.05) / (luminance("#111111")! + 0.05);
  const white = 1.05 / (l + 0.05);
  return white > ink ? "#ffffff" : "#111111";
}
