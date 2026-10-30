/**
 * Phase 7 — sidebar theme QA smoke checks (logic-level, no browser).
 * Run: npm run test:sidebar-themes
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const themesPath = join(__dirname, "../src/lib/dashboard/sidebar-themes.ts");
const source = readFileSync(themesPath, "utf8");

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const EXPECTED_THEME_IDS = [
  "midnight-violet",
  "ocean-slate",
  "forest-pro",
  "carbon-gold",
  "royal-indigo",
  "rose-noir",
  "arctic-light",
  "charcoal-minimal",
];

const REQUIRED_TOKENS = [
  "--sb-bg-base",
  "--sb-text",
  "--sb-active-from",
  "--sb-active-via",
  "--sb-active-to",
  "--sb-panel-bg",
  "--sb-glass-bg",
  "--sb-search-bg",
];

for (const id of EXPECTED_THEME_IDS) {
  assert(source.includes(`id: "${id}"`), `theme defined: ${id}`);
}

assert(
  (source.match(/id: "/g) || []).length >= EXPECTED_THEME_IDS.length,
  "expected theme count present"
);

assert(
  source.includes('export const SIDEBAR_THEME_STORAGE_KEY = "hisabx_sidebar_theme"') ||
  source.includes('export const SIDEBAR_THEME_STORAGE_KEY = "The Accounts_sidebar_theme"'),
  "storage key exported"
);
assert(source.includes("isSidebarThemeId"), "theme id guard exported");
assert(source.includes("isLight: true"), "includes at least one light theme");

for (const token of REQUIRED_TOKENS) {
  assert(source.includes(`"${token}"`), `token referenced: ${token}`);
}

assert(source.includes("ui_preferences") === false, "themes file stays presentation-only");

const prefsPath = join(__dirname, "../src/lib/dashboard/sidebar-theme-preference.ts");
const prefsSource = readFileSync(prefsPath, "utf8");
assert(prefsSource.includes("sidebar_theme"), "cloud preference key sidebar_theme");
assert(prefsSource.includes("readSidebarThemeFromPreferences"), "preference reader exported");

const contextPath = join(__dirname, "../src/context/SidebarThemeContext.tsx");
const contextSource = readFileSync(contextPath, "utf8");
assert(contextSource.includes("fetchSidebarThemePreference"), "context loads cloud theme");
assert(contextSource.includes("saveSidebarThemePreference"), "context saves cloud theme");
assert(contextSource.includes("writeLocalSidebarTheme"), "context persists locally");

const navPath = join(__dirname, "../src/components/dashboard/sidebar/SidebarNav.tsx");
const navSource = readFileSync(navPath, "utf8");
assert(navSource.includes('aria-current={active ? "page" : undefined}'), "active nav exposes aria-current");
assert(navSource.includes("sb-nav-search"), "sidebar nav search present");

const pickerPath = join(__dirname, "../src/components/dashboard/SidebarThemePicker.tsx");
const pickerSource = readFileSync(pickerPath, "utf8");
assert(pickerSource.includes("sb-theme-sheet-panel"), "mobile theme sheet present");
assert(pickerSource.includes("theme.tokens"), "mobile sheet inherits theme tokens");

const cssPath = join(__dirname, "../src/app/globals.css");
const cssSource = readFileSync(cssPath, "utf8");
assert(cssSource.includes(":focus-visible"), "focus-visible styles present");
assert(cssSource.includes("[data-sidebar-light=\"true\"]"), "light theme overrides present");
assert(cssSource.includes("prefers-contrast"), "high contrast preference handled");

console.log(process.exitCode ? "\nSidebar theme QA FAILED" : "\nSidebar theme QA PASSED");
