import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { CommandRegistry } from "@components/terminal/commandRegistry";
import { registerDefaultCommands } from "@components/terminal/defaultCommands";
import { TerminalModel } from "@components/terminal/terminalModel";
import type { TerminalProps } from "@components/terminal/types";
import { ControllerReturn, TerminalState } from "../types";

const DEFAULT_SUGGESTED = ["help", "work", "resume", "contact"];

export function useTerminalController(props: TerminalProps): ControllerReturn {
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

  const setLinesFromModel = useCallback((extraLines: string[] = []) => {
    const model = modelRef.current;
    if (!model) return;
    if (extraLines.length) {
      model.pushLines(extraLines);
    }
    setState((prev) => ({ ...prev, lines: [...model.lines] }));
  }, []);

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
        const lines = Array.isArray(out) ? out : out ? [String(out)] : [];
        setLinesFromModel(lines.concat(lines.length ? [""] : []));
      } catch (error) {
        setLinesFromModel([
          `error: ${(error as Error)?.message || "command failed"}`,
          "",
        ]);
      }
    },
    [setLinesFromModel]
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
        const suggested = (
          initialPropsRef.current.suggestedCommands || DEFAULT_SUGGESTED
        ).join(" · ");
        model.pushLines(["Welcome.", "", `Start here: ${suggested}`, ""]);
        setLinesFromModel();
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
      model.clear();
      setLinesFromModel();
      hasInitializedRef.current = false;
    };
  }, [
    focusInput,
    handleGlobalKeyDown,
    handleGlobalPointerDown,
    setLinesFromModel,
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
  };
}
