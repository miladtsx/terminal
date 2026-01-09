import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandRegistry } from "../commandRegistry";
import { registerDefaultCommands } from "../defaultCommands";
import { TerminalModel } from "../terminalModel";

const noop = () => {};

function buildRegistry() {
  const registry = new CommandRegistry();
  const model = new TerminalModel({ prompt: ">" });
  registerDefaultCommands({
    registry,
    props: {},
    model,
    setLinesFromModel: noop,
  });
  return { registry, model };
}

describe("default commands", () => {
  beforeEach(() => {
    // Make sure fetch exists for command handlers.
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists files from the manifest via ls", async () => {
    const { registry, model } = buildRegistry();
    const lsHandler = registry.get("ls")?.handler;
    expect(lsHandler).toBeTruthy();
    const output = await lsHandler?.({ args: [], raw: "ls", model, registry });
    const lines = Array.isArray(output) ? output : [output];
    const joined = lines.join("\n");
    expect(joined).toContain("llm_tsx.txt");
    expect(joined).toContain("resume_tsx.pdf");
  });

  it("verify reports hash match for empty file", async () => {
    const { registry, model } = buildRegistry();
    const verifyHandler = registry.get("verify")?.handler;
    expect(verifyHandler).toBeTruthy();

    const fetchMock = vi.fn(async () => new Response(new Uint8Array([])));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const output = await verifyHandler?.({
      args: ["llm_tsx.txt"],
      raw: "verify llm_tsx.txt",
      model,
      registry,
    });
    const lines = Array.isArray(output) ? output : [output];
    expect(lines.join("\n")).toContain("hash match");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("verify reports mismatch when digest differs", async () => {
    const { registry, model } = buildRegistry();
    const verifyHandler = registry.get("verify")?.handler;

    const fetchMock = vi.fn(
      async () => new Response(new TextEncoder().encode("not-empty"))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const output = await verifyHandler?.({
      args: ["resume_tsx.pdf"],
      raw: "verify resume_tsx.pdf",
      model,
      registry,
    });
    const lines = Array.isArray(output) ? output : [output];
    expect(lines.join("\n")).toContain("hash mismatch");
  });

  it("cat declines to print binary files", async () => {
    const { registry, model } = buildRegistry();
    const catHandler = registry.get("cat")?.handler;
    const output = await catHandler?.({
      args: ["resume_tsx.pdf"],
      raw: "cat resume_tsx.pdf",
      model,
      registry,
    });
    const lines = Array.isArray(output) ? output : [output];
    expect(lines.join("\n")).toContain("binary");
  });

  it("prints and clears command history", async () => {
    const { registry, model } = buildRegistry();
    model.setHistory(["first", "second"]);
    const historyHandler = registry.get("history")?.handler;
    const listOutput = await historyHandler?.({
      args: [],
      raw: "history",
      model,
      registry,
    });
    const listLines = Array.isArray(listOutput) ? listOutput : [listOutput];
    expect(listLines.join("\n")).toContain("1  first");
    expect(listLines.join("\n")).toContain("2  second");

    const clearOutput = await historyHandler?.({
      args: ["-c"],
      raw: "history -c",
      model,
      registry,
    });
    const clearLines = Array.isArray(clearOutput) ? clearOutput : [clearOutput];
    expect(clearLines.join("\n")).toContain("cleared");
    expect(model.getHistory()).toEqual([]);
  });
});
