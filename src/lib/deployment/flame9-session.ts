import { SIDEBAR_THEME_STORAGE_KEY } from "@/lib/dashboard/sidebar-themes";

const MOCK_DB_PREFIX = "mock_db_";

/** Clear cached shop/session data (logout / manual reset only). */
export function clearFlame9ClientCaches() {
  if (typeof window === "undefined") return;
  const keys = [
    "hisabx_shop_context",
    "The Accounts_shop_context",
    "impersonated_shop_id",
    "impersonated_shop_name",
    "impersonated_user_name",
    "is_impersonating",
    SIDEBAR_THEME_STORAGE_KEY,
    "mock_auth_session",
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  try {
    sessionStorage.removeItem("mock_auth_session");
    sessionStorage.removeItem("flame9_whatsapp_draft");
  } catch {
    /* ignore */
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(MOCK_DB_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export function flame9LogoutCleanup() {
  clearFlame9ClientCaches();
}
