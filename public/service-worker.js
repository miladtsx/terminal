const CACHE_NAME = "tsx-terminal";
const CORE_ASSETS = ["/", "/index.html", "/resume_tsx.pdf", "/llm_tsx.txt"];

const log = (...args) => {
  console.log(`[${CACHE_NAME} sw]`, ...args);
};

self.addEventListener("install", (event) => {
  log("install");
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        CORE_ASSETS.map(async (url) => {
          try {
            const resp = await fetch(url, { cache: "no-cache" });
            if (resp && resp.ok) {
              await cache.put(url, resp.clone());
            } else {
              log("skip caching (bad response)", url, resp?.status);
            }
          } catch (err) {
            log("skip caching (fetch failed)", url, err);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  log("activate");
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      );
      await self.clients.claim();
    })()
  );
});

function isCacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isCacheable(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        if (request.mode === "navigate") {
          const fallback = await cache.match("/index.html");
          if (fallback) return fallback;
        }
        throw error;
      }
    })()
  );
});

async function gatherCacheEntries() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  return keys.map((req) => {
    const url = new URL(req.url);
    return url.pathname + url.search;
  });
}

async function refreshCoreAssets() {
  const cache = await caches.open(CACHE_NAME);
  const existing = await cache.keys();
  await Promise.all(existing.map((request) => cache.delete(request)));
  try {
    const cached = [];
    for (const url of CORE_ASSETS) {
      try {
        const resp = await fetch(url, { cache: "no-cache" });
        if (resp && resp.ok) {
          await cache.put(url, resp.clone());
          cached.push(url);
        } else {
          log("refresh skip (bad response)", url, resp?.status);
        }
      } catch (error) {
        log("refresh failed", url, error);
      }
    }
    return cached;
  } catch (error) {
    log("refresh failed", error);
    return [];
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  if (!data || !data.type || !port) return;

  const respond = (payload) => {
    try {
      port.postMessage(payload);
    } catch (err) {
      log("postMessage failed", err);
    }
  };

  if (data.type === "OFFLINE_STATUS") {
    event.waitUntil(
      (async () => {
        const entries = await gatherCacheEntries();
        respond({
          type: "OFFLINE_STATUS",
          cacheName: CACHE_NAME,
          entries,
          online: navigator.onLine,
        });
      })()
    );
    return;
  }

  if (data.type === "OFFLINE_REFRESH") {
    event.waitUntil(
      (async () => {
        const entries = await refreshCoreAssets();
        respond({
          type: "OFFLINE_REFRESH_COMPLETE",
          cacheName: CACHE_NAME,
          entries,
        });
      })()
    );
  }
});
