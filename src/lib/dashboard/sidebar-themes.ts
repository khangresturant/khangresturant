export type SidebarThemeId =
  | "midnight-violet"
  | "ocean-slate"
  | "forest-pro"
  | "carbon-gold"
  | "royal-indigo"
  | "rose-noir"
  | "arctic-light"
  | "charcoal-minimal"
  | "flame9-ember";

export const SIDEBAR_THEME_STORAGE_KEY = "The Accounts_sidebar_theme";
export const DEFAULT_SIDEBAR_THEME_ID: SidebarThemeId = "arctic-light";

/** CSS custom properties consumed by `.dashboard-sidebar` in globals.css */
export type SidebarThemeTokens = Record<`--sb-${string}`, string>;

export type SidebarTheme = {
  id: SidebarThemeId;
  name: string;
  nameUr: string;
  description: string;
  /** Swatch colors for theme picker (Phase 4) */
  preview: [string, string];
  isLight?: boolean;
  tokens: SidebarThemeTokens;
};

const darkShell = (
  base: string,
  glow1: string,
  glow2: string,
  border: string,
  accent: { from: string; via: string; to: string },
  extras?: Partial<SidebarThemeTokens>
): SidebarThemeTokens => ({
  "--sb-bg-base": base,
  "--sb-bg-image": `linear-gradient(180deg, ${base} 0%, color-mix(in srgb, ${base} 88%, #000) 100%), radial-gradient(ellipse at 30% 8%, ${glow1} 0%, transparent 55%), radial-gradient(ellipse at 75% 92%, ${glow2} 0%, transparent 55%)`,
  "--sb-border": border,
  "--sb-border-subtle": `color-mix(in srgb, ${border} 65%, transparent)`,
  "--sb-shadow": "4px 0 50px color-mix(in srgb, var(--sb-active-via) 18%, transparent)",
  "--sb-text": "#f8fafc",
  "--sb-text-muted": "#94a3b8",
  "--sb-text-section": "color-mix(in srgb, var(--sb-text) 75%, var(--sb-active-via))",
  "--sb-active-from": accent.from,
  "--sb-active-via": accent.via,
  "--sb-active-to": accent.to,
  "--sb-active-shadow": "0 10px 28px -8px color-mix(in srgb, var(--sb-active-via) 45%, transparent)",
  "--sb-hover-bg": "rgba(255,255,255,0.06)",
  "--sb-hover-text": "#ffffff",
  "--sb-footer-bg": "color-mix(in srgb, var(--sb-active-via) 8%, transparent)",
  "--sb-glass-bg": "color-mix(in srgb, var(--sb-bg-base) 78%, transparent)",
  "--sb-glass-blur": "14px",
  "--sb-scroll-fade": "color-mix(in srgb, var(--sb-bg-base) 92%, #000)",
  "--sb-search-bg": "rgba(255,255,255,0.06)",
  "--sb-search-border": "rgba(255,255,255,0.08)",
  "--sb-panel-bg": "color-mix(in srgb, var(--sb-bg-base) 82%, #000)",
  "--sb-toggle-bg": "color-mix(in srgb, var(--sb-bg-base) 70%, #1e1b4b)",
  "--sb-toggle-border": border,
  "--sb-brand-from": "#ffffff",
  "--sb-brand-to": "color-mix(in srgb, var(--sb-active-via) 55%, #fff)",
  "--sb-industry-from": accent.from,
  "--sb-industry-to": accent.to,
  "--sb-link-idle": "#94a3b8",
  "--sb-scrollbar-thumb": "color-mix(in srgb, var(--sb-active-via) 35%, transparent)",
  "--sb-panel-text": "#cbd5e1",
  "--sb-panel-text-muted": "#64748b",
  "--sb-panel-hover-bg": "rgba(255,255,255,0.06)",
  "--sb-panel-hover-text": "#ffffff",
  "--sb-panel-selected-bg": "color-mix(in srgb, var(--sb-active-via) 22%, transparent)",
  "--sb-panel-selected-text": "#ffffff",
  "--sb-accent-text": "color-mix(in srgb, var(--sb-active-via) 70%, #fff)",
  "--sb-accent-text-hover": "#ffffff",
  "--sb-meta-text": "#94a3b8",
  "--sb-meta-text-hover": "#ffffff",
  "--sb-fiscal-label": "#64748b",
  "--sb-fiscal-open-bg": "color-mix(in srgb, #10b981 12%, transparent)",
  "--sb-fiscal-open-text": "#6ee7b7",
  "--sb-fiscal-open-border": "color-mix(in srgb, #10b981 28%, transparent)",
  "--sb-fiscal-closed-bg": "color-mix(in srgb, #f59e0b 12%, transparent)",
  "--sb-fiscal-closed-text": "#fcd34d",
  "--sb-fiscal-closed-border": "color-mix(in srgb, #f59e0b 28%, transparent)",
  "--sb-avatar-from": accent.from,
  "--sb-avatar-to": accent.to,
  "--sb-avatar-glow": "0 0 12px color-mix(in srgb, var(--sb-active-via) 35%, transparent)",
  "--sb-divider": "rgba(255,255,255,0.06)",
  "--sb-tooltip-bg": "color-mix(in srgb, var(--sb-bg-base) 75%, #000)",
  "--sb-tooltip-text": "#f8fafc",
  "--sb-skeleton": "rgba(255,255,255,0.06)",
  "--sb-danger": "#fb7185",
  "--sb-danger-bg": "color-mix(in srgb, #f43f5e 12%, transparent)",
  "--sb-icon-btn": "#64748b",
  "--sb-icon-btn-hover": "#ffffff",
  ...extras,
});

const lightShell = (
  base: string,
  accent: { from: string; via: string; to: string },
  extras?: Partial<SidebarThemeTokens>
): SidebarThemeTokens => ({
  "--sb-bg-base": base,
  "--sb-bg-image": `linear-gradient(180deg, #ffffff 0%, ${base} 100%)`,
  "--sb-border": "rgba(15, 23, 42, 0.1)",
  "--sb-border-subtle": "rgba(15, 23, 42, 0.06)",
  "--sb-shadow": "4px 0 40px rgba(15, 23, 42, 0.06)",
  "--sb-text": "#0f172a",
  "--sb-text-muted": "#64748b",
  "--sb-text-section": "#475569",
  "--sb-active-from": accent.from,
  "--sb-active-via": accent.via,
  "--sb-active-to": accent.to,
  "--sb-active-shadow": "0 8px 24px -10px color-mix(in srgb, var(--sb-active-via) 35%, transparent)",
  "--sb-hover-bg": "rgba(15, 23, 42, 0.05)",
  "--sb-hover-text": "#0f172a",
  "--sb-footer-bg": "rgba(15, 23, 42, 0.03)",
  "--sb-glass-bg": "rgba(255, 255, 255, 0.72)",
  "--sb-glass-blur": "16px",
  "--sb-scroll-fade": "color-mix(in srgb, var(--sb-bg-base) 94%, #fff)",
  "--sb-search-bg": "rgba(15, 23, 42, 0.04)",
  "--sb-search-border": "rgba(15, 23, 42, 0.08)",
  "--sb-panel-bg": "#ffffff",
  "--sb-toggle-bg": "#ffffff",
  "--sb-toggle-border": "rgba(15, 23, 42, 0.12)",
  "--sb-brand-from": "#0f172a",
  "--sb-brand-to": accent.via,
  "--sb-industry-from": accent.from,
  "--sb-industry-to": accent.to,
  "--sb-link-idle": "#475569",
  "--sb-scrollbar-thumb": "rgba(71, 85, 105, 0.4)",
  "--sb-panel-text": "#1e293b",
  "--sb-panel-text-muted": "#475569",
  "--sb-panel-hover-bg": "rgba(15, 23, 42, 0.06)",
  "--sb-panel-hover-text": "#0f172a",
  "--sb-panel-selected-bg": "color-mix(in srgb, var(--sb-active-via) 16%, transparent)",
  "--sb-panel-selected-text": "#1e3a8a",
  "--sb-accent-text": "var(--sb-active-via)",
  "--sb-accent-text-hover": "color-mix(in srgb, var(--sb-active-via) 80%, #000)",
  "--sb-meta-text": "#64748b",
  "--sb-meta-text-hover": "#0f172a",
  "--sb-fiscal-label": "#64748b",
  "--sb-fiscal-open-bg": "color-mix(in srgb, #10b981 10%, transparent)",
  "--sb-fiscal-open-text": "#047857",
  "--sb-fiscal-open-border": "color-mix(in srgb, #10b981 25%, transparent)",
  "--sb-fiscal-closed-bg": "color-mix(in srgb, #f59e0b 10%, transparent)",
  "--sb-fiscal-closed-text": "#b45309",
  "--sb-fiscal-closed-border": "color-mix(in srgb, #f59e0b 25%, transparent)",
  "--sb-avatar-from": accent.from,
  "--sb-avatar-to": accent.to,
  "--sb-avatar-glow": "0 4px 14px color-mix(in srgb, var(--sb-active-via) 25%, transparent)",
  "--sb-divider": "rgba(15, 23, 42, 0.08)",
  "--sb-tooltip-bg": "#0f172a",
  "--sb-tooltip-text": "#f8fafc",
  "--sb-skeleton": "rgba(15, 23, 42, 0.06)",
  "--sb-danger": "#e11d48",
  "--sb-danger-bg": "color-mix(in srgb, #f43f5e 10%, transparent)",
  "--sb-icon-btn": "#64748b",
  "--sb-icon-btn-hover": "#0f172a",
  ...extras,
});

export const SIDEBAR_THEMES: SidebarTheme[] = [
  {
    id: "midnight-violet",
    name: "Midnight Violet",
    nameUr: "مڈنائٹ وائلٹ",
    description: "Deep purple executive - default premium look",
    preview: ["#0f0c29", "#8b5cf6"],
    tokens: darkShell("#0f0c29", "rgba(139,92,246,0.18)", "rgba(6,182,212,0.12)", "rgba(139,92,246,0.18)", {
      from: "#2563eb",
      via: "#4f46e5",
      to: "#7c3aed",
    }),
  },
  {
    id: "ocean-slate",
    name: "Ocean Slate",
    nameUr: "اوشن سلیٹ",
    description: "Professional navy with cyan highlights",
    preview: ["#0a1628", "#06b6d4"],
    tokens: darkShell("#0a1628", "rgba(6,182,212,0.16)", "rgba(59,130,246,0.14)", "rgba(6,182,212,0.22)", {
      from: "#0284c7",
      via: "#0891b2",
      to: "#06b6d4",
    }),
  },
  {
    id: "forest-pro",
    name: "Forest Pro",
    nameUr: "فاریسٹ پرو",
    description: "Calm dark green for long counter shifts",
    preview: ["#071a14", "#10b981"],
    tokens: darkShell("#071a14", "rgba(16,185,129,0.15)", "rgba(52,211,153,0.1)", "rgba(16,185,129,0.2)", {
      from: "#047857",
      via: "#059669",
      to: "#10b981",
    }),
  },
  {
    id: "carbon-gold",
    name: "Carbon Gold",
    nameUr: "کاربن گولڈ",
    description: "VIP black with gold accents",
    preview: ["#0c0a09", "#d4af37"],
    tokens: darkShell("#0c0a09", "rgba(212,175,55,0.12)", "rgba(120,113,108,0.1)", "rgba(212,175,55,0.25)", {
      from: "#a16207",
      via: "#ca8a04",
      to: "#eab308",
    }, {
      "--sb-text-section": "#d6d3d1",
    }),
  },
  {
    id: "royal-indigo",
    name: "Royal Indigo",
    nameUr: "رائل انڈigo",
    description: "Corporate indigo - clean and confident",
    preview: ["#0f1029", "#6366f1"],
    tokens: darkShell("#0f1029", "rgba(99,102,241,0.2)", "rgba(129,140,248,0.12)", "rgba(99,102,241,0.22)", {
      from: "#3730a3",
      via: "#4f46e5",
      to: "#6366f1",
    }),
  },
  {
    id: "rose-noir",
    name: "Rose Noir",
    nameUr: "روز نوآر",
    description: "Dark base with rose accent energy",
    preview: ["#1a0a12", "#f43f5e"],
    tokens: darkShell("#1a0a12", "rgba(244,63,94,0.16)", "rgba(190,24,93,0.1)", "rgba(244,63,94,0.22)", {
      from: "#be123c",
      via: "#e11d48",
      to: "#fb7185",
    }),
  },
  {
    id: "arctic-light",
    name: "Arctic Light",
    nameUr: "آرکٹک لائٹ",
    description: "Crisp white executive restaurant sidebar",
    preview: ["#ffffff", "#0f172a"],
    isLight: true,
    tokens: lightShell("#ffffff", {
      from: "#0f172a",
      via: "#1e293b",
      to: "#0f172a",
    }),
  },
  {
    id: "charcoal-minimal",
    name: "Charcoal Minimal",
    nameUr: "چارکول مینیمل",
    description: "Neutral gray - minimal distraction",
    preview: ["#111827", "#9ca3af"],
    tokens: darkShell("#111827", "rgba(156,163,175,0.12)", "rgba(75,85,99,0.15)", "rgba(148,163,184,0.18)", {
      from: "#374151",
      via: "#4b5563",
      to: "#6b7280",
    }),
  },
  {
    id: "flame9-ember",
    name: "Flame 9 Ember",
    nameUr: "فلیم ۹",
    description: "Pizza House & Café - coal black with flame orange",
    preview: ["#14110f", "#ff4d00"],
    tokens: darkShell("#14110f", "rgba(255,77,0,0.22)", "rgba(255,138,61,0.12)", "rgba(255,77,0,0.28)", {
      from: "#c93400",
      via: "#ff4d00",
      to: "#ff8a3d",
    }, {
      "--sb-text-section": "#fdba74",
    }),
  },
];

export function isSidebarThemeId(value: string): value is SidebarThemeId {
  return SIDEBAR_THEMES.some((theme) => theme.id === value);
}

export function getSidebarTheme(id: SidebarThemeId): SidebarTheme {
  return SIDEBAR_THEMES.find((theme) => theme.id === id) ?? SIDEBAR_THEMES[0];
}

export function getSidebarThemeTokens(id: SidebarThemeId): SidebarThemeTokens {
  return getSidebarTheme(id).tokens;
}
