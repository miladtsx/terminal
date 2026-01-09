import { clearPersistedHistory } from "./historyStore";
import {
  CommandHandlerContext,
  TerminalLineInput,
  LineSegment,
  CommandSegment,
  CopySegment,
  TextSegment,
  FileMeta,
  RegisterDefaultsArgs,
} from "@types";
import {
  copyToClipboard,
  OfflineStatus,
  disableOffline,
  getOfflineStatus,
  refreshOfflineResources,
} from "@utils";
import { findFileByName, listFiles, listTextFiles } from "../../data/files";

export const DEFAULT_SUGGESTED_COMMANDS = ["help", "work", "resume", "contact"];

const createTextSegment = (text: string): TextSegment => ({
  type: "text",
  text,
});

const createCommandSegment = (command: string): CommandSegment => ({
  type: "command",
  label: `${command}`,
  command,
});

const createCopySegment = (value: string, label?: string): CopySegment => ({
  type: "copy",
  value,
  label,
});

const buildCommandButtonLine = (commands: string[]): LineSegment[] => {
  const segments: LineSegment[] = [createTextSegment("  ")];
  commands.forEach((command, index) => {
    if (index) {
      segments.push(createTextSegment(" · "));
    }
    segments.push(createCommandSegment(command));
  });
  return segments;
};

const buildContactRow = (label: string, value: string): LineSegment[] => [
  createTextSegment(`  ${label}`),
  createTextSegment("  "),
  createTextSegment(value),
  createTextSegment(" "),
  createCopySegment(value, label),
];

const HOME_DIR = ["home"];
const FILES_DIR = ["home", "files"];

function normalizePath(input: string, cwd: string[]): string[] | null {
  const raw = (input || "").trim();
  if (!raw) return [...cwd];
  const parts = raw.startsWith("/")
    ? raw.slice(1).split("/")
    : [...cwd, ...raw.split("/")];

  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.length ? out : [...HOME_DIR];
}

function isDir(parts: string[], target: string[]): boolean {
  return (
    parts.length === target.length && parts.every((p, i) => p === target[i])
  );
}

function resolveFileFromPath(
  token: string,
  cwd: string[],
  resolver: (name: string) => FileMeta | undefined
): FileMeta | undefined {
  const parts = normalizePath(token, cwd);
  if (!parts) return undefined;

  // only allow files under home/files
  if (parts.length < 2) return undefined;
  const filename = parts[parts.length - 1];
  const dir = parts.slice(0, -1);
  if (!isDir(dir, FILES_DIR)) return undefined;
  return resolver(filename);
}

export function formatCommandToButton(
  prefixPrompt: string,
  commands: string[]
) {
  return (): TerminalLineInput[] => {
    const list = commands;
    if (!list.length) return [];

    return [prefixPrompt, buildCommandButtonLine(list), ""];
  };
}

const FILE_ALIASES: Record<string, string> = {
  resume: "resume_tsx.pdf",
  cv: "resume_tsx.pdf",
  llm: "llm_tsx.txt",
};

const textCache = new Map<string, string>();

export const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

async function getTextForFile(meta: FileMeta): Promise<string> {
  const cached = textCache.get(meta.path);
  if (cached !== undefined) return cached;
  const resp = await fetch(meta.path);
  if (!resp.ok) throw new Error(`fetch failed (${resp.status})`);
  const text = await resp.text();
  textCache.set(meta.path, text);
  return text;
}

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

function formatFileRow(file: FileMeta) {
  const displayPath = file.path.startsWith("/") ? file.path : `/${file.path}`;
  return `  ${file.name.padEnd(18)} ${formatBytes(file.size).padStart(
    8
  )}  ${displayPath}`;
}

function resolveFile(token: string): FileMeta | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  const aliasTarget = FILE_ALIASES[normalized];
  if (aliasTarget) return findFileByName(aliasTarget);
  return findFileByName(token);
}

function buildManPage(entries: Record<string, string[]>): string[] {
  return Object.entries(entries).flatMap(([cmd, lines]) => [
    `${cmd}:`,
    ...lines.map((line) => `  ${line}`),
    "",
  ]);
}

export function registerDefaultCommands({
  registry,
  props,
  model,
  setLinesFromModel,
}: RegisterDefaultsArgs) {
  const contact = props.contact || {
    email: "miladtsx+terminal@gmail.com",
    github: "https://github.com/miladtsx",
  };

  const caseStudies = props.caseStudies || [
    {
      title: "System Hardening",
      desc: "Reduced incidents, improved deploy safety.",
    },
    {
      title: "Payments/Entitlements",
      desc: "Built reliable gating + subscription rails.",
    },
    { title: "Automation", desc: "Agentic workflows, less ops toil." },
  ];

  const contactEntries = [
    { label: "email", value: contact.email },
    { label: "github", value: contact.github },
  ];

  const formatSuggestedLines = formatCommandToButton(
    "Suggested commands:",
    props.suggestedCommands ?? DEFAULT_SUGGESTED_COMMANDS
  );

  const historyHandler = async ({ args, model }: CommandHandlerContext) => {
    const flag = (args[0] || "").toLowerCase();

    if (flag && flag !== "-c") {
      return ["usage: history [-c]"];
    }

    if (flag === "-c") {
      model.clearHistory();
      await clearPersistedHistory();
      return ["history cleared"];
    }

    const history = model.getHistory();
    if (!history.length) return ["history: (empty)"];

    const width = (history.length + "").length;
    return history.map(
      (item, index) => `${(index + 1).toString().padStart(width, " ")}  ${item}`
    );
  };

  const helpHandler = ({
    registry: registryContext,
  }: CommandHandlerContext) => {
    const rows = registryContext.list().map((command) => {
      const right = command.desc ? ` — ${command.desc}` : "";
      return `  ${command.name}${right}`;
    });

    return [
      ...formatSuggestedLines(),
      "commands:",
      ...rows,
      "",
      "tips:",
      "  ↑/↓ history",
      "  n! recalls history entry n (type Enter to run)",
      "  Tab autocomplete",
    ];
  };

  const formatOfflineLines = (status: OfflineStatus, action: string) => {
    const lines: string[] = [];

    if (!status.supported) {
      lines.push("offline unavailable: service workers not supported");
      return lines;
    }

    lines.push(`offline ${action}: ${status.cacheName || "pending"}`);
    lines.push(`network: ${status.online ? "online" : "offline"}`);

    if (status.message) {
      lines.push(status.message);
    }

    if (status.entries && status.entries.length) {
      lines.push("cached:");
      status.entries.forEach((entry) => lines.push(`  ${entry}`));
    } else {
      lines.push("cached: none yet");
    }

    return lines;
  };

  const files = listFiles();

  const whoamiHandler = () => [
    "Profile:",
    "  Name: TSX",
    "  Role: Technical Founder/Software Engineer",
    "  Focus: Idea to Product, Automation, Security",
    "  Availability: Open to interesting ideas, and consulting",
    "  Links:",
    ...contactEntries.map((entry) => `    ${entry.label}: ${entry.value}`),
  ];

  registry
    .register("help", helpHandler, { desc: "show commands" })
    .register("?", helpHandler, { desc: "show commands (alias)" })
    .register(
      "about",
      () =>
        props.aboutLines || [
          "It started as my personal website, but ended up being this!",
        ],
      { desc: "short bio" }
    )
    .register(
      "contact",
      () => [
        "contact:",
        ...contactEntries.map((entry) =>
          buildContactRow(entry.label, entry.value)
        ),
        "",
      ],
      { desc: "how to reach me" }
    )
    .register(
      "work",
      () => {
        const lines = ["Previous works:"];
        caseStudies.forEach((item, index) => {
          lines.push(`  ${index + 1}. ${item.title}`);
          lines.push(`     ${item.desc}`);
        });
        lines.push(
          "",
          "hint: open links from your main site if you want richer content."
        );
        return lines;
      },
      { desc: "selected projects" }
    )
    .register("pwd", ({ model }) => [model.getCwd()], {
      desc: "print working directory",
    })
    .register(
      "cd",
      ({ args, model }) => {
        const next = normalizePath(args[0] || "", model.getCwdParts());
        if (!next) return ["usage: cd <directory>"];

        if (isDir(next, HOME_DIR) || isDir(next, FILES_DIR)) {
          model.setCwd(next);
          return [`${model.getCwd()}`];
        }

        return [`cd: no such file or directory: ${args[0] || ""}`];
      },
      { desc: "change directory (home, home/files)" }
    )
    .register(
      "ls",
      ({ model }) => {
        const cwd = model.getCwdParts();
        const atHome = isDir(cwd, HOME_DIR);
        const atFiles = isDir(cwd, FILES_DIR);

        if (atHome || atFiles) {
          if (!files.length) return ["(no files in files/ yet)"];
          return ["files:", ...files.map((file) => formatFileRow(file))];
        }

        return ["ls: unsupported directory"];
      },
      { desc: "list downloadable files" }
    )
    .register(
      "cat",
      async ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile
          ) || resolveFile(args[0] || "");
        if (!target) return ["usage: cat <filename>", "try: ls"];
        if (!target.text) {
          return [`${target.name} is binary; try open or download instead.`];
        }
        try {
          const text = await getTextForFile(target);
          const lines = text.split(/\r?\n/);
          return [`--- ${target.name} ---`, ...lines];
        } catch (error) {
          return [
            `cat failed for ${target.name}: ${
              (error as Error)?.message || "fetch error"
            }`,
          ];
        }
      },
      { desc: "print a text file from /files" }
    )
    .register(
      "open",
      ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile
          ) || resolveFile(args[0] || "");
        if (!target) return ["usage: open <filename>", "try: ls"];
        window.open(target.path, "_blank", "noopener,noreferrer");
        return [`opening ${target.path} in a new tab...`];
      },
      { desc: "open file in browser tab" }
    )
    .register(
      "download",
      ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile
          ) || resolveFile(args[0] || "");
        if (!target) return ["usage: download <filename>", "try: ls"];
        const link = document.createElement("a");
        link.href = target.path;
        link.download = target.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return [`downloading ${target.name}...`];
      },
      { desc: "download file from /files" }
    )
    .register(
      "verify",
      async ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile
          ) || resolveFile(args[0] || "");
        if (!target) return ["usage: verify <filename>", "try: ls"];
        try {
          const resp = await fetch(target.path, { cache: "no-cache" });
          if (!resp.ok) throw new Error(`fetch failed (${resp.status})`);
          const buf = await resp.arrayBuffer();
          const actual = await computeSha256(buf);
          const match = actual === target.sha256;
          return [
            `verify ${target.name}`,
            `  path: ${target.path}`,
            `  size: ${formatBytes(target.size)}`,
            `  expected: ${target.sha256}`,
            `  actual:   ${actual}`,
            match ? "✓ hash match" : "✗ hash mismatch",
          ];
        } catch (error) {
          return [
            `verify failed for ${target.name}: ${
              (error as Error)?.message || "fetch error"
            }`,
          ];
        }
      },
      { desc: "show SHA256 for a file" }
    )
    .register(
      "grep",
      async ({ args }) => {
        const term = args.join(" ").trim();
        if (!term) return ["usage: grep <term>"];
        const regex = new RegExp(
          term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        const matches: string[] = [];
        for (const file of listTextFiles()) {
          try {
            const text = await getTextForFile(file);
            const lines = text.split(/\r?\n/);
            lines.forEach((line, index) => {
              if (regex.test(line)) {
                matches.push(
                  `${file.name}:${(index + 1)
                    .toString()
                    .padStart(3, " ")}: ${line.trim()}`
                );
              }
            });
          } catch {
            // ignore single-file errors for grep
          }
        }

        caseStudies.forEach((study, index) => {
          const haystack = `${study.title} ${study.desc}`;
          if (regex.test(haystack)) {
            matches.push(`case[${index + 1}]: ${study.title} — ${study.desc}`);
          }
        });

        if (!matches.length) return [`no matches for "${term}"`];
        const truncated = matches.slice(0, 30);
        if (matches.length > truncated.length) {
          truncated.push(`... (${matches.length - truncated.length} more)`);
        }
        return truncated;
      },
      { desc: "search text files and case studies" }
    )
    .register(
      "copy",
      async ({ args }) => {
        const field = (args[0] || "").toLowerCase();
        const entry = contactEntries.find(
          (item) => item.label.toLowerCase() === field
        );
        if (!entry) return ["usage: copy email|github"];
        await copyToClipboard(entry.value);
        return [`copied ${entry.label} to clipboard`];
      },
      { desc: "copy contact info" }
    )
    .register("whoami", whoamiHandler, { desc: "show profile card" })
    .register("finger", whoamiHandler, {
      desc: "alias for whoami",
    })
    .register(
      "resume",
      () => {
        const target = findFileByName("resume_tsx.pdf");
        if (!target) return ["resume not found; try ls"];
        window.open(target.path, "_blank", "noopener,noreferrer");
        return [`opening ${target.name}...`];
      },
      { desc: "open resume.pdf in new tab" }
    )
    .register(
      "man",
      ({ args }) => {
        const topic = (args[0] || "").toLowerCase();
        const pages: Record<string, string[]> = {
          pwd: ["print current directory (virtual)"],
          ls: ["list files from /files", "ls"],
          cat: ["cat <file> — print text files only"],
          grep: ["grep <term> — search case studies + text files"],
          open: ["open <file> — open in new tab"],
          download: ["download <file> — trigger browser download"],
          verify: [
            "verify <file> — compute SHA256 locally, compare to manifest",
          ],
          copy: ["copy email|github|x — copy to clipboard"],
          whoami: ["compact profile card; alias: finger"],
          resume: ["open resume PDF"],
          history: [
            "history — list commands",
            "history -c — clear history",
            "n! — load nth history entry into input (press Enter to execute)",
          ],
          offline: ["offline status|refresh|disable — manage SW cache"],
        };

        if (topic && pages[topic]) {
          return buildManPage({ [topic]: pages[topic] });
        }
        return [
          "man pages:",
          ...Object.keys(pages).map((name) => `  ${name}`),
          "",
          "usage: man <command>",
        ];
      },
      { desc: "man <command>" }
    )
    .register("history", historyHandler, {
      desc: "show or clear command history (history -c)",
    })
    .register(
      "clear",
      () => {
        model.clear();
        setLinesFromModel();
        return [];
      },
      { desc: "clear the screen" }
    )
    .register(
      "offline",
      async ({ args }) => {
        const subcommand = (args[0] || "status").toLowerCase();

        if (subcommand === "status") {
          const status = await getOfflineStatus();
          return formatOfflineLines(status, "status");
        }

        if (subcommand === "refresh") {
          const status = await refreshOfflineResources();
          return formatOfflineLines(status, "refresh");
        }

        if (subcommand === "disable") {
          const status = await disableOffline();
          return formatOfflineLines(status, "disable");
        }

        return ["usage: offline status|refresh|disable"];
      },
      {
        desc: "offline status | refresh cache | disable (clear sw/cache/IndexedDB)",
      }
    );
}
