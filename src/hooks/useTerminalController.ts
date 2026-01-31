import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { CommandRegistry } from "@components/terminal/commandRegistry";
import {
  registerDefaultCommands,
  DEFAULT_SUGGESTED_COMMANDS,
  formatCommandToButton,
} from "@components/terminal/defaultCommands";
import { TerminalModel } from "@components/terminal/terminalModel";
import { appendHistory, loadHistory } from "@components/terminal/historyStore";
import {
  TerminalProps,
  TerminalLineInput,
  ControllerReturn,
  TerminalState,
  CommandOutput,
  LineSegment,
  AvatarSegment,
} from "@types";
import {
  buildAvatarSegment,
  createTypeSfx,
  getGreeting,
  humanDelay,
  listThemes,
  parseShareCommandsFromLocation,
  simulateTypingSequence,
} from "@utils";
import { useTelemetry } from "@hooks/useTelemetry";

export function useTerminalController(props: TerminalProps): ControllerReturn {
  const typeSfxRef = useRef<ReturnType<typeof createTypeSfx> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Leave scroll position alone so users can stay at the prompt and scroll manually.
  const modelRef = useRef(new TerminalModel({ prompt: props.prompt || ">" }));
  const registryRef = useRef(new CommandRegistry());
  const inputFromHistory = useRef(false);
  const initialPropsRef = useRef(props);
  const hasInitializedRef = useRef(false);
  const suppressHistoryRef = useRef(false);
  const parsedShareCommands = useMemo(() => {
    if (typeof window === "undefined") return [];
    return parseShareCommandsFromLocation(window.location);
  }, []);
  const sharedCommandsRef = useRef<string[] | null>(
    parsedShareCommands.length ? parsedShareCommands : null,
  );
  const themes = useMemo(() => listThemes(), []);
  const { logEvent, logError } = useTelemetry();
  const fontControllerRef = useRef(props.appearanceController?.font);
  const colorControllerRef = useRef(props.appearanceController?.color);
  const previewBaseRef = useRef<string | null>(null);
  const previewColorBaseRef = useRef<string | null>(null);
  const themePreviewingRef = useRef(false);
  const [allowProgrammaticFocus, setAllowProgrammaticFocus] = useState(true);
  const coarsePointerRef = useRef(false);

  const detectCoarsePointer = useCallback(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    } catch {
      return false;
    }
  }, []);

  const [state, setState] = useState<TerminalState>({
    ready: false,
    input: "",
    tabPrefix: "",
    tabMatches: [],
    tabIndex: 0,
    tabVisible: false,
    lines: [],
  });

  const setLinesFromModel = useCallback(
    (extraLines: TerminalLineInput[] = []) => {
      const model = modelRef.current;
      if (!model) return;
      if (extraLines.length) {
        model.pushLines(extraLines);
      }
      setState((prev) => ({ ...prev, lines: [...model.lines] }));
    },
    [],
  );

  const normalizeCommandOutput = useCallback(
    (value: CommandOutput): TerminalLineInput[] => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    },
    [],
  );

  const focusInput = useCallback(() => {
    if (!allowProgrammaticFocus) return;
    inputRef.current?.focus();
  }, [allowProgrammaticFocus]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const autoGrow = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, []);

  const resetTabState = useCallback((options?: { revertPreview?: boolean }) => {
    if (options?.revertPreview !== false) {
      void fontControllerRef.current?.resetPreview?.();
      previewBaseRef.current = null;
      void colorControllerRef.current?.resetPreview?.();
      previewColorBaseRef.current = null;
      themePreviewingRef.current = false;
    }

    setState((prev) => ({
      ...prev,
      tabPrefix: "",
      tabMatches: [],
      tabIndex: 0,
      tabVisible: false,
    }));
  }, []);

  const buildSuggestions = useCallback(
    (
      rawInput: string,
    ): { matches: string[]; prefix: string; isSubcommand: boolean } => {
      const raw = rawInput || "";
      const hasTrailingSpace = /\s$/.test(raw);
      const parts = raw.trim().split(/\s+/).filter(Boolean);

      const commandTokenOriginal = parts[0] || "";
      if (!commandTokenOriginal) {
        return { matches: [], prefix: "", isSubcommand: false };
      }

      const canonicalCommand =
        registryRef.current.getCanonicalName(commandTokenOriginal) ||
        commandTokenOriginal;

      const inSubcommand = parts.length > 1 || hasTrailingSpace;
      const subPrefix = (() => {
        if (!inSubcommand) return "";
        if (parts.length === 1 && hasTrailingSpace) return "";
        if (parts.length > 1 && hasTrailingSpace && parts.length === 2)
          return "";
        return parts.length > 1 ? parts[parts.length - 1] || "" : "";
      })();

      if (inSubcommand) {
        const subMatches = registryRef.current.suggestSubcommands(
          canonicalCommand,
          {
            prefix: subPrefix,
            parts,
            raw,
            hasTrailingSpace,
          },
        );

        const matches = subMatches.map((sub) =>
          sub.startsWith(canonicalCommand)
            ? sub
            : `${canonicalCommand} ${sub}`.trim(),
        );

        return {
          matches,
          prefix: `${canonicalCommand} ${subPrefix}`.trim(),
          isSubcommand: true,
        };
      }

      const matches = registryRef.current.suggest(commandTokenOriginal);
      return { matches, prefix: commandTokenOriginal, isSubcommand: false };
    },
    [],
  );

  const extractDisplayFontId = useCallback((input: string): string | null => {
    const match = input.trim().match(/^display\s+font\s+([^\s]+)$/i);
    return match ? match[1] : null;
  }, []);

  const extractDisplayColorId = useCallback((input: string): string | null => {
    const match = input.trim().match(/^display\s+color\s+([^\s]+)$/i);
    return match ? match[1] : null;
  }, []);

  const extractThemeId = useCallback((input: string): string | null => {
    const match = input.trim().match(/^theme\s+(?:set\s+)?([^\s]+)$/i);
    return match ? match[1] : null;
  }, []);

  const findThemeById = useCallback(
    (id: string) =>
      themes.find((t) => t.id.toLowerCase() === id.trim().toLowerCase()),
    [themes],
  );

  const previewFontFromInput = useCallback(
    (input: string) => {
      const fontId = extractDisplayFontId(input);
      if (!fontId) {
        if (previewBaseRef.current) {
          void fontControllerRef.current?.resetPreview?.();
        }
        previewBaseRef.current = null;
        return;
      }

      if (!previewBaseRef.current) {
        const current = fontControllerRef.current?.getCurrentFont();
        previewBaseRef.current = current?.id ?? null;
      }

      void fontControllerRef.current?.previewFont(fontId).catch(() => {
        // ignore preview failures
      });
    },
    [extractDisplayFontId],
  );

  const previewColorFromInput = useCallback(
    (input: string) => {
      const colorId = extractDisplayColorId(input);
      if (!colorId) {
        if (previewColorBaseRef.current) {
          void colorControllerRef.current?.resetPreview?.();
        }
        previewColorBaseRef.current = null;
        return;
      }

      if (!previewColorBaseRef.current) {
        const current = colorControllerRef.current?.getCurrentColor();
        previewColorBaseRef.current = current?.id ?? null;
      }

      void colorControllerRef.current?.previewColor(colorId).catch(() => {
        /* ignore preview failures */
      });
    },
    [extractDisplayColorId],
  );

  const previewThemeFromInput = useCallback(
    (input: string) => {
      const themeId = extractThemeId(input);
      if (!themeId) {
        if (themePreviewingRef.current) {
          void fontControllerRef.current?.resetPreview?.();
          void colorControllerRef.current?.resetPreview?.();
          themePreviewingRef.current = false;
        }
        return;
      }

      const pack = findThemeById(themeId);
      if (!pack) {
        if (themePreviewingRef.current) {
          void fontControllerRef.current?.resetPreview?.();
          void colorControllerRef.current?.resetPreview?.();
          themePreviewingRef.current = false;
        }
        return;
      }

      themePreviewingRef.current = true;
      void colorControllerRef.current?.previewColor(pack.colorId).catch(() => {
        /* ignore preview failures */
      });
      void fontControllerRef.current?.previewFont(pack.fontId).catch(() => {
        /* ignore preview failures */
      });
    },
    [extractThemeId, findThemeById],
  );

  const typingTimersRef = useRef<number[]>([]);
  const introTimersRef = useRef<number[]>([]);
  const introTypingRef = useRef(false);
  const [introStartLineRange, setIntroStartLineRange] = useState<{
    start: number;
    count: number;
  } | null>(null);
  const [introStartVisible, setIntroStartVisible] = useState(false);
  const [showIntroInput, setShowIntroInput] = useState(false);

  const cancelTyping = useCallback(() => {
    typingTimersRef.current.forEach((id) => clearTimeout(id));
    typingTimersRef.current = [];
  }, []);

  const cancelIntroTyping = useCallback(() => {
    introTimersRef.current.forEach((id) => clearTimeout(id));
    introTimersRef.current = [];
    if (!introTypingRef.current) {
      return;
    }
    introTypingRef.current = false;
    setIntroStartLineRange(null);
    setIntroStartVisible(false);
    setShowIntroInput(true);
  }, []);

  const startIntroSequence = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;

    introTypingRef.current = true;
    const greeting = getGreeting();

    model.pushLine("");
    setLinesFromModel();

    const typing = simulateTypingSequence(greeting, {
      onChar: (typed) => {
        model.setLine(0, typed);
        setLinesFromModel();
      },
    });

    const timers: number[] = [...typing.timers];

    const suggested =
      initialPropsRef.current.suggestedCommands || DEFAULT_SUGGESTED_COMMANDS;
    setShowIntroInput(false);

    const typeIntroStartLines = (extraTimers: number[]) => {
      const startLines = formatCommandToButton(
        `I build reliable, production-ready systems.
        `,
        suggested,
      )();

      if (startLines.length && typeof startLines[0] === "string") {
        startLines[0] = [
          buildAvatarSegment([startLines[0]], {
            label: "Milad",
            meta: "Senior Backend & Full Stack Engineer",
          }),
        ];
      }

      if (!startLines.length) {
        setShowIntroInput(true);
        focusInput();
        return;
      }

      const flattenLine = (line: TerminalLineInput) => {
        if (typeof line === "string") return line;
        return line
          .map((segment) => {
            if (segment.type === "text") return segment.text;
            if (segment.type === "command") return segment.label;
            if (segment.type === "copy") return segment.label || segment.value;
            if (segment.type === "avatar") return segment.lines.join(" ");
            return "";
          })
          .join("");
      };

      const sliceSegment = (segment: LineSegment, remaining: number) => {
        switch (segment.type) {
          case "text": {
            const text = segment.text.slice(0, remaining);
            return text.length
              ? [{ ...segment, text }, text.length]
              : [null, 0];
          }
          case "command": {
            const label = segment.label.slice(0, remaining);
            return label.length
              ? [{ ...segment, label }, label.length]
              : [null, 0];
          }
          case "copy": {
            const base = segment.label || segment.value;
            const label = base.slice(0, remaining);
            return label.length
              ? [{ ...segment, label }, label.length]
              : [null, 0];
          }
          case "avatar": {
            const avatar = segment as AvatarSegment;
            if (!avatar.lines.length) return [null, 0];
            let remainingChars = remaining;
            const outLines: string[] = [];
            let consumedChars = 0;

            for (
              let idx = 0;
              idx < avatar.lines.length && remainingChars > 0;
              idx++
            ) {
              const line = avatar.lines[idx];
              const hasSeparator = idx < avatar.lines.length - 1;
              const lineLen = line.length;
              const totalLen = lineLen + (hasSeparator ? 1 : 0);

              if (remainingChars <= lineLen) {
                outLines.push(line.slice(0, remainingChars));
                consumedChars += remainingChars;
                remainingChars = 0;
                break;
              }

              outLines.push(line);
              consumedChars += lineLen;
              remainingChars -= lineLen;

              if (hasSeparator && remainingChars > 0) {
                consumedChars += 1;
                remainingChars -= 1;
              }
            }

            if (!outLines.length) return [null, 0];
            return [
              {
                ...avatar,
                lines: outLines,
              },
              consumedChars,
            ];
          }
          default: {
            // For rich blocks (faq/log/markdown), only show when fully revealed
            const len = flattenLine([segment]).length;
            return remaining >= len ? [segment, len] : [null, 0];
          }
        }
      };

      const sliceLine = (
        line: TerminalLineInput,
        visible: number,
      ): TerminalLineInput => {
        if (typeof line === "string") return line.slice(0, visible);

        let remaining = visible;
        const out: LineSegment[] = [];

        for (const segment of line) {
          if (remaining <= 0) break;
          const [partial, consumed] = sliceSegment(segment, remaining);
          if (partial) out.push(partial);
          remaining -= consumed;
        }

        return out;
      };

      const lineTexts = startLines.map(flattenLine);
      const blankIndex = model.lines.length;
      model.pushLine("");
      startLines.forEach(() => model.pushLine(""));
      setLinesFromModel();

      const firstLineIndex = blankIndex + 1;
      // Mark intro suggestion block immediately so mobile layout applies from first paint.
      setIntroStartLineRange({
        start: firstLineIndex,
        count: startLines.length,
      });
      setIntroStartVisible(true);
      let offset = 120;
      lineTexts.forEach((lineText, lineIndex) => {
        for (let i = 0; i < lineText.length; i++) {
          const ch = lineText[i];
          const prev = lineText.slice(0, i);
          offset += humanDelay(prev, ch) * 0.1;
          const timer = window.setTimeout(() => {
            model.setLine(
              firstLineIndex + lineIndex,
              sliceLine(startLines[lineIndex], i + 1),
            );
            setLinesFromModel();
          }, offset);
          extraTimers.push(timer);
        }
        offset += 140;
      });

      const finalizeTimer = window.setTimeout(() => {
        startLines.forEach((line, index) => {
          model.setLine(firstLineIndex + index, line);
        });
        setLinesFromModel();
        setIntroStartLineRange({
          start: firstLineIndex,
          count: startLines.length,
        });
        introTypingRef.current = false;
        setShowIntroInput(true);
        focusInput();
      }, offset);

      extraTimers.push(finalizeTimer);
    };

    const startBlockDelay = typing.duration + 80;
    const startBlockTimer = window.setTimeout(() => {
      typeIntroStartLines(timers);
    }, startBlockDelay);

    timers.push(startBlockTimer);
    introTimersRef.current = timers;
  }, [
    focusInput,
    setLinesFromModel,
    setIntroStartLineRange,
    setIntroStartVisible,
    setShowIntroInput,
  ]);

  const runCommand = useCallback(
    async (raw: string) => {
      const cmd = (raw || "").trim();
      if (!cmd) return;

      if (themePreviewingRef.current) {
        themePreviewingRef.current = false;
      }

      const model = modelRef.current;
      const registry = registryRef.current;
      if (!model || !registry) return;

      const stored = suppressHistoryRef.current ? false : model.remember(cmd);
      if (stored) void appendHistory(cmd);
      model.echoCommand(cmd);

      const [name, ...args] = cmd.split(/\s+/);
      const entry = registry.get(name);

      if (!entry) {
        setLinesFromModel([`unknown command: ${name}`, `try: help`, ""]);
        return;
      }

      try {
        const out = await Promise.resolve(
          entry.handler({ args, raw: cmd, model, registry }),
        );
        const lines = normalizeCommandOutput(out);
        setLinesFromModel(lines.concat(lines.length ? [""] : []));
        void logEvent({
          action: name,
          userInput: cmd,
          message: "command executed",
        });
      } catch (error) {
        setLinesFromModel([
          `error: ${(error as Error)?.message || "command failed"}`,
          "",
        ]);
        void logError({
          action: name,
          userInput: cmd,
          message: "command execution failed",
          error,
        });
      }
    },
    [logError, logEvent, setLinesFromModel, normalizeCommandOutput],
  );

  const getTypeSfx = () => {
    if (!typeSfxRef.current) typeSfxRef.current = createTypeSfx();
    return typeSfxRef.current;
  };

  const executeCommand = useCallback(
    (command: string) => {
      const normalized = (command || "").trim();
      if (!normalized) return;

      cancelIntroTyping();
      cancelTyping();
      resetTabState();
      inputFromHistory.current = false;
      setState((prev) => ({ ...prev, input: "" }));
      focusInput();

      const { tick } = getTypeSfx();
      const typing = simulateTypingSequence(normalized, {
        onChar: (typed, ch) => {
          setState((prev) => ({ ...prev, input: typed }));
          if (ch !== " ") tick();
        },
      });

      const finalTimer = window.setTimeout(() => {
        void runCommand(normalized);
        setState((prev) => ({ ...prev, input: "" }));
      }, typing.duration);

      typingTimersRef.current = [...typing.timers, finalTimer];
    },
    [cancelTyping, focusInput, resetTabState, runCommand],
  );

  const triggerSharedRunSequence = useCallback(() => {
    const commands = sharedCommandsRef.current;
    if (!commands || !commands.length) return false;

    sharedCommandsRef.current = null;
    const model = modelRef.current;
    if (model) {
      model.clear();
      setLinesFromModel();
    }

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("run");
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }

    cancelIntroTyping();
    setShowIntroInput(true);
    focusInput();

    const runSequence = async () => {
      suppressHistoryRef.current = true;
      for (const cmd of commands) {
        executeCommand(cmd);
        const delay = Math.min(4200, Math.max(900, 500 + cmd.length * 40));
        await new Promise((resolve) => {
          window.setTimeout(resolve, delay);
        });
      }
      suppressHistoryRef.current = false;
    };

    void runSequence();
    return true;
  }, [
    cancelIntroTyping,
    executeCommand,
    focusInput,
    setLinesFromModel,
    setShowIntroInput,
  ]);

  const handleGlobalPointerDown = useCallback(
    (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target && (target.closest?.(".t-output") || target.closest?.("a")))
        return;
      requestAnimationFrame(() => focusInput());
    },
    [focusInput],
  );

  const handleGlobalKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const input = inputRef.current;
        const active = document.activeElement as HTMLElement | null;

        const isEditable =
          active &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);

        if (input && active !== input && !isEditable) {
          focusInput();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
        event.preventDefault();
        modelRef.current.clear();
        setLinesFromModel([""]);
        focusInput();
      }
    },
    [focusInput, setLinesFromModel],
  );

  const canNavigateHistory = useCallback(() => {
    const raw = state.input || "";
    if (!raw.trim()) return true;
    return inputFromHistory.current;
  }, [state.input]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const { input, tabPrefix, tabMatches, tabIndex, tabVisible } = state;
      const hasSuggestionsOpen = tabVisible && tabMatches.length > 0;

      if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        cancelTyping();
        resetTabState();
        inputFromHistory.current = false;

        const model = modelRef.current;
        if (model) {
          const interrupted =
            input.trim().length > 0 ? `${model.prompt} ${input}^C` : "^C";
          model.pushLine(interrupted);
          setLinesFromModel();
        }

        setState((prev) => ({ ...prev, input: "" }));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        resetTabState({ revertPreview: false });
        void runCommand(input);
        inputFromHistory.current = false;
        setState((prev) => ({ ...prev, input: "" }));
        return;
      }

      if (event.key === "Escape") {
        if (tabVisible) {
          event.preventDefault();
          const fallback = state.tabPrefix || input;
          resetTabState();
          setState((prev) => ({ ...prev, input: fallback }));
          return;
        }

        if (
          previewBaseRef.current ||
          previewColorBaseRef.current ||
          themePreviewingRef.current
        ) {
          event.preventDefault();
          void fontControllerRef.current?.resetPreview?.();
          previewBaseRef.current = null;
          void colorControllerRef.current?.resetPreview?.();
          previewColorBaseRef.current = null;
          if (themePreviewingRef.current) {
            themePreviewingRef.current = false;
          }
          return;
        }
      }

      const metaOrCtrl = event.ctrlKey || event.metaKey;
      if (metaOrCtrl && !event.altKey) {
        const inputEl = inputRef.current;
        if (inputEl) {
          if (event.key.toLowerCase() === "a") {
            event.preventDefault();
            inputEl.setSelectionRange(0, 0);
            return;
          }
          if (event.key.toLowerCase() === "e") {
            event.preventDefault();
            const length = inputEl.value.length;
            inputEl.setSelectionRange(length, length);
            return;
          }
        }
      }

      if (event.key === "ArrowUp") {
        if (hasSuggestionsOpen) {
          event.preventDefault();
          setState((prev) => {
            const matches = prev.tabMatches;
            if (!matches.length) return prev;
            const nextIndex =
              (prev.tabIndex - 1 + matches.length) % matches.length;
            const nextInput = matches[nextIndex];
            previewFontFromInput(nextInput);
            previewColorFromInput(nextInput);
            previewThemeFromInput(nextInput);
            return {
              ...prev,
              tabIndex: nextIndex,
              input: nextInput,
              tabVisible: true,
            };
          });
          return;
        }
        if (!canNavigateHistory()) return;
        event.preventDefault();
        resetTabState();
        inputFromHistory.current = true;
        const previous = modelRef.current.prevHistory();
        setState((prev) => ({ ...prev, input: previous }));
        return;
      }

      if (event.key === "ArrowDown") {
        if (hasSuggestionsOpen) {
          event.preventDefault();
          setState((prev) => {
            const matches = prev.tabMatches;
            if (!matches.length) return prev;
            const nextIndex = (prev.tabIndex + 1) % matches.length;
            const nextInput = matches[nextIndex];
            previewFontFromInput(nextInput);
            previewColorFromInput(nextInput);
            previewThemeFromInput(nextInput);
            return {
              ...prev,
              tabIndex: nextIndex,
              input: nextInput,
              tabVisible: true,
            };
          });
          return;
        }
        if (!canNavigateHistory()) return;
        event.preventDefault();
        resetTabState();
        inputFromHistory.current = true;
        const next = modelRef.current.nextHistory();
        setState((prev) => ({ ...prev, input: next }));
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        if (!tabPrefix) {
          const suggestionResult = buildSuggestions(input);
          if (!suggestionResult.matches.length) return;

          if (suggestionResult.matches.length === 1) {
            const [only] = suggestionResult.matches;
            const nextInput = only.endsWith(" ") ? only : `${only} `;
            setState((prev) => ({
              ...prev,
              input: nextInput,
              tabVisible: false,
            }));
            previewFontFromInput(only.trim());
            previewColorFromInput(only.trim());
            previewThemeFromInput(only.trim());
            return;
          }

          setState((prev) => ({
            ...prev,
            tabPrefix: suggestionResult.prefix || input.trim(),
            tabMatches: suggestionResult.matches,
            tabIndex: 0,
            tabVisible: true,
            input: suggestionResult.matches[0],
          }));
          previewFontFromInput(suggestionResult.matches[0]);
          previewColorFromInput(suggestionResult.matches[0]);
          previewThemeFromInput(suggestionResult.matches[0]);
          return;
        }

        if (tabMatches.length) {
          const next = (tabIndex + 1) % tabMatches.length;
          setState((prev) => ({
            ...prev,
            tabIndex: next,
            input: tabMatches[next],
            tabVisible: true,
          }));
          previewFontFromInput(tabMatches[next]);
          previewColorFromInput(tabMatches[next]);
          previewThemeFromInput(tabMatches[next]);
        }
        return;
      }

      if (tabPrefix) {
        resetTabState();
      }
    },
    [
      canNavigateHistory,
      cancelTyping,
      resetTabState,
      buildSuggestions,
      runCommand,
      setLinesFromModel,
      state,
      previewFontFromInput,
      previewColorFromInput,
      previewThemeFromInput,
    ],
  );

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      inputFromHistory.current = false;
      const value = event.target.value;
      const match = value.trim().match(/^(\d+)!$/);
      if (match) {
        const index = Number(match[1]) - 1;
        const history = modelRef.current.getHistory();
        const recalled = history[index];
        if (recalled) {
          inputFromHistory.current = true;
          setState((prev) => ({ ...prev, input: recalled }));
          return;
        }
      }
      setState((prev) => {
        if (!prev.tabPrefix) return { ...prev, input: value };

        const result = buildSuggestions(value);
        const nextMatches = result.matches;

        if (!nextMatches.length) {
          return {
            ...prev,
            input: value,
            tabMatches: [],
            tabVisible: false,
            tabPrefix: "",
            tabIndex: 0,
          };
        }

        const currentIdx = prev.tabIndex % nextMatches.length;
        return {
          ...prev,
          input: value,
          tabMatches: nextMatches,
          tabPrefix: result.prefix,
          tabIndex: Math.max(0, currentIdx),
          tabVisible: true,
        };
      });
      previewThemeFromInput(value);
      previewColorFromInput(value);
      previewFontFromInput(value);
    },
    [
      buildSuggestions,
      previewThemeFromInput,
      previewColorFromInput,
      previewFontFromInput,
    ],
  );

  useEffect(() => {
    const isCoarse = detectCoarsePointer();
    coarsePointerRef.current = isCoarse;
    if (isCoarse) {
      // Avoid triggering the software keyboard on touch devices until the user explicitly taps.
      setAllowProgrammaticFocus(false);
    }
  }, [detectCoarsePointer]);

  useEffect(() => {
    autoGrow();
  }, [autoGrow, state.input]);

  useEffect(() => {
    //TODO selectively scroll down.
    // scrollToBottom();
  }, [scrollToBottom, state.lines]);

  useEffect(() => {
    const model = modelRef.current;
    const registry = registryRef.current;

    if (!hasInitializedRef.current) {
      const appearanceController = initialPropsRef.current.appearanceController
        ? {
            color: initialPropsRef.current.appearanceController?.color,
            font: initialPropsRef.current.appearanceController?.font,
          }
        : undefined;

      registerDefaultCommands({
        registry,
        props: initialPropsRef.current,
        model,
        setLinesFromModel,
        appearanceController,
      });

      const sharedStarted = triggerSharedRunSequence();
      if (!sharedStarted && !model.lines.length) {
        startIntroSequence();
      }

      hasInitializedRef.current = true;
    }

    requestAnimationFrame(() => {
      setState((prev) => ({ ...prev, ready: true }));
    });

    void (async () => {
      const history = await loadHistory();
      if (history.length) {
        model.setHistory(history);
      }
    })();

    focusInput();
    document.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("pointerdown", handleGlobalPointerDown, true);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener(
        "pointerdown",
        handleGlobalPointerDown,
        true,
      );
      cancelTyping();
      cancelIntroTyping();
      model.clear();
      setLinesFromModel();
      hasInitializedRef.current = false;
    };
  }, [
    cancelIntroTyping,
    cancelTyping,
    focusInput,
    handleGlobalKeyDown,
    handleGlobalPointerDown,
    setLinesFromModel,
    startIntroSequence,
    triggerSharedRunSequence,
  ]);

  return {
    ready: state.ready,
    lines: state.lines,
    input: state.input,
    prompt: modelRef.current.prompt,
    inputRef,
    scrollRef,
    handleKeyDown,
    onInputChange,
    focusInput,
    executeCommand,
    introStartLineRange,
    introStartVisible,
    showIntroInput,
    tabMatches: state.tabMatches,
    tabIndex: state.tabIndex,
    tabVisible: state.tabVisible,
  };
}
