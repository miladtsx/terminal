import { describe, expect, it } from "vitest";
import { TerminalModel } from "../terminalModel";

describe("TerminalModel", () => {
    it("remembers unique commands and resets pointer", () => {
        const model = new TerminalModel({ prompt: "test>" });
        model.remember(" hi ");
        model.remember("hi");
        model.remember("bye");
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
});
