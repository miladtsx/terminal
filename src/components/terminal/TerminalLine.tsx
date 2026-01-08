import { useEffect, useState } from "react";
import { copyToClipboard } from "@utils";
import type {
  CommandSegment,
  CopySegment,
  LineSegment,
  TerminalLine,
} from "./types";

type TerminalLineProps = {
  line: TerminalLine;
  lineIndex: number;
  className?: string;
  executeCommand: (command: string) => void;
};

function CopyIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`t-copyIcon${active ? " is-active" : ""}`}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <rect x="4" y="4" width="11" height="11" rx="2" />
    </svg>
  );
}

function CopyButton({
  segment,
}: {
  segment: CopySegment;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    if (copied) {
      timer = window.setTimeout(() => setCopied(false), 650);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [copied]);

  const label = segment.label || "Copy";
  const ariaLabel = segment.ariaLabel || `Copy ${label}`;

  return (
    <button
      type="button"
      className="t-copyButton"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={(event) => {
        event.stopPropagation();
        void copyToClipboard(segment.value);
        setCopied(true);
      }}
    >
      <CopyIcon active={copied} />
      <span className={`t-copyState${copied ? " is-visible" : ""}`}>
        {copied && "Copied"}
      </span>
    </button>
  );
}

function renderSegment(
  segment: LineSegment,
  key: string,
  executeCommand: (command: string) => void,
) {
  switch (segment.type) {
    case "text":
      return <span key={key}>{segment.text}</span>;
    case "command": {
      const attrs = segment as CommandSegment;
      const ariaLabel = attrs.ariaLabel || `Run ${attrs.command}`;
      return (
        <button
          key={key}
          type="button"
          className="t-commandLink"
          onClick={() => executeCommand(attrs.command)}
          aria-label={ariaLabel}
        >
          {attrs.label}
        </button>
      );
    }
    case "copy": {
      return (
        <CopyButton
          key={key}
          segment={segment as CopySegment}
        />
      );
    }
    default:
      return null;
  }
}

export function TerminalLineRow({
  line,
  lineIndex,
  className,
  executeCommand,
}: TerminalLineProps) {
  const content =
    line.length === 0
      ? [<span key={`line-${lineIndex}-empty`}></span>]
      : line.map((segment, idx) =>
        renderSegment(
          segment,
          `line-${lineIndex}-seg-${idx}`,
          executeCommand,
        )
      );

  return (
    <span className={className} data-line-index={lineIndex}>
      {content}
    </span>
  );
}
