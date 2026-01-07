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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 5h9a1 1 0 0 1 1 1v11h-1V7H9v11h6v1H8a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm8 2H6a1 1 0 0 0-1 1v12h12a1 1 0 0 0 1-1V8Zm-1 1v10H6V9h9Z" />
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
  } = useTerminalController(props);

  return (
    <div
      className={"t-root" + (ready ? " is-ready" : "")}
      onMouseDown={() => focusInput()}
      role="application"
      aria-label="Terminal portfolio"
    >
      <div className="t-wrap" ref={scrollRef}>
        <pre className="t-output" aria-live="polite">
          {lines.map((line, index) => (
            <span key={`line-${index}`}>
              {renderLine(line, index, executeCommand)}
              {index < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </pre>

        <div className="t-inputRow">
          <span className="t-prompt">{prompt}</span>
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
