import { useCallback, useEffect, useRef, useState } from "react";

export type OverlayNotification = {
  id: number;
  title: string;
  description?: string;
  durationMs: number;
  progress: number;
};

export type NotificationPayload = {
  title: string;
  description?: string;
  durationMs?: number;
};

const DEFAULT_DURATION = 5000;

export function useNotificationOverlay(defaultDurationMs = DEFAULT_DURATION) {
  const [notification, setNotification] = useState<OverlayNotification | null>(
    null
  );
  // requestAnimationFrame id; null means no frame scheduled
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const durationRef = useRef<number>(defaultDurationMs);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const dismiss = useCallback(() => {
    stopLoop();
    setNotification(null);
  }, [stopLoop]);

  useEffect(() => {
    if (!notification) return;

    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const pct = Math.min(elapsed / durationRef.current, 1);

      setNotification((prev) =>
        prev ? { ...prev, progress: pct } : prev
      );

      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        dismiss();
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => stopLoop();
  }, [notification?.id, dismiss, stopLoop]);

  const showNotification = useCallback(
    ({ title, description, durationMs }: NotificationPayload) => {
      const duration = durationMs ?? defaultDurationMs;
      durationRef.current = duration;
      startRef.current = performance.now();
      stopLoop();

      setNotification({
        id: Date.now(),
        title,
        description,
        durationMs: duration,
        progress: 0,
      });
    },
    [defaultDurationMs, stopLoop]
  );

  return { notification, showNotification, dismiss };
}
