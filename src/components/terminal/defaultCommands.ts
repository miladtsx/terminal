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
  TerminalColorMeta,
  CommandButton,
  SearchHit,
  SampleWork,
} from "@types";
import {
  buildAvatarSegment,
  copyToClipboard,
  disableOffline,
  getOfflineStatus,
  refreshOfflineResources,
  findTheme,
  listThemes,
  matchTheme,
} from "@utils";
import { openChat } from "@stores/chatStore";
import { findFileByName, listFiles, listTextFiles } from "../../data/files";
import { blogIndex } from "../../data/blogIndex";
import { logsIndex } from "../../data/logsIndex";
import packageJson from "../../../package.json";
import {
  runSearch,
  setSearchWorkItems,
  makeWorkSlug,
  sanitizeSearchQuery,
} from "@data/searchIndex";
import { searchStore } from "@stores/searchStore";

export const DEFAULT_SUGGESTED_COMMANDS: CommandButton[] = [
  { command: "contact", label: "Contact", variant: "primary" },
  { command: "download resume", label: "Resume (PDF)", variant: "secondary" },
  { command: "work", label: "Production", variant: "secondary" },
  { command: "about", label: "About", variant: "secondary" },
];

const APP_VERSION = packageJson.version;

const createTextSegment = (text: string): TextSegment => ({
  type: "text",
  text,
});

const createCommandSegment = (
  command: string,
  label?: string,
  ariaLabel?: string,
  variant?: CommandButton["variant"],
): CommandSegment => ({
  type: "command",
  label: label ?? `${command}`,
  command,
  ariaLabel,
  variant,
});

const createCopySegment = (value: string, label?: string): CopySegment => ({
  type: "copy",
  value,
  label,
});

const createLinkSegment = (
  href: string,
  label: string,
  options?: { ariaLabel?: string; newTab?: boolean },
) => ({
  type: "link" as const,
  href,
  label,
  ariaLabel: options?.ariaLabel,
  newTab: options?.newTab,
});

const buildCommandButtonLine = (commands: CommandButton[]): LineSegment[] => {
  const segments: LineSegment[] = [createTextSegment("  ")];
  commands.forEach((c, index) => {
    if (index) {
      segments.push(createTextSegment(" · "));
    }
    const cmd = c.command;
    const label = c.label ? c.label : c.command;
    const ariaLabel = label;
    segments.push(createCommandSegment(cmd, label, ariaLabel, c.variant));
  });
  return segments;
};

const buildContactRow = (label: string, value: string): LineSegment[] => {
  const isEmail = /@/.test(value);
  const valueSegment = isEmail
    ? createLinkSegment(
        `mailto:${value}?subject=Need%20help%20building%20something%20that%20has%20to%20work%20reliably`,
        value,
        {
          ariaLabel: `Email ${value}`,
        },
      )
    : createTextSegment(value);

  return [
    createTextSegment(`${label}`),
    createTextSegment("  "),
    valueSegment,
    createTextSegment(" "),
    createCopySegment(value, label),
  ];
};

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
  resolver: (name: string) => FileMeta | undefined,
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
  commands: CommandButton[],
) {
  return (): TerminalLineInput[] => {
    const list = commands;
    if (!list.length) return [];

    return [prefixPrompt, buildCommandButtonLine(list), ""];
  };
}

const FILE_ALIASES: Record<string, string> = {
  backend: "Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
  fullstack: "Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
  resume: "Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
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
    answer: "30 minutes quick intro within 24 hours. Then weekly checkpoints.",
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
    "",
  );
}

function formatFileRow(file: FileMeta) {
  const displayPath = file.path.startsWith("/") ? file.path : `/${file.path}`;
  return `  ${file.name.padEnd(18)} ${formatBytes(file.size).padStart(
    8,
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

function renderMarkdownBox(title: string, content: string): string[] {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;

  const push = (text: string = "") => out.push(`│ ${text}`);

  lines.forEach((raw) => {
    const line = raw.replace(/\s+$/, "");

    if (/^```/.test(line)) {
      inCode = !inCode;
      push(inCode ? "code:" : "");
      return;
    }

    if (inCode) {
      push(`  ${line}`);
      return;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const text = line.replace(/^#{1,6}\s+/, "");
      push(text);
      push();
      return;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      push(`  • ${line.replace(/^\s*[-*]\s+/, "")}`);
      return;
    }

    if (!line.trim()) {
      push();
      return;
    }

    push(line);
  });

  const horizontal = "─".repeat(Math.max(8, title.length + 6));
  return [`┌─ ${title}`, `├${horizontal}`, ...out, `└${horizontal}`];
}

export function registerDefaultCommands({
  registry,
  props,
  model,
  setLinesFromModel,
  appearanceController,
}: RegisterDefaultsArgs) {
  const fontController = appearanceController?.font;
  const colorController = appearanceController?.color;
  const contact = props.contact || {
    email: "miladtsx+terminal@gmail.com",
  };

  const themes = listThemes();

  const caseStudies = props.sampleWorks || [
    {
      intro: "About to pay 50k for basics.",
      title: "In-House Instead of an expensive Vendor",
      desc: "Took on smart contract work myself and saved the team a quoted $47K USD outsourcing bill.",
      tags: ["cost", "ownership", "web3"],
      problem:
        "The team needed a point-allocation smart contract system and was about to outsource it to an external provider quoting around $47K.",
      approach:
        "Switched hats from backend to smart contracts, designed the allocation logic with the team, implemented and tested the contracts, and integrated them with the existing backend and frontend flows.",
      result:
        "Delivered the required on-chain point system in-house, avoided the high-risk outsourcing cost, kept full control of the codebase, and removed a dependency on external vendors.",
    },
    {
      intro: "Stop spending before proving idea works.",
      title:
        "Investor-Ready Mock MVP in 10 Days for <$300 (Saved Founder ~$10K+ in Agency Fees)",
      desc: "Shipped investor-ready MVPs in 10 days so founders could pitch without burning cash.",
      tags: ["mvp", "founder"],
      problem:
        "Early-stage founders needed working demos for fundraising but risked burning capital on slow, expensive outsourced builds.",
      approach:
        "Ran lean discovery with each founder, scoped only the critical user flows, built thin vertical slices with typed backends and reusable components, and wired in basic analytics to show traction.",
      result:
        "Delivered demo-ready MVP in 10 days, giving founders something concrete to pitch with and avoiding an estimated ~$10K+ for project outsourcing costs.",
    },
    {
      intro: "Cloud bill growing faster than revenue.",
      title: "Cloud bill down 60%",
      desc: "Without slowing users or any compromise.",
      tags: ["cost", "reliability"],
      problem:
        "Runaway AWS and node provider costs from always-on services and unsharded workloads.",
      approach:
        "Audited traffic, split workloads into serverless and spot pools, rewrote hot paths to async queues, and enforced autoscaling SLOs with canaries.",
      result:
        "Reduced monthly bill by ~60%, improved p95 latency by ~18%, and kept on-call noise down via canary gates.",
    },
    {
      intro: "Production money at risk from bugs.",
      title: "Protected ~$4M On-Chain",
      desc: "Safeguarded ~$4M in user funds over 3 years with zero incidents.",
      tags: ["security", "finance"],
      problem:
        "Protocol had growing TVL and fragmented monitoring; regressions and bugs could slip into production unnoticed.",
      approach:
        "Hardened CI with invariant tests, integrated formal checks where feasible, and wired alerting around critical contract events and gas spikes.",
      result:
        "Zero security incidents over 36 months; shipped upgrades without downtime and kept gas usage within budget.",
    },
    {
      intro: "Users arrive, servers panic and crash.",
      title: "Game Backend 20x Players",
      desc: "Supported 20x more concurrent players and raised reliability from ~65% to 92%.",
      tags: ["scale", "reliability", "gaming"],
      problem:
        "Realtime servers fell over beyond ~100 concurrent players; packet drops and match queues stalled under load.",
      approach:
        "Refactored the event pipeline to use UDP and compact protobufs, added room sharding, and introduced circuit-breaker retries for matchmaking.",
      result:
        "Supported 2,000+ concurrent players, dropped packet loss below 0.5%, and raised successful match starts to 92%.",
    },
    {
      intro: "Customers quitting because every click costs.",
      title: "Gas Fees Cut by ~99%",
      desc: "Made key user actions ~99% cheaper in gas, reducing drop-off.",
      tags: ["cost", "web3"],
      problem:
        "Users were abandoning flows due to unpredictable L1 gas costs and complex multi-call flows.",
      approach:
        "Introduced batched relays, compressed calldata, and moved verification into a zk-rollup path with fallback to L1.",
      result:
        "Average gas per successful transaction fell by ~99%; completion rate climbed and support tickets about gas issues shrank.",
    },
    {
      intro: "Security team drowning in repetitive checks.",
      title: "Security Ops Automation",
      desc: "Freed ~3 hours/day of analyst time and improved visibility into threats.",
      tags: ["security", "automation", "efficiency"],
      problem:
        "Analysts manually scraped alerts and logs daily, missing correlations and burning time on repetitive checks.",
      approach:
        "Centralized feeds, added rule-based triage plus LLM-assisted summaries, and pushed high-signal alerts into Slack with playbook links.",
      result:
        "Cut manual review by ~3 hours per day and raised true-positive alert handling speed.",
    },
  ];
  setSearchWorkItems(caseStudies);
  const workIndex = new Map<string, SampleWork>();
  caseStudies.forEach((item) => workIndex.set(makeWorkSlug(item.title), item));

  const findWorkEntry = (input: string) => {
    const token = input.toLowerCase().trim();
    return (
      workIndex.get(token) ||
      caseStudies.find((item) => {
        const slug = makeWorkSlug(item.title);
        return (
          slug === token ||
          item.title.toLowerCase() === token ||
          item.title.toLowerCase().includes(token)
        );
      })
    );
  };

  const contactEntries = [
    contact.email
      ? { label: "email", displayLabel: "✉", value: contact.email }
      : null,
  ].filter(Boolean) as {
    label: string;
    value: string;
    displayLabel?: string;
  }[];

  const formatSuggestedLines = formatCommandToButton(
    "Suggested commands:",
    (props.suggestedCommands as CommandButton[] | undefined) ??
      DEFAULT_SUGGESTED_COMMANDS,
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
      (item, index) =>
        `${(index + 1).toString().padStart(width, " ")}  ${item}`,
    );
  };

  const helpHandler = ({
    registry: registryContext,
  }: CommandHandlerContext) => {
    const commands = [...registryContext.list()]
      .filter((c) => c.desc)
      .sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );

    const widestName = commands.reduce(
      (max, cmd) => Math.max(max, cmd.name.length),
      0,
    );

    const rows = commands.flatMap((command, index) => {
      const desc = command.desc ? ` — ${command.desc}` : "";
      const name = command.name.padEnd(widestName);
      const line = `  • ${name} ${desc}`.trimEnd();
      const spacer = index === commands.length - 1 ? [] : [""];
      return [line, ...spacer];
    });

    return [
      ...formatSuggestedLines(),
      "commands (A–Z):",
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
      status.entries.forEach((entry: string) => lines.push(`  ${entry}`));
    } else {
      lines.push("cached: none yet");
    }

    return lines;
  };

  const searchHandler = async ({ args }: CommandHandlerContext) => {
    const rawQuery = args.join(" ");
    const query = sanitizeSearchQuery(rawQuery);

    // If no query, open modal and focus input preserving state.
    if (!query) {
      searchStore.open();
      return ["search mode opened — type in the search bar (live results)"];
    }

    const { hits, total } = await runSearch(query);
    searchStore.setQuery(query);
    searchStore.setResults(hits, total);
    searchStore.open();

    if (!hits.length) {
      return [`no matches for "${query}" (search modal open)`];
    }

    const summary = `search modal open — ${total} match${total === 1 ? "" : "es"} for "${query}"`;
    return [summary];
  };

  const files = listFiles();

  const displayFontHandler = async ({ args }: CommandHandlerContext) => {
    const tokens = [...args];
    if (tokens[0]?.toLowerCase() === "font") tokens.shift();

    if (!fontController) {
      return ["display font unavailable: font controller not initialized."];
    }

    const action = (tokens[0] || "list").toLowerCase();

    if (action === "list") return formatFontList();
    if (action === "current") {
      const current = fontController.getCurrentFont();
      return [
        "current font:",
        `  ${current.label} (${current.id})`,
        current.description ? `  ${current.description}` : "",
      ].filter(Boolean);
    }

    const targetId = action === "set" ? tokens[1] || "" : action;
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

  const normalizeColorId = (value: string) => {
    return value.toLowerCase();
  };

  const displayColorHandler = async ({ args }: CommandHandlerContext) => {
    const tokens = [...args];
    if (tokens[0]?.toLowerCase() === "color") tokens.shift();

    if (!colorController) {
      return ["display color unavailable: color controller not initialized."];
    }

    const action = (tokens[0] || "list").toLowerCase();

    if (action === "list") return formatColorList();
    if (action === "current") {
      const current = colorController.getCurrentColor();
      return [
        "current color:",
        `  ${current.label} (${current.id}) — ${current.group}`,
        current.description ? `  ${current.description}` : "",
      ].filter(Boolean);
    }

    const targetId = action === "set" ? tokens[1] || "" : action;
    if (!targetId) return ["usage: display color <id>", ...formatColorList()];

    const normalized = normalizeColorId(targetId);
    const option = colorController
      .listColors()
      .find((item) => item.id.toLowerCase() === normalized.toLowerCase());

    if (!option)
      return [`unknown color: ${targetId}`, "try: display color list"];

    try {
      await colorController.setColor(option.id);
      return [
        `color set to ${option.label}`,
        option.description ? option.description : "",
      ].filter(Boolean);
    } catch (error) {
      return [`failed to set color: ${(error as Error).message}`];
    }
  };

  const formatFontList = () => {
    if (!fontController) return ["display font is unavailable in this build."];

    const current = fontController.getCurrentFont();
    const items = fontController.listFonts();
    const longest = items.reduce(
      (len: number, item: TerminalFontMeta) => Math.max(len, item.id.length),
      0,
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

  const formatColorList = () => {
    if (!colorController)
      return ["display color is unavailable in this build."];

    const current = colorController.getCurrentColor();
    const items = colorController.listColors();
    const longest = items.reduce(
      (len: number, item: TerminalColorMeta) => Math.max(len, item.id.length),
      0,
    );

    const byGroup: Record<string, TerminalColorMeta[]> = {};
    items.forEach((item) => {
      byGroup[item.group] = byGroup[item.group] || [];
      byGroup[item.group].push(item);
    });

    const lines: string[] = [];
    ["dark", "light"].forEach((group) => {
      if (!byGroup[group]) return;
      lines.push(`${group} colors:`);
      byGroup[group].forEach((color) => {
        const active = color.id === current.id ? " (current)" : "";
        const desc = color.description ? ` — ${color.description}` : "";
        lines.push(
          `  ${color.id.padEnd(longest)}  ${color.label}${active}${desc}`,
        );
      });
      lines.push("");
    });

    lines.push("set: display color <id>");
    lines.push("show current: display color current");
    return lines;
  };

  const formatThemeList = () => {
    if (!colorController || !fontController) {
      return ["themes are unavailable in this build."];
    }

    const currentColor = colorController.getCurrentColor();
    const currentFont = fontController.getCurrentFont();
    const currentTheme = matchTheme(currentColor.id, currentFont.id);
    const longest = themes.reduce(
      (len, pack) => Math.max(len, pack.id.length),
      0,
    );

    const rows = themes.map((pack) => {
      const active = currentTheme?.id === pack.id ? " (current)" : "";
      const desc = pack.description ? ` — ${pack.description}` : "";
      return `  ${pack.id.padEnd(longest)}  ${pack.label}${active}${desc}`;
    });

    return [
      "themes:",
      ...rows,
      "",
      "set: theme <id>",
      "show current: theme current",
      "tip: fine tune with display font/color",
    ];
  };

  const themeHandler = async ({ args }: CommandHandlerContext) => {
    if (!colorController || !fontController) {
      return ["themes are unavailable: appearance controller not ready."];
    }

    const action = (args[0] || "list").toLowerCase();
    if (action === "list") return formatThemeList();
    if (action === "current") {
      const activeTheme = matchTheme(
        colorController.getCurrentColor().id,
        fontController.getCurrentFont().id,
      );
      if (!activeTheme) {
        return [
          "current theme:",
          `  color: ${colorController.getCurrentColor().id}`,
          `  font: ${fontController.getCurrentFont().id}`,
          "  (custom mix)",
        ];
      }
      return [
        "current theme:",
        `  ${activeTheme.label} (${activeTheme.id})`,
        `  color: ${activeTheme.colorId}`,
        `  font: ${activeTheme.fontId}`,
        activeTheme.description ? `  ${activeTheme.description}` : "",
      ].filter(Boolean);
    }

    const targetId = action === "set" ? args[1] || "" : action;
    if (!targetId) return ["usage: theme <id>", ...formatThemeList()];

    const pack = findTheme(targetId);
    if (!pack) return [`unknown theme: ${targetId}`, ...formatThemeList()];

    try {
      await colorController.setColor(pack.colorId);
      await fontController.setFont(pack.fontId);
      return [
        `theme set to ${pack.label}`,
        `  color: ${pack.colorId}`,
        `  font: ${pack.fontId}`,
        pack.description ? `  ${pack.description}` : "",
      ].filter(Boolean);
    } catch (error) {
      return [`failed to set theme: ${(error as Error).message}`];
    }
  };

  const whoamiHandler = () => {
    const lines = [
      "Name: Milad TSX",
      "Role: Software Backend Engineer",
      "Focus: Reliability / Infrastructure",
      "Open to collaboration",
    ];
    return [
      [
        buildAvatarSegment(lines, {
          label: "Milad TSX",
          meta: "profile",
          image: "images/ai_avatar.jpg",
        }),
      ],
    ];
  };

  registry
    .register("help", helpHandler, { desc: "show commands" })
    .register("?", helpHandler, { desc: "show commands (alias)" })
    .register(
      "about",
      () => {
        const aboutLines = props.aboutLines || [
          `I enjoy hard systems problems: 
- correctness
- recovery
- and predictable behavior 
in systems that can’t afford to be wrong.
          `,
        ];

        return [
          [
            buildAvatarSegment(aboutLines, {
              label: "Software Engineer",
              meta: "(Reliability / Infrastructure)",
              image: "images/ai_avatar.jpg",
            }),
          ],
          "",
        ];
      },
      { desc: "short bio" },
    )
    .register(
      "blog",
      ({ args }) => {
        const sub = (args[0] || "list").toLowerCase();

        const formatPostRow = (
          postSlug: string,
          title: string,
          date?: string,
          tags?: string[],
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
            lines.push(
              formatPostRow(post.slug, post.title, post.date, post.tags),
            );
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
                markdown: [post.summary, post.body]
                  .filter(Boolean)
                  .join("\n\n"),
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
              formatPostRow(post.slug, post.title, post.date, post.tags),
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
          const wantsRead =
            subToken === "read" || prefix.toLowerCase() === "read";
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
              title.toLowerCase().startsWith(titlePrefix.toLowerCase()),
            );

          return matches.map((title) => `read ${title}`);
        },
      },
    )
    .register(
      "contact",
      () => {
        const lines: TerminalLineInput[] = [
          ...contactEntries.map((entry) =>
            buildContactRow(entry.displayLabel ?? entry.label, entry.value),
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
      { desc: "reach out to me" },
    )
    .register(
      "book",
      () => {
        props.onBookCall?.();
        return ["Opening calendar embed…"].filter(
          Boolean,
        ) as TerminalLineInput[];
      },
      { desc: "book a meeting" },
    )
    .register(
      "chatbot",
      () => {
        openChat();
        return ["Opening chatbot…", "Tip: Esc to minimize"];
      },
      { desc: "Chat with my resume! [Beta]" },
    )
    .register(
      "work",
      ({ args }) => {
        const action = (args[0] || "list").toLowerCase();

        if (action === "list" || !args.length) {
          return [
            "",
            "Click to see how I help businesses",
            "",
            [
              {
                type: "work",
                items: caseStudies,
              },
            ],
          ];
        }

        if (action === "read") {
          const target = args.slice(1).join(" ").trim();
          if (!target) return ["usage: work read <title|slug>"];
          const entry = findWorkEntry(target);
          if (!entry) return [`no work entry found for "${target}"`];
          return [
            entry.title,
            [
              {
                type: "work",
                items: [entry],
              },
            ],
          ];
        }

        return ["usage: work [list] | work read <title|slug>"];
      },
      { desc: "selected projects", subcommands: ["list", "read"] },
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
      { desc: "change directory (home, home/files)" },
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
      { desc: "list downloadable files" },
    )
    .register("search", searchHandler, {
      desc: "search logs, and resume text",
      subcommands: [],
    })
    .register("grep", searchHandler, {
      desc: "alias for search",
      subcommands: [],
    })
    .register(
      "cat",
      async ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile,
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
      { desc: "print a text file from /files" },
    )
    .register(
      "open",
      ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile,
          ) || resolveFile(args[0] || "");
        if (!target) return ["usage: open <filename>", "try: ls"];
        window.open(target.path, "_blank", "noopener,noreferrer");
        return [`opening ${target.path} in a new tab...`];
      },
      { desc: "open file in browser tab" },
    )
    .register(
      "download",
      ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile,
          ) || resolveFile(args[0] || "");
        if (!target) return ["usage: download <filename>", "try: ls"];

        // Use the actual filename from the path so downloads keep their real name.
        const downloadName =
          target.path.split("/").filter(Boolean).pop() || target.name;

        const link = document.createElement("a");
        link.href = target.path;
        link.download = downloadName;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return [`downloading ${downloadName}...`];
      },
      { desc: "download file from /files" },
    )
    .register(
      "verify",
      async ({ args, model }) => {
        const target =
          resolveFileFromPath(
            args[0] || "",
            model.getCwdParts(),
            resolveFile,
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
      { desc: "show SHA256 for a file" },
    )
    .register(
      "copy",
      async ({ args }) => {
        const field = (args[0] || "").toLowerCase();
        const entry = contactEntries.find(
          (item) => item.label.toLowerCase() === field,
        );
        if (!entry) return ["usage: copy email|github"];
        await copyToClipboard(entry.value);
        return [`copied ${entry.label} to clipboard`];
      },
      { desc: "copy contact info" },
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
      { desc: "interactive FAQ" },
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
                  body: [entry.summary, entry.body]
                    .filter(Boolean)
                    .join("\n\n"),
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
                    body: [entry.summary, entry.body]
                      .filter(Boolean)
                      .join("\n\n"),
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
              }`,
          );
          return ["logs search results:", ...lines];
        }

        return [
          "usage: logs list | logs read <slug|title> | logs search <query>",
        ];
      },
      {
        desc: "work logs list/read/search",
        subcommands: ["list", "read", "search"],
      },
    )
    .register("whoami", whoamiHandler, { desc: "show profile card" })
    .register("theme", themeHandler, {
      desc: "apply a bundled theme (font + color)",
      subcommands: ["list", "current", ...themes.map((pack) => pack.id)],
      subcommandSuggestions: ({ prefix, parts }) => {
        const token = (parts[1] || prefix || "").toLowerCase();
        if (!token) return ["list", "current", ...themes.map((p) => p.id)];
        return themes
          .map((pack) => pack.id)
          .filter((id) => id.toLowerCase().startsWith(token));
      },
    })
    .register(
      "display",
      async (ctx) => {
        const scope = (ctx.args[0] || "").toLowerCase();
        if (!scope || scope === "font") {
          return displayFontHandler({
            ...ctx,
            args: scope ? ctx.args.slice(1) : ctx.args,
          });
        }
        if (scope === "color") {
          return displayColorHandler({ ...ctx, args: ctx.args.slice(1) });
        }
        return ["usage: display font|color [list|current|<id>]"];
      },
      {
        desc: "display settings (font/color)",
        subcommands: ["font", "color"],
        subcommandSuggestions: ({ parts }) => {
          const first = (parts[1] || "").toLowerCase();

          if (!first) return ["font", "color"];

          if (first === "font") {
            if (!fontController) return [];
            const prefix = (parts[2] || "").toLowerCase();
            return fontController
              .listFonts()
              .map((f: TerminalFontMeta) => f.id)
              .filter((id: string) => id.toLowerCase().startsWith(prefix))
              .map((id) => `font ${id}`);
          }

          if (first === "color") {
            if (!colorController) return [];
            const prefix = (parts[2] || "").toLowerCase();
            return colorController
              .listColors()
              .map((t: TerminalColorMeta) => t.id)
              .filter((id: string) => id.toLowerCase().startsWith(prefix))
              .map((id) => `color ${id}`);
          }

          return [];
        },
      },
    )
    .register(
      "resume",
      () => {
        const target = findFileByName("cv.pdf");
        if (!target) return ["resume not found; try ls"];
        window.open(target.path, "_blank", "noopener,noreferrer");
        return [`opening ${target.name}...`];
      },
      { desc: "open resume.pdf in new tab" },
    )
    .register("ver", () => [`version: ${APP_VERSION}`], {
      desc: "show app version",
    })
    .register(
      "man",
      ({ args }) => {
        const topic = (args[0] || "").toLowerCase();
        const pages: Record<string, string[]> = {
          pwd: ["print current directory (virtual)"],
          ls: ["list files from /files", "ls"],
          cat: ["cat <file> — print text files only"],
          grep: ["grep <term> — unified search (alias of search)"],
          search: [
            "search <term> — unified search across works, logs, and resume text",
            "Cmd/Ctrl+F pre-fills the search prompt",
          ],
          open: ["open <file> — open in new tab"],
          download: ["download <file> — trigger browser download"],
          verify: [
            "verify <file> — compute SHA256 locally, compare to manifest",
          ],
          copy: ["copy email — copy to clipboard"],
          whoami: ["compact profile card; alias: finger"],
          resume: ["open resume PDF"],
          ver: ["ver — show app version"],
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
            "display color list — show dark/light colors",
            "display color current — show active color",
            "display color <id> — switch terminal colors",
          ],
          theme: [
            "theme list — show bundled font+color presets",
            "theme current — show active preset (or custom)",
            "theme <id> — apply preset (updates font + theme)",
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
      { desc: "man <command>" },
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
      { desc: "clear the screen" },
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
      },
    )
    .register("assumptions", async () => {
      return [
        `
      I don’t believe in “rockstar engineers”.

      I believe:
      - most problems are underspecified
      - most failures come from bad framing, not bad code
      - speed without auditability is technical debt with interest

      If you expect instant answers, I’m not a fit.
      If you expect careful systems that survive contact with reality, ⤶
      `,
        [
          createTextSegment(" 📞 "),
          createCommandSegment("book", "Face to Face", "Open booking calendar"),
        ],
      ];
    })
    .register("constraints", async () => {
      return [
        `
      Constraints I operate under (by choice):

      - I don’t ship code I can’t explain or unwind
      - I bias toward boring primitives over clever abstractions
      - I assume systems will be misused

      This makes me slower on day 1
      and faster on day 100.
      `,
      ];
    })
    .register("philosophy", async () => {
      return [
        `
      Autonomy without accountability is just automation debt.

      Every agent should:
      - explain itself
      - show its work
      - accept being stopped

      If that sounds slow, I’m not your engineer.
      `,
      ];
    })
    .register("bias", async () => {
      return [
        `
          I assume systems will fail.

          I design for:
            - partial information
            - bad inputs
            - silent errors
            - human fatigue

          This makes me slower at demos
          and faster in production.
      `,
      ];
    });

  // Easter Eggs
}
