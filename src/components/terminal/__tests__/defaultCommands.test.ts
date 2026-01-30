import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TerminalLine } from "@types";
import { CommandRegistry } from "../commandRegistry";
import { registerDefaultCommands } from "../defaultCommands";
import { TerminalModel } from "../terminalModel";
import { findFileByName } from "../../../data/files";

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
    expect(joined).toContain("Milad_TSX_Senior_Backend_Engineer_Resume.pdf");
  });

  it("verify reports hash match for empty file", async () => {
    const { registry, model } = buildRegistry();
    const verifyHandler = registry.get("verify")?.handler;
    expect(verifyHandler).toBeTruthy();

    // align manifest entry with mocked empty content so the hash matches
    const llm = findFileByName("llm_tsx.txt");
    if (llm) {
      llm.sha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      llm.size = 0;
    }

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
      args: ["Milad_TSX_Senior_Backend_Engineer_Resume.pdf"],
      raw: "verify Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
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
      args: ["Milad_TSX_Senior_Backend_Engineer_Resume.pdf"],
      raw: "cat Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
      model,
      registry,
    });
    const lines = Array.isArray(output) ? output : [output];
    expect(lines.join("\n")).toContain("binary");
  });

  it("lists blog posts and supports reading", async () => {
    const { registry, model } = buildRegistry();
    const blogHandler = registry.get("blog")?.handler;
    expect(blogHandler).toBeTruthy();

    const listOut = await blogHandler?.({
      args: ["list"],
      raw: "blog list",
      model,
      registry,
    });
    const listLines = Array.isArray(listOut) ? listOut : [listOut];
    expect(listLines.join("\n")).toContain("blog posts:");
    expect(listLines.join("\n")).toContain("solo-contractor");

    const readOut = await blogHandler?.({
      args: ["read", "solo-contractor"],
      raw: "blog read solo-contractor",
      model,
      registry,
    });
    const readLines = Array.isArray(readOut) ? readOut : [readOut];
    const markdownLine = readLines.find(
      (line): line is TerminalLine =>
        Array.isArray(line) && line.some((seg) => (seg as any).type === "markdown")
    );
    expect(markdownLine).toBeTruthy();
    expect(markdownLine?.[0]).toMatchObject({ markdown: expect.stringContaining("Why autonomy matters") });
  });

  it("searches blog posts and includes them in grep", async () => {
    const { registry, model } = buildRegistry();
    const blogHandler = registry.get("blog")?.handler;
    const grepHandler = registry.get("grep")?.handler;

    const searchOut = await blogHandler?.({
      args: ["search", "kickoff"],
      raw: "blog search kickoff",
      model,
      registry,
    });
    const searchLines = Array.isArray(searchOut) ? searchOut : [searchOut];
    expect(searchLines.join("\n")).toContain("client-question");

    const grepOut = await grepHandler?.({
      args: ["kickoff"],
      raw: "grep kickoff",
      model,
      registry,
    });
    const grepLines = Array.isArray(grepOut) ? grepOut : [grepOut];
    expect(grepLines.join("\n")).toContain("blog/client-question");
  });

  it("lists and reads logs from markdown", async () => {
    const { registry, model } = buildRegistry();
    const logsHandler = registry.get("logs")?.handler;
    expect(logsHandler).toBeTruthy();

    const listOut = await logsHandler?.({
      args: ["list"],
      raw: "logs list",
      model,
      registry,
    });
    const listLines = Array.isArray(listOut) ? listOut : [listOut];
    expect(JSON.stringify(listLines)).toContain("Shipped blog commands");

    const readOut = await logsHandler?.({
      args: ["read", "2025-01-21-tab"],
      raw: "logs read 2025-01-21-tab",
      model,
      registry,
    });
    const readLines = Array.isArray(readOut) ? readOut : [readOut];
    const logLine = readLines.find(
      (line): line is TerminalLine =>
        Array.isArray(line) && line.some((seg) => (seg as any).type === "logs")
    );
    expect(logLine).toBeTruthy();
    const logSeg = logLine?.find((seg) => (seg as any).type === "logs") as any;
    expect(logSeg.items[0].body).toContain("Tab now suggests");
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
