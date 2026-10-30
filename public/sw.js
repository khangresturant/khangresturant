const CACHE_NAME = "the-accounts-cache-v6";
const SHELL_ROUTES = [
  "/",
  "/login",
  "/register",
  "/logo.png",
  "/the-accounts-logo.png",
  "/favicon.ico",
];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ROUTES).catch(() => {
      // Some routes may 404 during install — cache individually
      return Promise.all(
        SHELL_ROUTES.map((url) =>
          cache.add(url).catch(() => undefined)
        )
      );
    }))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
    )
  );
  self.clients.claim();
});

function isSkippable(url) {
  return (
    url.includes("/api/") ||
    url.includes("/supabase/") ||
    url.includes("supabase.co") ||
    url.includes("supabase") ||
    url.includes("/rest/v1/") ||
    url.includes("/auth/v1/") ||
    url.includes("/storage/v1/") ||
    url.includes("/realtime/v1/") ||
    url.includes("_next/webpack-hmr") ||
    url.includes("/_next/static/chunks/") ||
    url.includes("/_next/static/media/") ||
    url.includes("__nextjs") ||
    url.includes("turbopack") ||
    url.startsWith("chrome-extension:")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never intercept non-GET, API/Supabase calls, or authenticated requests
  if (
    request.method !== "GET" ||
    isSkippable(request.url) ||
    request.headers.has("authorization") ||
    request.headers.has("apikey")
  ) {
    return;
  }

  const accept = request.headers.get("accept") || "";
  const isDocument = accept.includes("text/html");
  const isNextImage = request.url.includes("/_next/image");

  // Never cache dynamic JS/CSS chunks — avoids stale lucide/HMR module errors
  if (request.url.includes("/_next/static/") && !isNextImage) {
    return;
  }

  // Never cache dynamic dashboard documents in Cache Storage — prevent stale user sessions
  if (isDocument && request.url.includes("/dashboard")) {
    return;
  }

  if (isNextImage) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else (static public assets, landing): network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (isDocument) {
          const root = await caches.match("/");
          if (root) return root;
        }

        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});
