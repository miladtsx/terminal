import { describe, expect, it } from "vitest";
import { TerminalModel } from "../terminalModel";

describe("TerminalModel", () => {
    it("remembers unique commands and resets pointer", () => {
        const model = new TerminalModel({ prompt: "test>" });
        expect(model.remember(" hi ")).toBe(true);
        expect(model.remember("hi")).toBe(false);
        expect(model.remember("bye")).toBe(true);
        expect(model.history).toEqual(["hi", "bye"]);
        expect(model.historyIndex).toBe(-1);
    });

    it("navigates history forward and backward", () => {
        const model = new TerminalModel();
        model.remember("first");
        model.remember("second");
        expect(model.prevHistory()).toBe("second");
        expect(model.prevHistory()).toBe("first");
        expect(model.nextHistory()).toBe("second");
        expect(model.nextHistory()).toBe("");
    });

    it("tracks cwd with trailing slash", () => {
        const model = new TerminalModel();
        expect(model.getCwd()).toBe("home/");
        model.setCwd(["home", "files"]);
        expect(model.getCwd()).toBe("home/files/");
        expect(model.getCwdParts()).toEqual(["home", "files"]);
    });

    it("sets and clears history", () => {
        const model = new TerminalModel();
        model.setHistory(["one", "two"]);
        expect(model.getHistory()).toEqual(["one", "two"]);
        expect(model.historyIndex).toBe(-1);
        model.clearHistory();
        expect(model.getHistory()).toEqual([]);
    });
});
