/**
 * RoadmapAI Design System — JS tokens
 * Use these for charts, inline styles, and non-CSS contexts.
 * Keep in sync with app/globals.css :root tokens.
 */

export const colors = {
  background: "#0B0E14",
  surface: "#111827",
  surface2: "#161E2E",
  surface3: "#1C2538",
  surfaceRaised: "#151C2C",
  primary: "#6D5DF6",
  primaryHover: "#7B6CF8",
  primaryMuted: "rgba(109, 93, 246, 0.14)",
  primaryBorder: "rgba(109, 93, 246, 0.28)",
  primarySoft: "#A99FFF",
  primarySoft2: "#C4BBFF",
  primaryGlow: "#8B7FF8",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: {
    primary: "#FFFFFF",
    secondary: "#94A3B8",
    muted: "#64748B",
  },
  border: "rgba(255,255,255,0.06)",
  borderBright: "rgba(255,255,255,0.12)",
  marketing: {
    bg: "#F4F6FB",
    bgMuted: "#E8ECF4",
    card: "#FFFFFF",
    text: "#0B1020",
    muted: "#475569",
  },
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 18,
  xl: 20,
  full: 9999,
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/** Recharts / chart theming defaults */
export const chartTheme = {
  grid: "rgba(255,255,255,0.05)",
  axis: colors.text.muted,
  tooltip: {
    background: colors.surface2,
    border: colors.borderBright,
    text: colors.text.primary,
    muted: colors.text.secondary,
  },
  cursor: "rgba(255,255,255,0.03)",
  series: [
    colors.primary,
    colors.success,
    colors.warning,
    "#38BDF8",
    "#F472B6",
    "#A78BFA",
  ],
  effort: {
    "Quick Win": colors.success,
    Medium: colors.warning,
    Large: colors.danger,
  } as Record<string, string>,
} as const;

export const motion = {
  fast: 140,
  base: 220,
  slow: 360,
} as const;
