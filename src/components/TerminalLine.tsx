import { useEffect, useState } from "react";
import { MarkdownBlock } from "@components/MarkdownBlock";
import { copyToClipboard, buildShareLink } from "@utils";
import {
  CommandSegment,
  CopySegment,
  FaqSegment,
  LogSegment,
  LineSegment,
  TerminalLineProps,
  MarkdownSegment,
} from "@types";

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

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="t-eyeIcon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
      {open ? <circle cx="12" cy="12" r="7" opacity="0" /> : null}
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
    case "faq": {
      const faq = segment as FaqSegment;
      return <FaqAccordion key={key} items={faq.items} />;
    }
    case "logs": {
      const logs = segment as LogSegment;
      return <LogAccordion key={key} items={logs.items} />;
    }
    case "markdown": {
      return <MarkdownBlock key={key} segment={segment as MarkdownSegment} />;
    }
    default:
      return null;
  }
}

function FaqAccordion({ items }: { items: FaqSegment["items"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="t-faq">
      {items.map((item, idx) => {
        const open = openIndex === idx;
        return (
          <div key={idx} className={`t-faqItem${open ? " is-open" : ""}`}>
            <button
              type="button"
              className="t-faqSummary"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : idx)}
            >
              <span className="t-faqChevron" aria-hidden="true">
                ▸
              </span>
              {item.question}
            </button>
            <div
              className="t-faqAnswer"
              style={{ maxHeight: open ? "320px" : "0px" }}
            >
              <div className="t-faqAnswerInner">{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogAccordion({ items }: { items: LogSegment["items"] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="t-logAccordion">
      {items.map((item, idx) => {
        const isOpen = openIndex === idx;
        const shareCommand =
          item.slug &&
          (item.kind === "blog" ? `blog read ${item.slug}` : `logs read ${item.slug}`);
        const shareText =
          shareCommand && typeof window !== "undefined"
            ? buildShareLink(shareCommand, window.location.href)
            : `${item.date} — ${item.note}`;
        return (
          <div key={idx} className={`t-logItem${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="t-logSummary"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
            >
              <span className="t-logChevron" aria-hidden="true">
                ▸
              </span>
              <span className="t-logTitle">{item.note}</span>
              <span className="t-logDate">{item.date}</span>
              {item.body ? <EyeIcon open={isOpen} /> : null}
            </button>

            <div
              className="t-logPanel"
              style={{ maxHeight: isOpen ? "700px" : "0px" }}
            >
              <div className="t-logPanelInner">
                {item.body ? (
                  <MarkdownBlock
                    segment={{ type: "markdown", markdown: item.body, title: item.note }}
                  />
                ) : (
                  <div className="t-logEmpty">No content</div>
                )}
                {shareCommand ? (
                  <button
                    type="button"
                    className="t-logShare"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(shareText);
                    }}
                    aria-label={`Copy share command for ${item.note}`}
                    title="Copy to share"
                  >
                    Copy to share
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TerminalLineRow({
  line,
  lineIndex,
  className,
  executeCommand,
}: TerminalLineProps) {
  const hasCommandSegments = line.some(
    (segment) => typeof segment !== "string" && segment.type === "command",
  );

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
    <span
      className={`${className || ""}${hasCommandSegments ? " has-commands" : ""}`.trim()}
      data-line-index={lineIndex}
    >
      {content}
    </span>
  );
}
