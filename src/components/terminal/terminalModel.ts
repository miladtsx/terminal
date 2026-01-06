export class TerminalModel {
    prompt: string;
    lines: string[];
    history: string[];
    historyIndex: number;

    constructor({ prompt = ">" }: { prompt?: string } = {}) {
        this.prompt = prompt;
        this.lines = [];
        this.history = [];
        this.historyIndex = -1;
    }

    pushLine(text = "") {
        this.lines.push(String(text));
    }

    pushLines(lines: string[] = []) {
        lines.forEach((line) => this.pushLine(line));
    }

    echoCommand(cmd: string) {
        this.pushLine(`${this.prompt} ${cmd}`);
    }

    clear() {
        this.lines = [];
    }

    remember(cmd: string) {
        const trimmed = (cmd || "").trim();
        if (!trimmed) return;
        const last = this.history[this.history.length - 1];
        if (last !== trimmed) this.history.push(trimmed);
        this.historyIndex = -1;
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
}
