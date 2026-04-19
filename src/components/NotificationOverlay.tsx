import { useEffect, useState } from "react";
import { NotificationOverlayProps } from "@types";

export function NotificationOverlay({
  notification,
  onDismiss,
}: NotificationOverlayProps) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const clampedProgress = Math.min(
    Math.max(notification.progress, 0),
    1
  );
  const showActions = Boolean(notification.actions?.length);
  const canDismiss = notification.dismissLabel !== null;

  useEffect(() => {
    setPendingActionId(null);
  }, [notification.id]);

  const handleAction = async (
    action: NonNullable<typeof notification.actions>[number]
  ) => {
    if (!action.onSelect || pendingActionId) return;

    setPendingActionId(action.id);
    try {
      await action.onSelect();
    } finally {
      setPendingActionId(null);
    }
  };

  return (
    <div
      className="t-notice-backdrop"
      role={showActions ? "dialog" : "status"}
      aria-live={showActions ? undefined : "polite"}
      aria-modal={showActions ? true : undefined}
    >
      <div className="t-notice card">
        <div className="t-notice-head">
          <div>
            <p className="t-notice-eyebrow">system message</p>
            <h2 className="t-notice-title">{notification.title}</h2>
          </div>
          {canDismiss ? (
            <button
              type="button"
              className="t-notice-close"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              disabled={Boolean(pendingActionId)}
            >
              {notification.dismissLabel ?? "Skip"}
            </button>
          ) : null}
        </div>
        {notification.description ? (
          <p className="t-notice-body">{notification.description}</p>
        ) : null}
        {showActions ? (
          <div className="t-notice-actions">
            {notification.actions?.map((action) => {
              const isPending = pendingActionId === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  className={`t-notice-action${action.variant === "primary" ? " is-primary" : ""}`}
                  onClick={() => void handleAction(action)}
                  disabled={Boolean(pendingActionId)}
                >
                  {isPending ? "Working…" : action.label}
                </button>
              );
            })}
          </div>
        ) : null}
        {notification.persistent ? null : (
          <div className="t-notice-progress" aria-hidden="true">
            <div
              className="t-notice-progressBar"
              style={{ "--progress": clampedProgress } as React.CSSProperties}
            >
              <span className="t-notice-progressHandle" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
