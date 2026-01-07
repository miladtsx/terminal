import type { KeyboardEvent as ReactKeyboardEvent, ChangeEvent } from "react";
import type { TerminalLine } from "@components/terminal/types";

export type TerminalState = {
  ready: boolean;
  input: string;
  tabPrefix: string;
  tabMatches: string[];
  tabIndex: number;
  lines: TerminalLine[];
};
export type ControllerReturn = {
  ready: boolean;
  lines: TerminalLine[];
  input: string;
  prompt: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  handleKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  focusInput: () => void;
  executeCommand: (cmd: any) => void;
  introStartLineRange: { start: number; count: number } | null;
  introStartVisible: boolean;
  showIntroInput: boolean;
};

export type Period = "morning" | "afternoon" | "evening" | "night";
