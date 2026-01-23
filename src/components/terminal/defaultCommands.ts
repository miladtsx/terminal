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
  OfflineStatus,
  TerminalFontMeta,
} from "@types";
import {
  copyToClipboard,
  disableOffline,
  getOfflineStatus,
  refreshOfflineResources,
} from "@utils";
import { findFileByName, listFiles, listTextFiles } from "../../data/files";
import { blogIndex } from "../../data/blogIndex";
import { logsIndex } from "../../data/logsIndex";

export const DEFAULT_SUGGESTED_COMMANDS = [
  "help",
  "work",
  "resume",
  "blog list",
  "logs list",
  "contact",
];

const createTextSegment = (text: string): TextSegment => ({
  type: "text",
  text,
});

const createCommandSegment = (
  command: string,
  label?: string,
  ariaLabel?: string
): CommandSegment => ({
  type: "command",
  label: label ?? `${command}`,
  command,
  ariaLabel,
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
  createTextSegment(`${label}`),
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

const FAQ_ITEMS = [
  {
    question: "What kinds of projects do you take on?",
    answer:
      "Fast-moving SaaS/platform work where a senior IC can own a vertical: ship features, fix reliability, improve delivery loops.",
  },
  {
    question: "How quickly can we start?",
    answer: "Usually within 1–2 weeks. Short kickoff, thin slice, then weekly checkpoints.",
  },
  {
    question: "Do you work async?",
    answer:
      "Yes. I bias to async docs/Looms with a standing sync as needed. Clear updates beat meetings.",
  },
  {
    question: "How do you mesh with our team?",
    answer:
      "I join your Slack/Teams, ship in your repos, and keep PRs small. If you lack process, I bring a light one.",
  },
];

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
  fontController,
}: RegisterDefaultsArgs) {
  const contact = props.contact || {
    email: "miladtsx+terminal@gmail.com",
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
    contact.email
      ? { label: "email", displayLabel: "✉", value: contact.email }
      : null,
  ].filter(Boolean) as { label: string; value: string; displayLabel?: string }[];

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

  const displayFontHandler = async ({ args }: CommandHandlerContext) => {
    const scope = (args[0] || "").toLowerCase();
    if (scope && scope !== "font") {
      return ["usage: display font [list|current|<id>]"];
    }

    if (!fontController) {
      return ["display font unavailable: font controller not initialized."];
    }

    const action = (args[1] || "list").toLowerCase();

    if (action === "list") return formatFontList();
    if (action === "current") {
      const current = fontController.getCurrentFont();
      return [
        "current font:",
        `  ${current.label} (${current.id})`,
        current.description ? `  ${current.description}` : "",
      ].filter(Boolean);
    }

    const targetId = action === "set" ? (args[2] || "") : action;
    if (!targetId) return ["usage: display font <id>", ...formatFontList()];

    const option = fontController
      .listFonts()
      .find((item) => item.id.toLowerCase() === targetId.toLowerCase());

    if (!option) return [`unknown font: ${targetId}`, "try: display font list"];

    try {
      await fontController.setFont(option.id);
      return [
        `font set to ${option.label}`,
        option.description ? option.description : "",
      ].filter(Boolean);
    } catch (error) {
      return [`failed to set font: ${(error as Error).message}`];
    }
  };

  const formatFontList = () => {
    if (!fontController) return ["display font is unavailable in this build."];

    const current = fontController.getCurrentFont();
    const items = fontController.listFonts();
    const longest = items.reduce(
      (len: number, item: TerminalFontMeta) => Math.max(len, item.id.length),
      0
    );

    const rows = items.map((font: TerminalFontMeta) => {
      const active = font.id === current.id ? " (current)" : "";
      const desc = font.description ? ` — ${font.description}` : "";
      return `  ${font.id.padEnd(longest)}  ${font.label}${active}${desc}`;
    });

    return [
      "fonts:",
      ...rows,
      "",
      "set: display font <id>",
      "show current: display font current",
    ];
  };

  const whoamiHandler = () => [
    "Profile:",
    "  Name: TSX",
    "  Role: Technical Founder/Software Engineer",
    "  Focus: Idea to Product, Automation, Security",
    "  Availability: Open to interesting ideas, and consulting",
    "  Links:",
    ...contactEntries.map(
      (entry) =>
        `    ${entry.displayLabel ?? entry.label}: ${entry.value}`
    ),
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
      "blog",
      ({ args }) => {
        const sub = (args[0] || "list").toLowerCase();

        const formatPostRow = (
          postSlug: string,
          title: string,
          date?: string,
          tags?: string[]
        ) => {
          const tagDisplay = tags?.length ? ` #${tags.join(",")}` : "";
          const datePart = date ? ` ${date}` : "";
          return `  ${postSlug.padEnd(18)}${datePart} — ${title}${tagDisplay}`;
        };

        if (sub === "list") {
          let tag: string | undefined;
          let searchTerm: string | undefined;

          for (let i = 1; i < args.length; i++) {
            const token = args[i];
            if (token === "--tag" && args[i + 1]) {
              tag = args[i + 1];
              i++;
              continue;
            }
            if ((token === "--search" || token === "--q") && args[i + 1]) {
              searchTerm = args[i + 1];
              i++;
              continue;
            }
          }

          let posts = blogIndex.filterByTag(tag);
          if (searchTerm) {
            const hits = blogIndex.search(searchTerm);
            const hitSlugs = new Set(hits.map((h) => h.slug));
            posts = posts.filter((p) => hitSlugs.has(p.slug));
          }

          if (!posts.length) {
            return [
              "blog list:",
              "  no posts found" + (tag ? ` for tag '${tag}'` : ""),
              "",
              "try: blog tags",
            ];
          }

          const lines = ["blog posts:"];
          posts.forEach((post) => {
            lines.push(formatPostRow(post.slug, post.title, post.date, post.tags));
          });
          return lines;
        }

        if (sub === "read") {
          const query = args.slice(1).join(" ").trim();
          if (!query) return ["usage: blog read <slug|title>"];

          const post = blogIndex.findBySlugOrTitle(query);
          if (!post) return [`blog not found: ${query}`];

          return [
            [
              {
                type: "logs",
                items: [
                  {
                    date: post.date || "",
                    note: post.title,
                    body: post.summary,
                    slug: post.slug,
                    kind: "blog",
                  },
                ],
              },
            ],
            "",
            [
              {
                type: "markdown",
                title: post.title,
                markdown: [post.summary, post.body].filter(Boolean).join("\n\n"),
              },
            ],
          ];
        }

        if (sub === "search") {
          const query = args.slice(1).join(" ").trim();
          if (!query) return ["usage: blog search <query>"];
          const hits = blogIndex.search(query);
          if (!hits.length) return [`no blog matches for "${query}"`];

          const lines = hits.map((hit) => {
            const summary = hit.summary ? ` — ${hit.summary}` : "";
            return `  ${hit.slug.padEnd(18)} (${hit.score}) ${hit.title}${summary}`;
          });
          return ["blog search results:", ...lines];
        }

        if (sub === "tags") {
          const tags = blogIndex.listTags();
          if (!tags.length) return ["no tags yet"];
          return [
            "tags:",
            ...tags.map((t) => `  ${t.tag.padEnd(10)} ${t.count}`),
          ];
        }

        if (sub.startsWith("--")) {
          const posts = blogIndex.filterByTag(args[1]);
          if (!posts.length)
            return ["usage: blog list [--tag <tag>] [--search <query>]"];
          return [
            "blog posts:",
            ...posts.map((post) =>
              formatPostRow(post.slug, post.title, post.date, post.tags)
            ),
          ];
        }

        return [
          "usage:",
          "  blog list [--tag t] [--search q]",
          "  blog read <slug|title>",
          "  blog search <query>",
          "  blog tags",
        ];
      },
      {
        desc: "blog list/read/search/tags",
        subcommands: ["list", "read", "search", "tags"],
        subcommandSuggestions: ({ prefix, parts, hasTrailingSpace }) => {
          const subToken = (parts[1] || "").toLowerCase();
          const wantsRead = subToken === "read" || prefix.toLowerCase() === "read";
          if (!wantsRead) return undefined;

          const titlePrefix =
            parts.length > 2
              ? parts.slice(2).join(" ")
              : hasTrailingSpace || prefix.toLowerCase() === "read"
              ? ""
              : prefix;

          const matches = blogIndex
            .getAll()
            .map((p) => p.title)
            .filter((title) =>
              title.toLowerCase().startsWith(titlePrefix.toLowerCase())
            );

          return matches.map((title) => `read ${title}`);
        },
      }
    )
    .register(
      "contact",
      () => {
        const lines: TerminalLineInput[] = [
          ...contactEntries.map((entry) =>
            buildContactRow(entry.displayLabel ?? entry.label, entry.value)
          ),
        ];

        lines.push("");

        lines.push([
          createTextSegment(" 📞 "),
          createCommandSegment("book", "Book a call", "Open booking calendar"),
        ]);

        lines.push("");
        return lines;
      },
      { desc: "how to reach me" }
    )
    .register(
      "book",
      () => {
        props.onBookCall?.();
        return [
          "Opening calendar embed…",
        ].filter(Boolean) as TerminalLineInput[];
      },
      { desc: "open booking calendar" }
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

        blogIndex.linesForSearch().forEach((entry) => {
          entry.lines.forEach((line, index) => {
            if (regex.test(line)) {
              matches.push(
                `blog/${entry.slug}:${(index + 1)
                  .toString()
                  .padStart(3, " ")}: ${line.trim()}`
              );
            }
          });
        });

        logsIndex.linesForSearch().forEach((entry) => {
          entry.lines.forEach((line, index) => {
            if (regex.test(line)) {
              matches.push(
                `log/${entry.slug}:${(index + 1)
                  .toString()
                  .padStart(3, " ")}: ${line.trim()}`
              );
            }
          });
        });

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
      { desc: "search text files, blog posts, logs, and case studies" }
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
    .register(
      "faq",
      () => {
        return [
          [
            {
              type: "faq",
              items: FAQ_ITEMS,
            },
          ],
        ];
      },
      { desc: "interactive FAQ" }
    )
    .register(
      "logs",
      ({ args }) => {
        const sub = (args[0] || "list").toLowerCase();

          if (sub === "list") {
          const entries = logsIndex.getAll();
          if (!entries.length) return ["no logs yet"];
          return [
            [
              {
                type: "logs",
                items: entries.map((entry) => ({
                  date: entry.date || "",
                  note: entry.title,
                  body: [entry.summary, entry.body].filter(Boolean).join("\n\n"),
                  slug: entry.slug,
                  kind: "log",
                })),
              },
            ],
          ];
        }

        if (sub === "read") {
          const query = args.slice(1).join(" ").trim();
          if (!query) return ["usage: logs read <slug|title>"];
          const entry = logsIndex.findBySlugOrTitle(query);
          if (!entry) return [`log not found: ${query}`];

          return [
            [
              {
                type: "logs",
                items: [
                  {
                    date: entry.date || "",
                    note: entry.title,
                    body: [entry.summary, entry.body].filter(Boolean).join("\n\n"),
                    slug: entry.slug,
                    kind: "log",
                  },
                ],
              },
            ],
            "",
            [
              {
                type: "markdown",
                title: entry.title,
                markdown: entry.body,
              },
            ],
          ];
        }

        if (sub === "search") {
          const query = args.slice(1).join(" ").trim();
          if (!query) return ["usage: logs search <query>"];
          const hits = logsIndex.search(query);
          if (!hits.length) return [`no log matches for \"${query}\"`];
          const lines = hits.map(
            (hit) =>
              `  ${hit.slug.padEnd(18)} (${hit.score}) ${hit.title}${
                hit.summary ? ` — ${hit.summary}` : ""
              }`
          );
          return ["logs search results:", ...lines];
        }

        return ["usage: logs list | logs read <slug|title> | logs search <query>"];
      },
      { desc: "work logs list/read/search", subcommands: ["list", "read", "search"] }
    )
    .register("whoami", whoamiHandler, { desc: "show profile card" })
    .register(
      "display",
      displayFontHandler,
      {
        desc: "display settings (font)",
        subcommands: ["font"],
        subcommandSuggestions: ({ parts, hasTrailingSpace }) => {
          const first = (parts[1] || "").toLowerCase();
          if (first && first !== "font") return [];

          if (!fontController) return [];
          const fonts = fontController.listFonts();
          const prefix = (parts[2] || "").toLowerCase();
          const matches = fonts
            .map((f: TerminalFontMeta) => f.id)
            .filter((id: string) => id.toLowerCase().startsWith(prefix));

          return matches.map((id) => `font ${id}`);
        },
      }
    )
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
          grep: ["grep <term> — search case studies + text files + blog/log posts"],
          open: ["open <file> — open in new tab"],
          download: ["download <file> — trigger browser download"],
          verify: [
            "verify <file> — compute SHA256 locally, compare to manifest",
          ],
          copy: ["copy email — copy to clipboard"],
          whoami: ["compact profile card; alias: finger"],
          resume: ["open resume PDF"],
          blog: [
            "blog list [--tag t] [--search q] — list posts",
            "blog read <slug|title> — open a post",
            "blog search <query> — ranked search",
            "blog tags — show tag counts",
          ],
          logs: [
            "logs list — list log entries",
            "logs read <slug|title> — read a log entry",
            "logs search <query> — keyword search",
          ],
          faq: ["faq — interactive Q&A accordion (click to expand)"],
          history: [
            "history — list commands",
            "history -c — clear history",
            "n! — load nth history entry into input (press Enter to execute)",
          ],
          offline: ["offline status|refresh|disable — manage SW cache"],
          display: [
            "display font list — show available fonts",
            "display font current — show active font",
            "display font <id> — switch terminal font",
          ],
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
      subcommands: ["-c"],
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
        subcommands: ["status", "refresh", "disable"],
      }
    );
}
