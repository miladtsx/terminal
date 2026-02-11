import React, { useMemo, useState } from "react";
import { FileMeta } from "@types";
import { copyToClipboard } from "@utils";
import { formatBytes, formatMtime, getDownloadMeta } from "@utils/fileMeta";

type DownloadIntegrityProps = {
  command?: string;
  meta?: FileMeta;
  label?: string;
};

export function DownloadIntegrity({ command, meta, label = "SHA-256" }: DownloadIntegrityProps) {
  const target = useMemo(
    () => meta ?? (command ? getDownloadMeta(command) : undefined),
    [command, meta],
  );
  const [copied, setCopied] = useState(false);

  if (!target) return null;

  const shortHash = `${target.sha256.slice(0, 12)}…${target.sha256.slice(-6)}`;
  const updated = formatMtime(target.mtime);

  return (
    <div className="t-downloadIntegrity" role="note" aria-label="Download integrity details">
      <div className="t-downloadIntegrity__row">
        <span className="t-downloadIntegrity__label">{label}</span>
        <code className="t-downloadIntegrity__hash" title={target.sha256}>
          {shortHash}
        </code>
        <button
          type="button"
          className="t-downloadIntegrity__copy t-pressable"
          onClick={() => {
            void copyToClipboard(target.sha256);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 900);
          }}
          aria-label="Copy SHA-256 checksum"
        >
          Copy hash
        </button>
        <span className={`t-downloadIntegrity__copied${copied ? " is-visible" : ""}`}>
          Copied
        </span>
      </div>
      <div className="t-downloadIntegrity__meta">
        <span>{formatBytes(target.size)}</span>
        {updated ? (
          <>
            <span aria-hidden="true">·</span>
            <span>updated {updated}</span>
          </>
        ) : null}
        <span className="t-downloadIntegrity__hint">
          verify with <code>verify {target.name}</code>
        </span>
      </div>
    </div>
  );
}
