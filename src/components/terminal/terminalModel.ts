import { TerminalLine, TerminalLineInput, TextSegment } from "@types";

export class TerminalModel {
  prompt: string;
  lines: TerminalLine[];
  history: string[];
  historyIndex: number;
  cwdParts: string[];

  constructor({ prompt = ">" }: { prompt?: string } = {}) {
    this.prompt = prompt;
    this.lines = [];
    this.history = [];
    this.historyIndex = -1;
    this.cwdParts = ["home"];
  }

  pushLine(line: TerminalLineInput = "") {
    this.lines.push(this.normalize(line));
  }

  pushLines(lines: TerminalLineInput[] = []) {
    lines.forEach((line) => this.pushLine(line));
  }

  echoCommand(cmd: string) {
    this.pushLine(`${this.prompt} ${cmd}`);
  }

  clear() {
    this.lines = [];
  }

  remember(cmd: string): boolean {
    const trimmed = (cmd || "").trim();
    if (!trimmed) return false;
    const last = this.history[this.history.length - 1];
    if (last !== trimmed) this.history.push(trimmed);
    this.historyIndex = -1;
    return last !== trimmed;
  }

  setHistory(history: string[]) {
    this.history = [...history];
    this.historyIndex = -1;
  }

  clearHistory() {
    this.setHistory([]);
  }

  getHistory(): string[] {
    return [...this.history];
  }

  prevHistory() {
    if (!this.history.length) return "";
    if (this.historyIndex === -1) this.historyIndex = this.history.length - 1;
    else this.historyIndex = Math.max(0, this.historyIndex - 1);
    return this.history[this.historyIndex] || "";
  }

  nextHistory() {
    if (!this.history.length) return "";
    if (this.historyIndex === -1) return "";
    this.historyIndex = Math.min(this.history.length, this.historyIndex + 1);
    if (this.historyIndex === this.history.length) {
      this.historyIndex = -1;
      return "";
    }
    return this.history[this.historyIndex] || "";
  }

  setLine(index: number, line: TerminalLineInput) {
    if (index < 0 || index >= this.lines.length) return;
    this.lines[index] = this.normalize(line);
  }

  getCwdParts(): string[] {
    return [...this.cwdParts];
  }

  setCwd(parts: string[]) {
    this.cwdParts = [...parts];
  }

  getCwd(): string {
    return this.cwdParts.join("/") + "/";
  }

  private normalize(line: TerminalLineInput): TerminalLine {
    if (typeof line === "string") {
      const text: TextSegment = { type: "text", text: line };
      return [text];
    }
    return line;
  }
}
