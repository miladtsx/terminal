import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTerminalController } from "@hooks/useTerminalController";
import { useTerminalFonts } from "@hooks/useTerminalFonts";
import { useTerminalColors } from "@hooks/useTerminalColors";
import { useNotificationOverlay } from "@hooks/useNotificationOverlay";
import { NotificationOverlay } from "@components/NotificationOverlay";
import { TerminalLineRow } from "@components/TerminalLine";
import { TerminalProps } from "@types";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  useUiStore,
  useShallow,
} from "@stores/uiStore";
import ChatDock from "./chat";
import { SearchModal } from "./SearchModal";
import { TerminalToolbar } from "./Toolbar";
import { searchStore } from "@stores/searchStore";

export default function Terminal(props: TerminalProps) {
  const fontController = useTerminalFonts();
  const colorController = useTerminalColors();
  const appearanceController = useMemo(
    () => ({ font: fontController, color: colorController }),
    [fontController, colorController],
  );
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
  } = useTerminalController({
    ...props,
    appearanceController,
  });
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sourceEvent?: MouseEvent;
  } | null>(null);
  const allowSystemMenuRef = useRef(false);
  const [easterEggMode, setEasterEggMode] = useState<
    "portfolio" | "autobot" | null
  >(null);
  const { notification, dismiss } = useNotificationOverlay();
  const fontLoading = useUiStore(
    useShallow((state) => ({
      loading: state.fontLoading.loading,
      id: state.fontLoading.id,
      label: state.fontLoading.label,
    })),
  );
  const terminalFontSize = useUiStore((state) => state.terminalFontSize);
  const setTerminalFontSize = useUiStore(
    (state) => state.setTerminalFontSize,
  );
  const [collapsedCommands, setCollapsedCommands] = useState<Record<number, boolean>>({});
  const showInput = showIntroInput;
  const introRange = introStartLineRange;
  const wrapRef = useRef<HTMLDivElement>(null);
  const wrapScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      wrapRef.current = node;
      scrollRef.current = node;
    },
    [scrollRef],
  );
  const MENU_WIDTH = 260;
  const MENU_HEIGHT = 200;
  const CLAMP_MARGIN = 6;
  const clampX = useCallback(
    (rawX: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return rawX;
      const min = rect.left + CLAMP_MARGIN;
      const max = rect.right - MENU_WIDTH - CLAMP_MARGIN;
      return Math.min(Math.max(rawX, min), Math.max(max, min));
    },
    [wrapRef],
  );
  const clampY = useCallback(
    (rawY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return rawY;
      const min = rect.top + CLAMP_MARGIN;
      const max = rect.bottom - MENU_HEIGHT - CLAMP_MARGIN;
      return Math.min(Math.max(rawY, min), Math.max(max, min));
    },
    [wrapRef],
  );
  const contextMenuPosition = useMemo(() => {
    if (!contextMenu) return null;
    return {
      left: clampX(contextMenu.x),
      top: clampY(contextMenu.y),
    };
  }, [contextMenu, clampX, clampY]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as Element | null;
      if (
        target &&
        (target.closest(".t-output") ||
          target.closest("a") ||
          target.closest(".chat-window") ||
          target.closest(".t-searchModal") ||
          target.closest(".terminal-toolbar"))
      ) {
        return;
      }
      focusInput();
    },
    [focusInput]
  );

  const contextMenuItems = useMemo(
    () => [
      {
        id: "human",
        label: "I want to talk to a human",
        meta: "runs `contact`",
        action: () => executeCommand("contact"),
      },
      {
        id: "portfolio",
        label: "Launch portfolio view",
        meta: "auto-typifies a landing experience",
        action: () => {
          executeCommand("portfolio");
          setEasterEggMode("portfolio");
        },
      },
      {
        id: "magic",
        label: "Transform now!",
        meta: "It all started from a terminal ...!",
        action: () => {
          executeCommand("transformer");
          setEasterEggMode("autobot");
        },
      },
    ],
    [executeCommand]
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (allowSystemMenuRef.current) {
        allowSystemMenuRef.current = false;
        return;
      }
      event.preventDefault();
      const target = event.target as Element | null;
      if (target && target.closest("input, textarea, button")) {
        return;
      }
      focusInput();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        sourceEvent: event.nativeEvent,
      });
    },
    [focusInput]
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openSystemMenu = useCallback(
    (source?: MouseEvent) => {
      closeContextMenu();
      const coords = source
        ? { x: source.clientX, y: source.clientY }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      setTimeout(() => {
        allowSystemMenuRef.current = true;
        const synthetic = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: coords.x,
          clientY: coords.y,
        });
        document.dispatchEvent(synthetic);
      });
    },
    [closeContextMenu]
  );

  useEffect(() => {
    const handleClick = () => {
      closeContextMenu();
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        closeContextMenu();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("scroll", handleClick, true);
    document.addEventListener("contextmenu", handleClick, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("scroll", handleClick, true);
      document.removeEventListener("contextmenu", handleClick, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [closeContextMenu]);

  const openSearch = useCallback(() => {
    searchStore.open();
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(".t-searchInput");
      input?.focus();
    });
  }, []);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };

    document.addEventListener("keydown", handleSearchShortcut);
    return () => document.removeEventListener("keydown", handleSearchShortcut);
  }, [openSearch]);

  const adjustFontSize = useCallback(
    (delta: number) => {
      const nextSize = Math.min(
        FONT_SIZE_MAX,
        Math.max(FONT_SIZE_MIN, terminalFontSize + delta),
      );
      if (nextSize === terminalFontSize) return;
      setTerminalFontSize(nextSize);
    },
    [terminalFontSize, setTerminalFontSize],
  );
  const rootStyle = useMemo<React.CSSProperties>(
    () => ({ fontSize: `${terminalFontSize}px` }),
    [terminalFontSize],
  );
  const canDecrease = terminalFontSize > FONT_SIZE_MIN;
  const canIncrease = terminalFontSize < FONT_SIZE_MAX;
  const prevCommandCountRef = useRef<number>(0);

  const commandLines = useMemo(() => {
    return lines
      .map((line, idx) => {
        const first = line[0];
        if (line.length === 1 && typeof first !== "string" && first.type === "text") {
          const text = first.text || "";
          const prefix = `${prompt} `;
          if (text.startsWith(prefix)) {
            return {
              index: idx,
              commandText: text.slice(prefix.length),
            };
          }
        }
        return null;
      })
      .filter((entry): entry is { index: number; commandText: string } => Boolean(entry));
  }, [lines, prompt]);

  useEffect(() => {
    // Drop collapsed markers for lines that no longer exist.
    setCollapsedCommands((prev) => {
      const next: Record<number, boolean> = {};
      commandLines.forEach((cmd) => {
        if (prev[cmd.index]) next[cmd.index] = true;
      });
      return next;
    });

    // Auto-collapse the previous command when a new one arrives.
    if (commandLines.length > prevCommandCountRef.current) {
      const prevCmd = commandLines[commandLines.length - 2];
      if (prevCmd) {
        setCollapsedCommands((prev) => ({ ...prev, [prevCmd.index]: true }));
      }
      prevCommandCountRef.current = commandLines.length;
    } else {
      prevCommandCountRef.current = commandLines.length;
    }
  }, [commandLines]);

  const hiddenLines = useMemo(() => {
    const hidden = new Set<number>();
    commandLines.forEach((cmd, idx) => {
      if (!collapsedCommands[cmd.index]) return;
      const nextStart = commandLines[idx + 1]?.index ?? lines.length;
      for (let i = cmd.index + 1; i < nextStart; i += 1) hidden.add(i);
    });
    return hidden;
  }, [collapsedCommands, commandLines, lines.length]);

  const toggleCollapse = useCallback((lineIndex: number) => {
    setCollapsedCommands((prev) => ({ ...prev, [lineIndex]: !prev[lineIndex] }));
  }, []);

  const commandLookup = useMemo(() => {
    const map = new Map<number, { commandText: string }>();
    commandLines.forEach((cmd) => map.set(cmd.index, { commandText: cmd.commandText }));
    return map;
  }, [commandLines]);

  const suggestStyle: React.CSSProperties = {
    margin: "4px 0 8px",
    padding: "4px 6px",
    background: "var(--suggest-bg, rgba(0, 0, 0, 0.6))",
    border: "1px solid var(--border)",
    borderRadius: 6,
    color: "var(--text)",
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
      style={rootStyle}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
      role="application"
      aria-label="Terminal portfolio"
    >
      {notification ? (
        <NotificationOverlay notification={notification} onDismiss={dismiss} />
      ) : null}
      {fontLoading.loading ? (
        <div className="t-fontLoading" role="status" aria-live="polite">
          <span className="t-fontLoadingDot" aria-hidden="true" />
          Loading {fontLoading.label || "font"}…
        </div>
      ) : null}
      <div className="t-wrap" ref={wrapScrollRef}>
        <pre className="t-output" aria-live="polite">
          {lines.map((line, index) => {
            const isIntroLine =
              !!introRange &&
              index >= introRange.start &&
              index < introRange.start + introRange.count;
            const className = isIntroLine
              ? `intro-start-line${introStartVisible ? " is-visible" : ""}`
              : undefined;

            if (hiddenLines.has(index)) return null;

            const commandMeta = commandLookup.get(index);
            const isCommandLine = Boolean(commandMeta);
            const isCollapsed = isCommandLine && collapsedCommands[index];

            return (
              <span key={`line-${index}`}>
                <TerminalLineRow
                  line={line}
                  lineIndex={index}
                  className={className}
                  executeCommand={executeCommand}
                  isCommandLine={isCommandLine}
                  isCollapsed={isCollapsed}
                  prompt={prompt}
                  commandText={commandMeta?.commandText}
                  onToggleCollapse={isCommandLine ? () => toggleCollapse(index) : undefined}
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
                className={`t-suggestItem${idx === tabIndex ? " is-active" : ""
                  }`}
                style={
                  idx === tabIndex
                    ? {
                      ...suggestItemStyle,
                      background: "var(--suggest-active-bg, rgba(141, 208, 255, 0.16))",
                      color: "var(--suggest-active-color, var(--accent))",
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
        {contextMenu ? (
          <div
            className="t-contextMenu"
            style={
              contextMenuPosition
                ? { top: contextMenuPosition.top, left: contextMenuPosition.left }
                : { top: contextMenu.y, left: contextMenu.x }
            }
            role="menu"
            aria-label="Terminal commands"
          >
            {contextMenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="t-contextMenuItem t-pressable"
                onClick={() => {
                  item.action();
                  closeContextMenu();
                }}
              >
                <span>{item.label}</span>
                <small>{item.meta}</small>
              </button>
            ))}
            <div className="t-contextMenuDivider" />
            <button
              type="button"
              className="t-contextMenuItem system t-pressable"
              onClick={() =>
                openSystemMenu(contextMenu.sourceEvent || undefined)
              }
            >
              <span>System Menu &gt;</span>
              <small>let the OS do its thing</small>
            </button>
          </div>
        ) : null}
        {easterEggMode ? (
          <div className="t-contextHint" role="status" aria-live="polite">
            {easterEggMode === "portfolio"
              ? "Synthesizing portfolio graphics… Visual mode queued."
              : "Autobot transformation online. Expect cinematic mode."}
          </div>
        ) : null}
      </div>
      <TerminalToolbar
        onOpenSearch={openSearch}
        onIncrease={() => adjustFontSize(FONT_SIZE_STEP)}
        onDecrease={() => adjustFontSize(-FONT_SIZE_STEP)}
        canIncrease={canIncrease}
        canDecrease={canDecrease}
      />
      <SearchModal executeCommand={executeCommand} />
      <ChatDock />
    </div>
  );
}
