/**
 * ë • HQ design tokens — typed mirror of visual-tokens.css.
 * Single source for TS/Svelte. Brand accent locked to #FFB800.
 * Import these instead of hardcoding values.
 */
export const tokens = {
  color: {
    yellow: "#FFB800",
    yellowHover: "#FFC633",
    yellowActive: "#E6A600",
    yellowMuted: "rgba(255,184,0,0.13)",
    yellowBorder: "rgba(255,184,0,0.45)",

    black: "#0D0F14",
    bgMain: "#0D0F14",
    surface: "#171B22",
    surfaceHigh: "#222831",
    surfaceRaised: "#30363D",

    text: "#FFFFFF",
    textMuted: "rgba(255,255,255,0.48)",
    textSoft: "rgba(255,255,255,0.74)",
    textSecondary: "var(--ehq-text-soft)",
    textDisabled: "rgba(255,255,255,0.30)",
    textOnYellow: "#0A0A0A",

    border: "rgba(255,255,255,0.11)",
    borderSoft: "rgba(255,255,255,0.06)",
    borderStrong: "rgba(255,184,0,0.42)",

    success: "#22C55E",
    info: "#3B82F6",
    warning: "#FBBF24",
    error: "#FF3B30",
    purple: "#A855F7",
  },
  font: {
    body: "'Inter',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif",
    display: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    mono: "'Space Mono','SFMono-Regular','JetBrains Mono',Consolas,monospace",
    size: { h1: "32px", h2: "24px", h3: "18px", body: "16px", small: "14px", caption: "12px" },
    weight: { display: "600", heading: "500", body: "400", label: "400", figure: "400" },
    roleColor: { heading: "var(--ehq-text-secondary)", label: "var(--ehq-text-muted)" },
  },
  space: { 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "24px", 6: "32px", 7: "40px", 8: "48px" },
  radius: { sm: "8px", md: "12px", lg: "16px", xl: "22px", pill: "999px" },
  shadow: {
    sm: "0 4px 16px rgba(0,0,0,0.28)",
    md: "0 12px 36px rgba(0,0,0,0.34)",
    lg: "0 24px 72px rgba(0,0,0,0.48)",
    glowYellow: "0 0 0 1px rgba(255,184,0,0.26),0 0 28px rgba(255,184,0,0.12)",
  },
  edge: {
    featherDistance: "20px",
    hairlineOpacity: "0.95",
    navHighlightOpacity: "1",
    navHighlightHairlineOpacity: "0.55",
  },
  workspace: {
    office: { accent: "var(--ehq-workspace-office)", background: "var(--ehq-workspace-office-bg)" },
    distribution: {
      accent: "var(--ehq-workspace-distribution)",
      background: "var(--ehq-workspace-distribution-bg)",
    },
    commandCenter: {
      accent: "var(--ehq-workspace-command)",
      background: "var(--ehq-workspace-command-bg)",
    },
  },
  layout: {
    sidebarWidth: "264px",
    sidebarCollapsedWidth: "76px",
    topbarHeight: "72px",
    contentMax: "1480px",
    pageGap: "24px",
    sectionGap: "16px",
    tableMinWidth: "760px",
  },
  stateSurface: {
    emptyBackground: "var(--ehq-state-empty-bg)",
    loadingBackground: "var(--ehq-state-loading-bg)",
    disabledBackground: "var(--ehq-state-disabled-bg)",
    disabledBorder: "var(--ehq-state-disabled-border)",
    disabledText: "var(--ehq-state-disabled-text)",
  },
  motion: { fast: "120ms ease", normal: "180ms ease" },
} as const;

export type Tokens = typeof tokens;
export default tokens;
