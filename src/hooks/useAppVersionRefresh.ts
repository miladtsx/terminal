import { useEffect, useRef } from "react";
import type { NotificationPayload } from "@types";
import {
  refreshToLatestVersion,
  registerServiceWorker,
  watchForUpdatedVersion,
} from "@utils";

type ShowNotification = (payload: NotificationPayload) => void;

export function useAppVersionRefresh(showNotification: ShowNotification) {
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    let disposed = false;
    let cleanup = () => {};

    const openUpdatePrompt = (registration: ServiceWorkerRegistration) => {
      if (disposed || promptedRef.current) return;
      promptedRef.current = true;

      showNotification({
        title: "Updated version available",
        description:
          "A newer build is reachable online. Refresh to clear the offline snapshot and load the latest version.",
        persistent: true,
        dismissLabel: "Later",
        actions: [
          {
            id: "refresh-latest-version",
            label: "Refresh now",
            variant: "primary",
            onSelect: async () => {
              showNotification({
                title: "Refreshing to latest version",
                description:
                  "Clearing the cached offline snapshot and reloading the newest build.",
                persistent: true,
                dismissLabel: null,
              });

              try {
                await refreshToLatestVersion();
              } catch (error) {
                promptedRef.current = false;
                showNotification({
                  title: "Refresh failed",
                  description:
                    error instanceof Error
                      ? error.message
                      : "Unable to load the latest version right now.",
                  durationMs: 6000,
                });
              }
            },
          },
        ],
      });
    };

    void registerServiceWorker().then((registration) => {
      if (!registration || disposed) return;
      cleanup = watchForUpdatedVersion(registration, openUpdatePrompt);
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [showNotification]);
}
