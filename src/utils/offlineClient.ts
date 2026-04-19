import { OfflineStatus } from "@types";

const MESSAGE_TIMEOUT = 4000;

async function getController(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg.active;
  } catch (error) {
    console.error("service worker ready failed", error);
    return null;
  }
}

async function sendMessage<T = unknown>(payload: unknown): Promise<T | null> {
  const controller = await getController();
  if (!controller) return null;

  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), MESSAGE_TIMEOUT);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data as T);
    };
    controller.postMessage(payload, [channel.port2]);
  });
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const base = (import.meta as any).env?.BASE_URL || "/";
    const swUrl = `${base.replace(/\/$/, "")}/service-worker.js`;
    const scope = base || "/";
    const reg = await navigator.serviceWorker.register(swUrl, {
      scope,
      updateViaCache: "none",
    });
    return reg;
  } catch (error) {
    console.error("service worker registration failed", error);
    return null;
  }
}

function hasActiveServiceWorkerController() {
  return Boolean(navigator.serviceWorker?.controller);
}

export function watchForUpdatedVersion(
  registration: ServiceWorkerRegistration,
  onUpdateReady: (registration: ServiceWorkerRegistration) => void
) {
  let installingWorker: ServiceWorker | null = null;
  let notified = false;

  const notify = () => {
    if (notified || !hasActiveServiceWorkerController()) return;
    notified = true;
    onUpdateReady(registration);
  };

  const handleStateChange = () => {
    if (installingWorker?.state === "installed") {
      notify();
    }
  };

  const trackInstallingWorker = (worker: ServiceWorker | null) => {
    if (installingWorker) {
      installingWorker.removeEventListener("statechange", handleStateChange);
    }

    installingWorker = worker;

    if (!installingWorker) return;
    if (installingWorker.state === "installed") {
      notify();
      return;
    }

    installingWorker.addEventListener("statechange", handleStateChange);
  };

  const handleUpdateFound = () => {
    trackInstallingWorker(registration.installing);
  };

  registration.addEventListener("updatefound", handleUpdateFound);
  if (registration.waiting) {
    notify();
  } else {
    trackInstallingWorker(registration.installing);
  }

  if (navigator.onLine) {
    const timeout = globalThis.setTimeout(() => {
      void registration
        .update()
        .then(() => {
          if (registration.waiting) notify();
        })
        .catch((error) => {
          console.error("service worker update check failed", error);
        });
    }, 0);

    return () => {
      globalThis.clearTimeout(timeout);
      registration.removeEventListener("updatefound", handleUpdateFound);
      if (installingWorker) {
        installingWorker.removeEventListener("statechange", handleStateChange);
      }
    };
  }

  return () => {
    registration.removeEventListener("updatefound", handleUpdateFound);
    if (installingWorker) {
      installingWorker.removeEventListener("statechange", handleStateChange);
    }
  };
}

export async function clearOfflineSnapshot() {
  if (!("serviceWorker" in navigator)) return;

  if ("caches" in globalThis) {
    try {
      const keys = await globalThis.caches.keys();
      await Promise.all(keys.map((key) => globalThis.caches.delete(key)));
    } catch (error) {
      console.error("cache cleanup failed", error);
    }
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.error("service worker unregister failed", error);
  }
}

export async function refreshToLatestVersion() {
  if (!navigator.onLine) {
    throw new Error("Internet access is required to load the latest version.");
  }

  await clearOfflineSnapshot();

  try {
    await fetch(globalThis.location.href, {
      cache: "reload",
      headers: {
        pragma: "no-cache",
        "cache-control": "no-cache",
      },
    });
  } catch (error) {
    console.error("latest version prefetch failed", error);
  }

  globalThis.location.reload();
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  const online = navigator.onLine;
  if (!("serviceWorker" in navigator)) {
    return { supported: false, online, message: "service workers unsupported" };
  }

  const payload = await sendMessage<{ cacheName: string; entries: string[] } | null>(
    { type: "OFFLINE_STATUS" }
  );

  if (!payload) {
    return {
      supported: true,
      online,
      message: "waiting for service worker (try again if newly registered)",
    };
  }

  return {
    supported: true,
    online,
    cacheName: payload.cacheName,
    entries: payload.entries,
  };
}

export async function refreshOfflineResources(): Promise<OfflineStatus> {
  const online = navigator.onLine;
  if (!("serviceWorker" in navigator)) {
    return { supported: false, online, message: "service workers unsupported" };
  }

  const payload = await sendMessage<{ cacheName: string; entries: string[] } | null>(
    { type: "OFFLINE_REFRESH" }
  );

  if (!payload) {
    return {
      supported: true,
      online,
      message: "refresh request sent; reopen or retry to confirm",
    };
  }

  return {
    supported: true,
    online,
    cacheName: payload.cacheName,
    entries: payload.entries,
  };
}

function deleteIndexedDb(name: string) {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

export async function disableOffline(): Promise<OfflineStatus> {
  const online = navigator.onLine;
  if (!("serviceWorker" in navigator)) {
    return { supported: false, online, message: "service workers unsupported" };
  }

  const messages: string[] = [];

  // Unregister service workers for this origin.
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        const success = await reg.unregister();
        messages.push(
          success
            ? `unregistered sw ${reg.scope}`
            : `failed to unregister sw ${reg.scope}`
        );
      })
    );
  } catch (error) {
    console.error("service worker unregister failed", error);
    messages.push("service worker unregister failed");
  }

  // Clear CacheStorage entries.
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      messages.push(
        keys.length ? `deleted caches: ${keys.join(", ")}` : "no caches to delete"
      );
    } catch (error) {
      console.error("cache cleanup failed", error);
      messages.push("cache cleanup failed");
    }
  }

  // Best-effort IndexedDB cleanup (modern Chromium exposes indexedDB.databases()).
  if ("indexedDB" in window) {
    try {
      // Some browsers require databases() to be called with the indexedDB context.
      const dbsFn = (indexedDB as unknown as { databases?: () => Promise<any[]> })
        .databases;
      if (typeof dbsFn === "function") {
        const list = (await dbsFn.call(indexedDB)) || [];
        await Promise.all(
          list.map((db) => (db?.name ? deleteIndexedDb(db.name) : null))
        );
        messages.push(
          list.length
            ? `deleted indexeddb: ${list.map((db) => db.name).join(", ")}`
            : "no indexeddb to delete"
        );
      }
    } catch (error) {
      console.error("indexeddb cleanup failed", error);
      messages.push("indexeddb cleanup failed");
    }
  }

  // LocalStorage fallback in case offline data was persisted there.
  try {
    localStorage.clear();
    messages.push("localStorage cleared");
  } catch {
    // Ignore; localStorage might be disabled.
  }

  return {
    supported: true,
    online,
    cacheName: "disabled",
    entries: [],
    message: messages.join(" | ") || "offline disabled",
  };
}
