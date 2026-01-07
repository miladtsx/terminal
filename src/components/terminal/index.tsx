import type { ReactNode } from "react";
import { useTerminalController } from "../../hooks/useTerminalController";
import type {
  TerminalLine,
  CommandSegment,
  CopySegment,
  TerminalProps,
} from "./types";

const copyToClipboard = async (value: string) => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch (err: unknown) {
      console.error(err)
    }
  }
};

function CopyIcon() {
  return (
    <svg
      className="t-copyIcon"
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
      {/* back sheet */}
      <rect x="9" y="9" width="11" height="11" rx="2" />
      {/* front sheet */}
      <rect x="4" y="4" width="11" height="11" rx="2" />
    </svg>
  );
}

function renderLine(
  line: TerminalLine,
  lineIndex: number,
  executeCommand: (command: string) => void
): ReactNode[] {
  const segments: ReactNode[] = line.map((segment, segmentIndex) => {
    const key = `line-${lineIndex}-seg-${segmentIndex}`;
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
        const attrs = segment as CopySegment;
        const label = attrs.label || attrs.value;
        const ariaLabel = attrs.ariaLabel || `Copy ${label}`;
        return (
          <button
            key={key}
            type="button"
            className="t-copyButton"
            aria-label={ariaLabel}
            title={ariaLabel}
            onClick={(event) => {
              event.stopPropagation();
              void copyToClipboard(attrs.value);
            }}
          >
            <CopyIcon />
          </button>
        );
      }
      default:
        return null;
    }
  });

  if (!segments.length) {
    segments.push(
      <span key={`line-${lineIndex}-empty`}></span>
    );
  }

  return segments;
}

export default function Terminal(props: TerminalProps) {
  const {
    ready,
    lines,
    input,
    prompt,
    inputRef,
    scrollRef,
    handleKeyDown,
    onInputChange,
    focusInput,
    executeCommand,
    introStartLineRange,
    introStartVisible,
    showIntroInput,
  } = useTerminalController(props);
  const showInput = showIntroInput;
  const introRange = introStartLineRange;

  return (
    <div
      className={"t-root" + (ready ? " is-ready" : "")}
      onMouseDown={() => focusInput()}
      role="application"
      aria-label="Terminal portfolio"
    >
      <div className="t-wrap" ref={scrollRef}>
        <pre className="t-output" aria-live="polite">
          {lines.map((line, index) => {
            const isIntroLine =
              !!introRange &&
              index >= introRange.start &&
              index < introRange.start + introRange.count;
            const className = isIntroLine
              ? `intro-start-line${introStartVisible ? " is-visible" : ""}`
              : undefined;

            return (
              <span key={`line-${index}`} className={className}>
                {renderLine(line, index, executeCommand)}
                {index < lines.length - 1 ? "\n" : null}
              </span>
            );
          })}
        </pre>

        <div
          className={`t-inputRow${showInput ? "" : " intro-hidden"}`}
          aria-hidden={!showInput}
        >
          {<span className="t-prompt">{prompt}</span>}
          <textarea
            ref={inputRef}
            className="t-input"
            value={input}
            onChange={onInputChange}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            rows={1}
            aria-label="Terminal input"
          />
        </div>
      </div>
    </div>
  );
}
