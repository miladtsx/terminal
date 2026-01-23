import React, { useCallback } from "react";
import { useTerminalController } from "@hooks/useTerminalController";
import { useTerminalFonts } from "@hooks/useTerminalFonts";
import { useNotificationOverlay } from "@hooks/useNotificationOverlay";
import { NotificationOverlay } from "@components/NotificationOverlay";
import { TerminalLineRow } from "@components/TerminalLine";
import { TerminalProps } from "@types";

export default function Terminal(props: TerminalProps) {
  const fontController = useTerminalFonts();
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
    tabMatches,
    tabIndex,
    tabVisible,
  } = useTerminalController({ ...props, fontController });
  const { notification, dismiss } = useNotificationOverlay();
  const showInput = showIntroInput;
  const introRange = introStartLineRange;

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as Element | null;
      if (target && (target.closest(".t-output") || target.closest("a"))) {
        return;
      }
      focusInput();
    },
    [focusInput]
  );

  const suggestStyle: React.CSSProperties = {
    margin: "4px 0 8px",
    padding: "4px 6px",
    background: "rgba(0, 0, 0, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: 6,
    color: "#e8f0ff",
    fontFamily: "var(--terminal-font, 'IBM Plex Mono', monospace)",
    fontSize: 13,
    lineHeight: 1.45,
    maxWidth: "100%",
    userSelect: "none",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.28)",
  };

  const suggestItemStyle: React.CSSProperties = {
    padding: "3px 6px",
    borderRadius: 4,
    transition: "background-color 120ms ease, color 120ms ease",
  };

  return (
      <div
        className={"t-root" + (ready ? " is-ready" : "")}
        onMouseDown={handleMouseDown}
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
        {tabVisible && tabMatches.length ? (
          <div
            className="t-suggest"
            style={suggestStyle}
            role="listbox"
            aria-label="Suggestions"
          >
            {tabMatches.map((item, idx) => (
              <div
                key={item}
                className={`t-suggestItem${
                  idx === tabIndex ? " is-active" : ""
                }`}
                style={
                  idx === tabIndex
                    ? {
                        ...suggestItemStyle,
                        background: "rgba(141, 208, 255, 0.16)",
                        color: "#8dd0ff",
                      }
                    : suggestItemStyle
                }
                role="option"
                aria-selected={idx === tabIndex}
              >
                {item}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
