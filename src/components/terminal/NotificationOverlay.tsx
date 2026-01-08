import type { OverlayNotification } from "../../hooks/useNotificationOverlay";

type NotificationOverlayProps = {
  notification: OverlayNotification;
  onDismiss: () => void;
};

export function NotificationOverlay({
  notification,
  onDismiss,
}: NotificationOverlayProps) {
  const clampedProgress = Math.min(
    Math.max(notification.progress, 0),
    1
  );

  return (
    <div className="t-notice-backdrop" role="status" aria-live="polite">
      <div className="t-notice card">
        <div className="t-notice-head">
          <div>
            <p className="t-notice-eyebrow">system message</p>
            <h2 className="t-notice-title">{notification.title}</h2>
          </div>
          <button
            type="button"
            className="t-notice-close"
            onClick={onDismiss}
            aria-label="Dismiss notification"
          >
            Skip
          </button>
        </div>
        {notification.description ? (
          <p className="t-notice-body">{notification.description}</p>
        ) : null}
        <div className="t-notice-progress" aria-hidden="true">
          <div
            className="t-notice-progressBar"
            style={{ "--progress": clampedProgress } as React.CSSProperties}
          >
            <span className="t-notice-progressHandle" />
          </div>
        </div>
      </div>
    </div>
  );
}
