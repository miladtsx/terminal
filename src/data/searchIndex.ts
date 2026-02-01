import { blogIndex } from "./blogIndex";
import { logsIndex } from "./logsIndex";
import { findFileByName } from "./files";
import { FileMeta, SampleWork, SearchHit } from "@types";

// show the previous and after contents of the located search query match
export const SEARCH_RESULT_CONTEXT_WINDOW_LINES = 0;

const textCache = new Map<string, string>();
const resumeLinesCache: { lines?: string[] } = {};
let workItems: SampleWork[] = [];

export function setSearchWorkItems(items: SampleWork[]) {
  workItems = items.slice();
}

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const buildSearchRegex = (query: string) => {
  const tokens = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(escapeRegex)
    .map((token) => `\\b${token}`); // anchor at word start to avoid substring hits

  return tokens.length ? new RegExp(tokens.join("|"), "i") : null;
};

export const sanitizeSearchQuery = (raw: string, opts: { trim?: boolean } = {}) => {
  // Drop anything except letters, numbers, and whitespace then normalize spacing.
  const filtered = raw.replace(/[^a-z0-9\s]/gi, "");
  const normalized = filtered.replace(/\s+/g, " ");
  const shouldTrim = opts.trim ?? true;
  const ready = shouldTrim ? normalized.trim() : normalized;
  return ready.slice(0, 50);
};

export function sliceContext(
  lines: string[],
  index: number,
): { before: string[]; line: string; after: string[]; lineNumber: number } {
  const start = Math.max(0, index - SEARCH_RESULT_CONTEXT_WINDOW_LINES);
  const end = Math.min(lines.length, index + SEARCH_RESULT_CONTEXT_WINDOW_LINES + 1);
  const before = lines.slice(start, index);
  const after = lines.slice(index + 1, end);
  return {
    before,
    line: lines[index],
    after,
    lineNumber: index + 1,
  };
}

export const makeWorkSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function workToLines(item: SampleWork): string[] {
  const tagLine = item.tags?.length ? `tags: ${item.tags.join(", ")}` : "";
  const fields = [
    item.title,
    item.intro,
    item.desc,
    item.problem,
    item.approach,
    item.result,
    tagLine,
  ].filter(Boolean) as string[];

  return fields.flatMap((value) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

async function getTextForFile(meta: FileMeta): Promise<string> {
  const cached = textCache.get(meta.path);
  if (cached !== undefined) return cached;
  const resp = await fetch(meta.path);
  if (!resp.ok) throw new Error(`fetch failed (${resp.status})`);
  const text = await resp.text();
  textCache.set(meta.path, text);
  return text;
}

export async function getResumeLines(): Promise<{ meta: FileMeta; lines: string[] } | null> {
  const meta = findFileByName("llm_tsx.txt");
  if (!meta) return null;
  if (resumeLinesCache.lines) {
    return { meta, lines: resumeLinesCache.lines };
  }
  const text = await getTextForFile(meta);
  const lines = text.split(/\r?\n/);
  resumeLinesCache.lines = lines;
  return { meta, lines };
}

type SurfaceEntry = {
  source: SearchHit["source"];
  title: string;
  location: string;
  lines: string[];
  readCommand: string;
  downloadCommand?: string;
};

async function collectSearchEntries(): Promise<SurfaceEntry[]> {
  const entries: SurfaceEntry[] = [];

  blogIndex.linesForSearch().forEach((entry) => {
    entries.push({
      source: "blog",
      title: entry.title,
      location: "blog",
      lines: entry.lines,
      readCommand: `blog read ${entry.slug}`,
    });
  });

  logsIndex.linesForSearch().forEach((entry) => {
    entries.push({
      source: "log",
      title: entry.title,
      location: "log",
      lines: entry.lines,
      readCommand: `logs read ${entry.slug}`,
    });
  });

  const resume = await getResumeLines();
  if (resume) {
    entries.push({
      source: "resume",
      title: resume.meta.name,
      location: "resume",
      lines: resume.lines,
      readCommand: `cat ${resume.meta.name}`,
      downloadCommand: `download ${resume.meta.name}`,
    });
  }

  workItems.forEach((item) => {
    const slug = makeWorkSlug(item.title);
    entries.push({
      source: "work",
      title: item.title,
      location: "work",
      lines: workToLines(item),
      readCommand: `work read ${slug}`,
    });
  });

  return entries;
}

export async function runSearch(query: string): Promise<{
  hits: SearchHit[];
  total: number;
}> {
  const normalizedQuery = sanitizeSearchQuery(query);
  const regex = buildSearchRegex(normalizedQuery);
  if (!regex) return { hits: [], total: 0 };

  const hits: SearchHit[] = [];
  const entries = await collectSearchEntries();

  entries.forEach((entry) => {
    entry.lines.forEach((line, index) => {
      if (!regex.test(line)) return;
      const ctx = sliceContext(entry.lines, index);
      hits.push({
        id: `${entry.source}-${hits.length}-${ctx.lineNumber}`,
        source: entry.source,
        title: entry.title,
        location: entry.location,
        ...ctx,
        readCommand: entry.readCommand,
        downloadCommand: entry.downloadCommand,
      });
    });
  });

  return { hits, total: hits.length };
}
