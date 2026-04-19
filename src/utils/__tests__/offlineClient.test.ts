import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOfflineSnapshot,
  refreshToLatestVersion,
  watchForUpdatedVersion,
} from "../offlineClient";

class FakeWorker extends EventTarget {
  state: ServiceWorkerState = "installing";
}

class FakeRegistration extends EventTarget {
  waiting: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
  update = vi.fn(async () => undefined);
  unregister = vi.fn(async () => true);
}

const originalNavigator = globalThis.navigator;
const originalLocation = globalThis.location;
const originalCaches = (globalThis as typeof globalThis & { caches?: CacheStorage }).caches;
const originalFetch = globalThis.fetch;

function installNavigator(overrides?: Partial<Navigator>) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      onLine: true,
      serviceWorker: {
        controller: {} as ServiceWorker,
        getRegistrations: vi.fn(async () => []),
      },
      ...overrides,
    },
  });
}

describe("offline client update detection", () => {
  beforeEach(() => {
    installNavigator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  it("prompts when a waiting worker already exists for the controlled page", () => {
    const registration = new FakeRegistration() as unknown as ServiceWorkerRegistration;
    const waitingWorker = new FakeWorker() as unknown as ServiceWorker;
    (registration as unknown as FakeRegistration).waiting = waitingWorker;
    const onUpdateReady = vi.fn();

    const cleanup = watchForUpdatedVersion(registration, onUpdateReady);

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it("ignores first install when the page has no active controller", () => {
    installNavigator({
      onLine: true,
      serviceWorker: {
        controller: null,
        getRegistrations: vi.fn(async () => []),
      } as unknown as ServiceWorkerContainer,
    });
    const registration = new FakeRegistration() as unknown as ServiceWorkerRegistration;
    const installingWorker = new FakeWorker();
    (registration as unknown as FakeRegistration).installing =
      installingWorker as unknown as ServiceWorker;
    const onUpdateReady = vi.fn();

    const cleanup = watchForUpdatedVersion(registration, onUpdateReady);
    installingWorker.state = "installed";
    installingWorker.dispatchEvent(new Event("statechange"));

    expect(onUpdateReady).not.toHaveBeenCalled();
    cleanup();
  });
});

describe("offline snapshot reset", () => {
  beforeEach(() => {
    installNavigator({
      onLine: true,
      serviceWorker: {
        controller: {} as ServiceWorker,
        getRegistrations: vi.fn(async () => [
          new FakeRegistration() as unknown as ServiceWorkerRegistration,
        ]),
      } as unknown as ServiceWorkerContainer,
    });

    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: {
        href: "https://example.com/terminal/",
        reload: vi.fn(),
      },
    });

    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        keys: vi.fn(async () => ["tsx-terminal-old"]),
        delete: vi.fn(async () => true),
      },
    });

    globalThis.fetch = vi.fn(async () => new Response("ok"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation,
    });
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: originalCaches,
    });
    globalThis.fetch = originalFetch;
  });

  it("clears cached offline artifacts before reloading into the latest build", async () => {
    await refreshToLatestVersion();

    expect(globalThis.caches?.keys).toHaveBeenCalledTimes(1);
    expect(globalThis.caches?.delete).toHaveBeenCalledWith("tsx-terminal-old");
    expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/terminal/",
      expect.objectContaining({ cache: "reload" }),
    );
    expect(globalThis.location.reload).toHaveBeenCalledTimes(1);
  });

  it("supports clearing the offline snapshot without touching app state", async () => {
    await clearOfflineSnapshot();

    expect(globalThis.caches?.delete).toHaveBeenCalledWith("tsx-terminal-old");
    expect(navigator.serviceWorker.getRegistrations).toHaveBeenCalledTimes(1);
  });
});
