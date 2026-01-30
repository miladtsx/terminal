import { useCallback, useMemo } from "react";
import ky, { type KyInstance } from "ky";
import {
  TelemetryError,
  TelemetryEventPayload,
  TelemetryInput,
} from "@types";

const DEFAULT_NTFY_TOPIC = "https://ntfy.sh/terminalTSX";
const RETRIABLE_STATUS = [408, 425, 429, 500, 502, 503, 504];
const FP_STORAGE_KEY = "anon_privacy_respecting_uuid";

const kyCache = new Map<string, KyInstance>();

const buildFingerprint = async (): Promise<string | undefined> => {
  if (typeof window === "undefined") return undefined;
  try {
    const cached = localStorage.getItem(FP_STORAGE_KEY);
    if (cached) return cached;

    const anonId = crypto.randomUUID?.() || String(Math.random());
    localStorage.setItem(FP_STORAGE_KEY, anonId);
    return anonId;
  } catch {
    return undefined;
  }
};

const getEndpoint = (topicUrl?: string): string | null => {
  const envOverride = import.meta.env?.VITE_NTFY_TOPIC_URL as string | undefined;
  const disabled = import.meta.env?.VITE_DISABLE_TELEMETRY === "true";
  if (disabled) return null;
  return (topicUrl || envOverride || DEFAULT_NTFY_TOPIC).replace(/\/+$/, "");
};

const getClient = (endpoint: string): KyInstance => {
  const cached = kyCache.get(endpoint);
  if (cached) return cached;
  const instance = ky.create({
    timeout: 10_000,
    retry: {
      limit: 4,
      methods: ["post"],
      statusCodes: RETRIABLE_STATUS,
      backoffLimit: 4000,
    },
    hooks: {
      beforeRequest: [
        (request) => {
          request.headers.set("Content-Type", "application/json");
        },
      ],
    },
  });
  kyCache.set(endpoint, instance);
  return instance;
};

const parseError = (error: unknown): TelemetryError | undefined => {
  if (!error) return undefined;
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: "Unknown error" };
  }
};

const buildPayload = (
  input: TelemetryInput,
  fingerprint?: string,
): TelemetryEventPayload => {
  const base = {
    timestamp: new Date().toISOString(),
    fingerprint,
  } as const;

  if (typeof input === "string") {
    return {
      ...base,
      level: "info",
      message: input,
    };
  }

  const { action, userInput, message, level = "info", error, context } = input;

  return {
    ...base,
    action,
    userInput,
    message,
    level,
    error: parseError(error),
    context,
  };
};

export async function sendTelemetryEvent(
  input: TelemetryInput,
  opts?: { topicUrl?: string },
) {
  if (typeof window === "undefined") return;
  const endpoint = getEndpoint(opts?.topicUrl);
  if (!endpoint) return;

  const client = getClient(endpoint);
  const fingerprint = await buildFingerprint();
  const payload = buildPayload(input, fingerprint);

  try {
    await client.post(endpoint, { json: payload });
  } catch (error) {
    console.warn("telemetry send failed", error);
  }
}

export function useTelemetry(topicUrl?: string) {
  const endpoint = useMemo(() => getEndpoint(topicUrl), [topicUrl]);

  const sendTelemetry = useCallback(
    async (input: TelemetryInput) =>
      sendTelemetryEvent(input, { topicUrl: endpoint ?? undefined }),
    [endpoint],
  );

  const notify = useCallback(
    (message: string) => sendTelemetry(message),
    [sendTelemetry],
  );

  const logEvent = useCallback(
    (
      details: Omit<TelemetryEventPayload, "timestamp" | "level"> & {
        level?: TelemetryEventPayload["level"];
      },
    ) => sendTelemetry({ ...details }),
    [sendTelemetry],
  );

  const logError = useCallback(
    (
      details: Omit<TelemetryEventPayload, "timestamp" | "level"> & {
        level?: TelemetryEventPayload["level"];
      },
    ) => sendTelemetry({ ...details, level: "error" }),
    [sendTelemetry],
  );

  return { notify, logEvent, logError, sendTelemetry };
}
