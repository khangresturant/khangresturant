export const LOCAL_AUTH_COOKIE = "cafe_local_auth";

export type LocalAuthUser = { id: string; email: string };

export function parseLocalAuthFromCookies(
  cookies: { name: string; value: string }[]
): LocalAuthUser | null {
  const raw = cookies.find((c) => c.name === LOCAL_AUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as LocalAuthUser;
    if (parsed?.id && parsed?.email) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function persistLocalAuthCookie(user: LocalAuthUser): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie = `${LOCAL_AUTH_COOKIE}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function clearLocalAuthCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCAL_AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
