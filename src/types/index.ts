import type { KeyboardEvent as ReactKeyboardEvent, ChangeEvent } from "react";
import { CommandRegistry } from "@components/terminal/commandRegistry";
import { TerminalModel } from "@components/terminal/terminalModel";
import type { TerminalFontController, TerminalFontOption } from "@utils";
import type { TerminalColorController, TerminalColorOption } from "@utils";

export interface CommandButton {
  command: string;
  label?: string;
}

export interface TerminalProps {
  prompt?: string;
  suggestedCommands?: CommandButton[];
  contact?: ContactInfo;
  sampleWorks?: SampleWork[];
  aboutLines?: string[];
  onBookCall?: () => void;
  appearanceController?: AppearanceController;
}

export type AppearanceController = {
  font?: TerminalFontController;
  color?: TerminalColorController;
};

export type TerminalState = {
  ready: boolean;
  input: string;
  tabPrefix: string;
  tabMatches: string[];
  tabIndex: number;
  tabVisible: boolean;
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
  tabMatches: string[];
  tabIndex: number;
  tabVisible: boolean;
};

export type Period = "morning" | "afternoon" | "evening" | "night";

export type CommandSegment = {
  type: "command";
  label: string;
  command: string;
  ariaLabel?: string;
};

export type CopySegment = {
  type: "copy";
  value: string;
  label?: string;
  ariaLabel?: string;
};

export type LinkSegment = {
  type: "link";
  href: string;
  label: string;
  ariaLabel?: string;
  newTab?: boolean;
};

export type TextSegment = {
  type: "text";
  text: string;
};

export type FaqItem = { question: string; answer: string };

export type FaqSegment = {
  type: "faq";
  items: FaqItem[];
};

export type LogItem = {
  date: string;
  note: string;
  body?: string;
  slug?: string;
  kind?: "log" | "blog";
};

export type LogSegment = {
  type: "logs";
  items: LogItem[];
};

export type WorkSegment = {
  type: "work";
  items: SampleWork[];
};

export type AvatarSegment = {
  type: "avatar";
  image: string;
  lines: string[];
  label?: string;
  meta?: string;
};

export type MarkdownSegment = {
  type: "markdown";
  title?: string;
  markdown: string;
};

export type SearchHit = {
  id: string;
  source: "blog" | "log" | "resume" | "work";
  title: string;
  location: string;
  lineNumber: number;
  before: string[];
  line: string;
  after: string[];
  readCommand: string;
  downloadCommand?: string;
};

export type SearchHitsSegment = {
  type: "searchHits";
  query: string;
  hits: SearchHit[];
};

export type LineSegment =
  | TextSegment
  | CommandSegment
  | CopySegment
  | LinkSegment
  | FaqSegment
  | LogSegment
  | MarkdownSegment
  | WorkSegment
  | AvatarSegment
  | SearchHitsSegment;
export type TerminalLine = LineSegment[];
export type TerminalLineInput = string | TerminalLine;

export type ContactInfo = {
  email: string;
};

export type SampleWork = {
  intro: string;
  title: string;
  desc: string;
  tags?: string[];
  problem?: string;
  approach?: string;
  result?: string;
};

export type NotificationOverlayProps = {
  notification: OverlayNotification;
  onDismiss: () => void;
};

export type FileMeta = {
  name: string;
  path: string;
  size: number;
  sha256: string;
  text: boolean;
  mtime?: string;
};

export type TerminalLineProps = {
  line: TerminalLine;
  lineIndex: number;
  className?: string;
  executeCommand: (command: string) => void;
  isCommandLine?: boolean;
  isCollapsed?: boolean;
  prompt?: string;
  commandText?: string;
  onToggleCollapse?: () => void;
};

export type RegisterDefaultsArgs = {
  registry: CommandRegistry;
  props: TerminalProps;
  model: TerminalModel;
  setLinesFromModel: (extraLines?: TerminalLineInput[]) => void;
  appearanceController?: AppearanceController;
};

export type TerminalFontMeta = TerminalFontOption;
export type TerminalColorMeta = TerminalColorOption;

export type SubcommandSuggestContext = {
  prefix: string;
  parts: string[];
  raw: string;
  hasTrailingSpace: boolean;
  command: string;
};

export type CommandMeta = {
  desc?: string;
  subcommands?: string[];
  subcommandSuggestions?: (
    ctx: SubcommandSuggestContext,
  ) => string[] | undefined;
};

export type CommandHandlerContext = {
  args: string[];
  raw: string;
  model: TerminalModel;
  registry: CommandRegistry;
};

export type CommandOutput = TerminalLineInput | TerminalLineInput[] | void;
export type CommandHandler =
  | ((context: CommandHandlerContext) => CommandOutput)
  | ((context: CommandHandlerContext) => Promise<CommandOutput>);

export type CommandEntry = {
  handler: CommandHandler;
  meta: CommandMeta;
};

export type OverlayNotification = {
  id: number;
  title: string;
  description?: string;
  durationMs: number;
  progress: number;
};

export type NotificationPayload = {
  title: string;
  description?: string;
  durationMs?: number;
};

export type TelemetryLevel = "info" | "warn" | "error";

export type TelemetryError = {
  name?: string;
  message: string;
  stack?: string;
};

export type TelemetryEventPayload = {
  timestamp: string;
  action?: string;
  userInput?: string;
  message?: string;
  level: TelemetryLevel;
  error?: TelemetryError;
  context?: Record<string, unknown>;
  fingerprint?: string;
};

export type TelemetryInput =
  | string
  | Omit<TelemetryEventPayload, "timestamp" | "level"> & {
      level?: TelemetryLevel;
    };

export type OfflineStatus = {
  supported: boolean;
  online: boolean;
  cacheName?: string;
  entries?: string[];
  message?: string;
};
