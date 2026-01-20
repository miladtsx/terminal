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

    it("suggests subcommands for the matching command", () => {
        const registry = new CommandRegistry();
        registry.register("offline", () => "o", {
            subcommands: ["status", "refresh", "disable"],
        });

        expect(registry.suggestSubcommands("offline", "r")).toEqual(["refresh"]);
        expect(registry.suggestSubcommands("offline", "")).toEqual([
            "status",
            "refresh",
            "disable",
        ]);
    });

    it("matches command names case-insensitively when finding subcommands", () => {
        const registry = new CommandRegistry();
        registry.register("History", () => "h", { subcommands: ["-c"] });

        expect(registry.get("history")).toBeDefined();
        expect(registry.suggestSubcommands("history", "-")).toEqual(["-c"]);
    });
});
