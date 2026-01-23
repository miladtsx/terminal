const MAX_RUN_PARAM_LENGTH = 512;
const MAX_COMMANDS = 3;

export const SHARE_QUERY_KEY = "run";

type AllowedCommand = {
  command: string;
  subcommand: string;
  maxArgLength: number;
};

const ALLOWED: AllowedCommand[] = [
  { command: "blog", subcommand: "read", maxArgLength: 50 },
  { command: "logs", subcommand: "read", maxArgLength: 50 },
];

function normalizeTokens(value: string): string[] {
  // split on spaces without regex to keep it simple
  return value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function allowlistCommand(tokens: string[]): string | null {
  if (tokens.length !== 3) return null;
  const [cmd, sub, arg] = tokens;
  const match = ALLOWED.find(
    (item) =>
      item.command.toLowerCase() === cmd.toLowerCase() &&
      item.subcommand.toLowerCase() === sub.toLowerCase(),
  );
  if (!match) return null;
  if (!arg || arg.length > match.maxArgLength) return null;
  return `${match.command} ${match.subcommand} ${arg}`;
}

export function buildShareLink(commands: string | string[], baseHref?: string) {
  const list = (Array.isArray(commands) ? commands : [commands])
    .map((cmd) => allowlistCommand(normalizeTokens(cmd)))
    .filter((cmd): cmd is string => Boolean(cmd));

  const href =
    baseHref || (typeof window !== "undefined" ? window.location.href : "");
  const url = new URL(href || "http://localhost");
  if (!list.length) return url.toString();

  const encoded = list.map((cmd) => encodeURIComponent(cmd)).join("|");
  url.searchParams.set(SHARE_QUERY_KEY, encoded);
  return url.toString();
}

export function parseShareCommandsFromLocation(loc?: Location): string[] {
  if (typeof window === "undefined" && !loc) return [];
  const target = loc || window.location;

  try {
    const params = new URLSearchParams(target.search);
    const raw = params.get(SHARE_QUERY_KEY) || "";
    if (!raw || raw.length > MAX_RUN_PARAM_LENGTH) return [];

    const parts = raw.split("|").slice(0, MAX_COMMANDS);
    const allowed: string[] = [];

    parts.forEach((part) => {
      // decode each run token individually; support accidental double-encoding
      let decoded = part;
      for (let i = 0; i < 2; i += 1) {
        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          return;
        }
      }
      const tokens = normalizeTokens(decoded);
      const cmd = allowlistCommand(tokens);
      if (cmd) allowed.push(cmd);
    });

    return allowed;
  } catch {
    return [];
  }
}
