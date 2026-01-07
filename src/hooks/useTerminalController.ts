import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  CommandRegistry,
  CommandOutput,
} from "@components/terminal/commandRegistry";
import {
  registerDefaultCommands,
  DEFAULT_SUGGESTED_COMMANDS,
  formatCommandToButton,
} from "@components/terminal/defaultCommands";
import { TerminalModel } from "@components/terminal/terminalModel";
import type {
  TerminalProps,
  TerminalLineInput,
} from "@components/terminal/types";
import { ControllerReturn, TerminalState } from "../types";
import { createTypeSfx, getGreeting, humanDelay } from "../utils";

export function useTerminalController(props: TerminalProps): ControllerReturn {
  const typeSfxRef = useRef<ReturnType<typeof createTypeSfx> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef(new TerminalModel({ prompt: props.prompt || ">" }));
  const registryRef = useRef(new CommandRegistry());
  const inputFromHistory = useRef(false);
  const initialPropsRef = useRef(props);
  const hasInitializedRef = useRef(false);

  const [state, setState] = useState<TerminalState>({
    ready: false,
    input: "",
    tabPrefix: "",
    tabMatches: [],
    tabIndex: 0,
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
    []
  );

  const normalizeCommandOutput = useCallback(
    (value: CommandOutput): TerminalLineInput[] => {
      if (!value) return [];
      return Array.isArray(value) ? value : [value];
    },
    []
  );

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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

  const resetTabState = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tabPrefix: "",
      tabMatches: [],
      tabIndex: 0,
    }));
  }, []);

  const typingTimersRef = useRef<number[]>([]);
  const introTimersRef = useRef<number[]>([]);
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
    setIntroStartLineRange(null);
    setIntroStartVisible(false);
    setShowIntroInput(true);
  }, []);

  const startIntroSequence = useCallback(() => {
    const model = modelRef.current;
    if (!model) return;

    const greeting = getGreeting();
    const typingDuration = 1000;
    const perChar = typingDuration / Math.max(greeting.length, 1);

    model.pushLine("");
    setLinesFromModel();

    const timers: number[] = [];

    for (let i = 0; i < greeting.length; i++) {
      const timer = window.setTimeout(() => {
        model.setLine(0, greeting.slice(0, i + 1));
        setLinesFromModel();
      }, Math.round(perChar * (i + 1)));
      timers.push(timer);
    }

    const suggested =
      initialPropsRef.current.suggestedCommands || DEFAULT_SUGGESTED_COMMANDS;
    setShowIntroInput(false);

    const typeIntroStartLines = (extraTimers: number[]) => {
      const startLines = formatCommandToButton("Start here:", suggested)();

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
            return "";
          })
          .join("");
      };

      const lineTexts = startLines.map(flattenLine);
      const blankIndex = model.lines.length;
      model.pushLine("");
      lineTexts.forEach(() => model.pushLine(""));
      setLinesFromModel();

      const firstLineIndex = blankIndex + 1;
      let offset = 120;
      lineTexts.forEach((lineText, lineIndex) => {
        for (let i = 0; i < lineText.length; i++) {
          const ch = lineText[i];
          const prev = lineText.slice(0, i);
          offset += humanDelay(prev, ch) * 0.1;
          const timer = window.setTimeout(() => {
            model.setLine(firstLineIndex + lineIndex, lineText.slice(0, i + 1));
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
        setIntroStartVisible(false);
        requestAnimationFrame(() => {
          setIntroStartVisible(true);
          setShowIntroInput(true);
          focusInput();
        });
      }, offset);

      extraTimers.push(finalizeTimer);
    };

    const startBlockTimer = window.setTimeout(() => {
      typeIntroStartLines(timers);
    }, typingDuration);

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
    (raw: string) => {
      const cmd = (raw || "").trim();
      if (!cmd) return;

      const model = modelRef.current;
      const registry = registryRef.current;
      if (!model || !registry) return;

      model.remember(cmd);
      model.echoCommand(cmd);

      const [name, ...args] = cmd.split(/\s+/);
      const entry = registry.get(name);

      if (!entry) {
        setLinesFromModel([`unknown command: ${name}`, `try: help`, ""]);
        return;
      }

      try {
        const out = entry.handler({ args, raw: cmd, model, registry });
        const lines = normalizeCommandOutput(out);
        setLinesFromModel(lines.concat(lines.length ? [""] : []));
      } catch (error) {
        setLinesFromModel([
          `error: ${(error as Error)?.message || "command failed"}`,
          "",
        ]);
      }
    },
    [setLinesFromModel, normalizeCommandOutput]
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

      const timers: number[] = [];
      const { tick } = getTypeSfx();

      let t = 0;

      for (let i = 0; i < normalized.length; i++) {
        const ch = normalized[i];
        const prev = normalized.slice(0, i);
        t += humanDelay(prev, ch);

        const timer = window.setTimeout(() => {
          setState((prev) => ({
            ...prev,
            input: normalized.slice(0, i + 1),
          }));
          if (ch !== " ") tick();
        }, t);
        timers.push(timer);
      }

      const finalTimer = window.setTimeout(() => {
        runCommand(normalized);
        setState((prev) => ({ ...prev, input: "" }));
      }, t);

      timers.push(finalTimer);
      typingTimersRef.current = timers;
    },
    [cancelTyping, focusInput, resetTabState, runCommand]
  );

  const handleGlobalPointerDown = useCallback(
    (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target && (target.closest?.(".t-output") || target.closest?.("a")))
        return;
      requestAnimationFrame(() => focusInput());
    },
    [focusInput]
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
    [focusInput, setLinesFromModel]
  );

  const canNavigateHistory = useCallback(() => {
    const raw = state.input || "";
    if (!raw.trim()) return true;
    return inputFromHistory.current;
  }, [state.input]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      const { input, tabPrefix, tabMatches, tabIndex } = state;

      if (event.key === "Enter") {
        event.preventDefault();
        resetTabState();
        runCommand(input);
        inputFromHistory.current = false;
        setState((prev) => ({ ...prev, input: "" }));
        return;
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
        if (!canNavigateHistory()) return;
        event.preventDefault();
        resetTabState();
        inputFromHistory.current = true;
        const previous = modelRef.current.prevHistory();
        setState((prev) => ({ ...prev, input: previous }));
        return;
      }

      if (event.key === "ArrowDown") {
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
        const token = (input.trim().split(/\s+/)[0] || "").toLowerCase();
        if (!token) return;

        if (!tabPrefix) {
          const matches = registryRef.current.suggest(token);
          if (!matches.length) return;

          if (matches.length === 1) {
            setState((prev) => ({ ...prev, input: `${matches[0]} ` }));
            return;
          }

          modelRef.current.pushLine(matches.join("  "));
          setLinesFromModel([""]);
          setState((prev) => ({
            ...prev,
            tabPrefix: token,
            tabMatches: matches,
            tabIndex: 0,
            input: matches[0],
          }));
          return;
        }

        if (tabMatches.length) {
          const next = (tabIndex + 1) % tabMatches.length;
          setState((prev) => ({
            ...prev,
            tabIndex: next,
            input: tabMatches[next],
          }));
        }
        return;
      }

      if (tabPrefix) {
        resetTabState();
      }
    },
    [canNavigateHistory, resetTabState, runCommand, setLinesFromModel, state]
  );

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      inputFromHistory.current = false;
      const value = event.target.value;
      setState((prev) => ({ ...prev, input: value }));
    },
    []
  );

  useEffect(() => {
    autoGrow();
  }, [autoGrow, state.input]);

  useEffect(() => {
    scrollToBottom();
  }, [scrollToBottom, state.lines]);

  useEffect(() => {
    const model = modelRef.current;
    const registry = registryRef.current;

    if (!hasInitializedRef.current) {
      registerDefaultCommands({
        registry,
        props: initialPropsRef.current,
        model,
        setLinesFromModel,
      });

      if (!model.lines.length) {
        startIntroSequence();
      }

      hasInitializedRef.current = true;
    }

    requestAnimationFrame(() => {
      setState((prev) => ({ ...prev, ready: true }));
    });

    focusInput();
    document.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("pointerdown", handleGlobalPointerDown, true);

    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener(
        "pointerdown",
        handleGlobalPointerDown,
        true
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
  };
}
