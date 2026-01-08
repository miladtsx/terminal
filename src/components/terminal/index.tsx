import { useNotificationOverlay } from "@hooks/useNotificationOverlay";
import { NotificationOverlay } from "@components/terminal/NotificationOverlay";
import type {
  TerminalLine,
  CommandSegment,
  CopySegment,
  TerminalProps,
} from "./types";
import { TerminalLineRow } from "@components/terminal/TerminalLine";

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
  const { notification, dismiss } = useNotificationOverlay();
  const showInput = showIntroInput;
  const introRange = introStartLineRange;

  return (
    <div
      className={"t-root" + (ready ? " is-ready" : "")}
      onMouseDown={() => focusInput()}
      role="application"
      aria-label="Terminal portfolio"
    >
      {notification ? (
        <NotificationOverlay notification={notification} onDismiss={dismiss} />
      ) : null}
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
              <span key={`line-${index}`}>
                <TerminalLineRow
                  line={line}
                  lineIndex={index}
                  className={className}
                  executeCommand={executeCommand}
                />
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
