import { FileMeta } from "@types";
import { findFileByName } from "@data/files";

export const FILE_ALIASES: Record<string, string> = {
  backend: "Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
  fullstack: "Milad_TSX_Senior_Fullstack_Engineer_Resume.pdf",
  resume: "Milad_TSX_Senior_Backend_Engineer_Resume.pdf",
  llm: "llm_tsx.txt",
};

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMtime(mtime?: string): string | null {
  if (!mtime) return null;
  const date = new Date(mtime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function resolveFileMeta(token: string): FileMeta | undefined {
  if (!token) return undefined;
  const normalized = token.toLowerCase();
  const aliasTarget = FILE_ALIASES[normalized];
  const target = aliasTarget || token;
  const filename = target.split("/").filter(Boolean).pop() || target;
  return findFileByName(filename);
}

export function parseDownloadToken(command: string): string | null {
  const parts = command.trim().split(/\s+/);
  if (!parts.length) return null;
  if (parts[0].toLowerCase() !== "download") return null;
  if (parts.length < 2) return null;
  return parts.slice(1).join(" ");
}

export function getDownloadMeta(command?: string): FileMeta | undefined {
  if (!command) return undefined;
  const token = parseDownloadToken(command);
  if (!token) return undefined;
  return resolveFileMeta(token);
}
