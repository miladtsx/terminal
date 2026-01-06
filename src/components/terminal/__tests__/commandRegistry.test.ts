import { describe, expect, it } from "vitest";
import { CommandRegistry } from "../commandRegistry";

describe("CommandRegistry", () => {
    it("preserves registration order when listing", () => {
        const registry = new CommandRegistry();
        registry.register("alpha", () => "a");
        registry.register("beta", () => "b");
        const listed = registry.list().map((cmd) => cmd.name);
        expect(listed).toEqual(["alpha", "beta"]);
    });

    it("suggests commands case-insensitively", () => {
        const registry = new CommandRegistry();
        registry.register("Deploy", () => "d");
        registry.register("debug", () => "d2");
        expect(registry.suggest("de")).toEqual(["Deploy", "debug"]);
        expect(registry.suggest("DE")).toEqual(["Deploy", "debug"]);
    });
});
