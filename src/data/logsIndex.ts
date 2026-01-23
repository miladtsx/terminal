import logOne from "./logs/2025-01-15-ship.md?raw";
import logTwo from "./logs/2025-01-21-tab.md?raw";

export type LogEntry = {
  slug: string;
  title: string;
  date?: string;
  tags: string[];
  summary?: string;
  body: string;
  plainLines: string[];
};

type ParsedFrontMatter = {
  title?: string;
  date?: string;
  tags?: string[];
  summary?: string;
};

type LogSource = {
  slug: string;
  raw: string;
};

const sources: LogSource[] = [
  { slug: "2025-01-15-ship", raw: logOne },
  { slug: "2025-01-21-tab", raw: logTwo },
];

function parseFrontMatter(raw: string): { meta: ParsedFrontMatter; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const front = match[1];
  const body = match[2] || "";

  const meta: ParsedFrontMatter = {};
  front
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [key, ...rest] = line.split(":");
      if (!key || !rest.length) return;
      const valueRaw = rest.join(":").trim();
      if (!valueRaw) return;

      if (valueRaw.startsWith("[") && valueRaw.endsWith("]")) {
        try {
          const parsed = JSON.parse(valueRaw);
          if (Array.isArray(parsed)) {
            meta[key.trim() as keyof ParsedFrontMatter] = parsed;
            return;
          }
        } catch (_) {
          /* fallthrough */
        }
      }

      const cleaned = valueRaw.replace(/^\"|\"$/g, "").trim();
      (meta as Record<string, string>)[key.trim()] = cleaned;
    });

  return { meta, body: body.trim() };
}

function markdownToPlainLines(markdown: string): string[] {
  const withoutCodeFences = markdown.replace(/```[\s\S]*?```/g, (block) => {
    return block.replace(/```/g, "");
  });

  const replacedLinks = withoutCodeFences.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  const stripped = replacedLinks
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\r/g, "");

  return stripped.split(/\n/).map((line) => line.trimEnd());
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const logMap = new Map<string, LogEntry>();
const invertedIndex = new Map<string, Set<string>>();

function indexOnce() {
  if (logMap.size) return;

  sources.forEach(({ slug, raw }) => {
    const { meta, body } = parseFrontMatter(raw);
    const title = meta.title || slug;
    const tags = meta.tags?.map((t) => t.toLowerCase()) || [];
    const plainLines = markdownToPlainLines(body);

    const entry: LogEntry = {
      slug,
      title,
      date: meta.date,
      tags,
      summary: meta.summary,
      body,
      plainLines,
    };

    logMap.set(slug, entry);

    const tokens = tokenize([title, ...plainLines].join(" "));
    const unique = new Set(tokens);
    unique.forEach((token) => {
      const existing = invertedIndex.get(token) || new Set<string>();
      existing.add(slug);
      invertedIndex.set(token, existing);
    });
  });
}

function getAll(): LogEntry[] {
  indexOnce();
  return Array.from(logMap.values()).sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date);
    return a.title.localeCompare(b.title);
  });
}

function findBySlugOrTitle(input: string): LogEntry | undefined {
  indexOnce();
  const lowered = input.toLowerCase();
  if (logMap.has(lowered)) return logMap.get(lowered);

  const bySlug = Array.from(logMap.values()).find((p) => p.slug.toLowerCase() === lowered);
  if (bySlug) return bySlug;

  return Array.from(logMap.values()).find((p) => p.title.toLowerCase().includes(lowered));
}

function search(query: string) {
  indexOnce();
  const tokens = tokenize(query);
  if (!tokens.length) return [] as Array<{ slug: string; title: string; score: number; summary?: string }>;
  const scores = new Map<string, number>();

  tokens.forEach((token) => {
    const slugs = invertedIndex.get(token);
    if (!slugs) return;
    slugs.forEach((slug) => {
      scores.set(slug, (scores.get(slug) || 0) + 1);
    });
  });

  return Array.from(scores.entries())
    .map(([slug, score]) => {
      const entry = logMap.get(slug)!;
      return { slug, title: entry.title, summary: entry.summary, score };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function linesForSearch(): Array<{ slug: string; title: string; lines: string[] }> {
  indexOnce();
  return Array.from(logMap.values()).map((entry) => ({
    slug: entry.slug,
    title: entry.title,
    lines: entry.plainLines,
  }));
}

export const logsIndex = {
  getAll,
  findBySlugOrTitle,
  search,
  linesForSearch,
};

export type LogsIndex = typeof logsIndex;
